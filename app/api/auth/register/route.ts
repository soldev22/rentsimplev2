import { NextResponse } from "next/server"

import { getClientIpAddress, registerRateLimitAttempt } from "@/lib/server/auth-security"
import { assessRegistration, getDeviceFingerprint, hashRegistrationIdentifier } from "@/lib/server/registration-authenticity"
import { countRecentRegistrationAttempts, recordRegistrationAttempt } from "@/lib/server/registration-attempts"
import { createUser, sendVerificationForUser } from "@/lib/server/users"

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string
    password?: string
    firstName?: string
    lastName?: string
    mobile?: string
    accountType?: "applicant"
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
    registerRateLimitAttempt({
      action: "register",
      scope: "ip",
      identifier: ipHash,
      maxAttempts: 10,
      windowMs: 1000 * 60 * 60,
    }),
    registerRateLimitAttempt({
      action: "register",
      scope: "ip",
      identifier: hashRegistrationIdentifier(`subnet:${subnet}`),
      maxAttempts: 30,
      windowMs: 1000 * 60 * 60,
    }),
    registerRateLimitAttempt({
      action: "register",
      scope: "email",
      identifier: emailAddress,
      maxAttempts: 3,
      windowMs: 1000 * 60 * 60,
    }),
    registerRateLimitAttempt({
      action: "register",
      scope: "device",
      identifier: [userAgent, request.headers.get("accept-language") ?? "", request.headers.get("x-timezone") ?? ""].join("|"),
      maxAttempts: 5,
      windowMs: 1000 * 60 * 60,
    }),
    countRecentRegistrationAttempts({
      ipHash,
      deviceFingerprint,
      since: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    }),
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
  const attempt = await recordRegistrationAttempt({
    emailHash: assessment.emailHash,
    deviceFingerprint: assessment.deviceFingerprint,
    ipHash: assessment.ipHash,
    trustScore: assessment.trustScore,
    decision: assessment.decision,
    failureReason: assessment.failureReason,
    riskFactors: assessment.riskFactors,
    createdAt: new Date().toISOString(),
  })

  if (assessment.decision === "rejected") {
    return NextResponse.json({ error: "Unable to complete registration.", attemptId: attempt.id }, { status: 400 })
  }
  if (assessment.decision !== "approved") {
    return NextResponse.json(
      { message: assessment.decision === "review" ? "Your registration is awaiting review." : "Additional verification is required.", attemptId: attempt.id },
      { status: 202 },
    )
  }

  const { user, error } = await createUser({
    email: body.email,
    password: body.password,
    firstName: body.firstName,
    lastName: body.lastName,
    mobile: body.mobile ?? "",
    requestedRole: body.accountType === "applicant" ? "applicant" : undefined,
  })

  if (!user || error) {
    return NextResponse.json({ error: error ?? "Unable to create your account." }, { status: 400 })
  }

  const appOrigin = new URL(request.url).origin
  const verification = await sendVerificationForUser(user.email, appOrigin)

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