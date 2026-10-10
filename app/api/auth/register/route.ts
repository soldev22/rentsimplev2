import { NextResponse } from "next/server"

import { getClientIpAddress, registerRateLimitAttempt } from "@/lib/server/auth-security"
import { assessRegistration, getDeviceFingerprint, hashRegistrationIdentifier } from "@/lib/server/registration-authenticity"
import { countRecentRegistrationAttempts, recordRegistrationAttempt } from "@/lib/server/registration-attempts"
import { createUser, sendVerificationForUser } from "@/lib/server/users"

async function atRegistrationStage<T>(stage: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    const stageError = new Error("Registration stage failed", { cause: error })
    Object.assign(stageError, { registrationStage: stage })
    throw stageError
  }
}

async function handleRegistration(request: Request) {
  const body = (await atRegistrationStage("request_body", () => request.json())) as {
    email?: string
    password?: string
    firstName?: string
    lastName?: string
    mobile?: string
    website?: string
  }

  if (!body.email?.trim() || !body.password || !body.firstName?.trim() || !body.lastName?.trim()) {
    return NextResponse.json(
      { error: "First name, last name, email, and password are required." },
      { status: 400 },
    )
  }

  const ipAddress = getClientIpAddress(request)
  const emailAddress = body.email.trim().toLowerCase()
  const password = body.password
  const firstName = body.firstName.trim()
  const lastName = body.lastName.trim()
  const mobile = body.mobile ?? ""
  const userAgent = request.headers.get("user-agent") ?? ""
  const subnet = ipAddress.includes(":") ? ipAddress.split(":").slice(0, 4).join(":") : ipAddress.split(".").slice(0, 3).join(".")
  const deviceFingerprint = getDeviceFingerprint({
    userAgent,
    acceptLanguage: request.headers.get("accept-language") ?? "",
    timezone: request.headers.get("x-timezone") ?? "",
    screen: request.headers.get("x-screen") ?? "",
  })
  const ipHash = hashRegistrationIdentifier(ipAddress)
  const [ipRateLimit, subnetRateLimit, emailRateLimit, deviceRateLimit, recentAttempts] = await Promise.all([
    atRegistrationStage("ip_rate_limit", () => registerRateLimitAttempt({
      action: "register",
      scope: "ip",
      identifier: ipHash,
      maxAttempts: 10,
      windowMs: 1000 * 60 * 60,
    })),
    atRegistrationStage("subnet_rate_limit", () => registerRateLimitAttempt({
      action: "register",
      scope: "ip",
      identifier: hashRegistrationIdentifier(`subnet:${subnet}`),
      maxAttempts: 30,
      windowMs: 1000 * 60 * 60,
    })),
    atRegistrationStage("email_rate_limit", () => registerRateLimitAttempt({
      action: "register",
      scope: "email",
      identifier: emailAddress,
      maxAttempts: 3,
      windowMs: 1000 * 60 * 60,
    })),
    atRegistrationStage("device_rate_limit", () => registerRateLimitAttempt({
      action: "register",
      scope: "device",
      identifier: [userAgent, request.headers.get("accept-language") ?? "", request.headers.get("x-timezone") ?? ""].join("|"),
      maxAttempts: 5,
      windowMs: 1000 * 60 * 60,
    })),
    atRegistrationStage("registration_attempt_lookup", () => countRecentRegistrationAttempts({
      ipHash,
      deviceFingerprint,
      since: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    })),
  ])

  if (!ipRateLimit.allowed || !subnetRateLimit.allowed || !emailRateLimit.allowed || !deviceRateLimit.allowed) {
    const retryAfterSeconds = ipRateLimit.retryAfterSeconds ?? subnetRateLimit.retryAfterSeconds ?? emailRateLimit.retryAfterSeconds ?? deviceRateLimit.retryAfterSeconds ?? 60
    return NextResponse.json(
      { error: "Too many registration attempts. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    )
  }

  const assessment = assessRegistration({
    email: emailAddress,
    ipAddress,
    userAgent,
    acceptLanguage: request.headers.get("accept-language") ?? "",
    timezone: request.headers.get("x-timezone") ?? "",
    screen: request.headers.get("x-screen") ?? "",
    honeypot: body.website,
    recentAttempts,
    deviceAccountCount: recentAttempts,
  })
  const attempt = await atRegistrationStage("registration_attempt_save", () => recordRegistrationAttempt({
    emailHash: assessment.emailHash,
    deviceFingerprint: assessment.deviceFingerprint,
    ipHash: assessment.ipHash,
    trustScore: assessment.trustScore,
    decision: assessment.decision,
    failureReason: assessment.failureReason,
    riskFactors: assessment.riskFactors,
    createdAt: new Date().toISOString(),
  }))

  if (assessment.decision === "rejected") {
    return NextResponse.json({ error: "Unable to complete registration.", attemptId: attempt.id }, { status: 400 })
  }
  if (assessment.decision !== "approved") {
    return NextResponse.json(
      { message: assessment.decision === "review" ? "Your registration is awaiting review." : "Additional verification is required.", attemptId: attempt.id },
      { status: 202 },
    )
  }

  const { user, error } = await atRegistrationStage("user_save", () => createUser({
    email: emailAddress,
    password,
    firstName,
    lastName,
    mobile,
  }))

  if (!user || error) {
    return NextResponse.json({ error: error ?? "Unable to create your account." }, { status: 400 })
  }

  const appOrigin = new URL(request.url).origin
  const verification = await atRegistrationStage("verification_setup", () => sendVerificationForUser(user.email, appOrigin))

  return NextResponse.json(
    {
      user,
      requiresVerification: true,
      developmentVerificationUrl: process.env.NODE_ENV === "production" ? undefined : verification.verificationUrl,
      verificationDelivery: verification.delivery?.status ?? null,
    },
    { status: 201 },
  )
}

export async function POST(request: Request) {
  try {
    return await handleRegistration(request)
  } catch (error) {
    const cause =
      typeof error === "object" && error !== null && "cause" in error
        ? Reflect.get(error, "cause")
        : error
    const registrationStage =
      typeof error === "object" && error !== null && "registrationStage" in error
        ? Reflect.get(error, "registrationStage")
        : "request"
    const code =
      typeof cause === "object" && cause !== null && "code" in cause
        ? Reflect.get(cause, "code")
        : undefined
    const safeCode = typeof code === "string" || typeof code === "number"
      ? String(code)
      : cause instanceof Error
        ? cause.name
        : "UnknownError"

    console.error("Registration request failed.", {
      stage: typeof registrationStage === "string" ? registrationStage : "unknown",
      code: safeCode,
    })
    return NextResponse.json(
      { error: "We couldn't complete registration because of a server problem. Please try again shortly." },
      { status: 500 },
    )
  }
}