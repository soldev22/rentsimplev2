import { NextResponse } from "next/server"

import { getClientIpAddress, registerRateLimitAttempt } from "@/lib/server/auth-security"
import { createUser, sendVerificationForUser } from "@/lib/server/users"

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string
    password?: string
    firstName?: string
    lastName?: string
    mobile?: string
    accountType?: "applicant"
  }

  if (!body.email?.trim() || !body.password || !body.firstName?.trim() || !body.lastName?.trim()) {
    return NextResponse.json(
      { error: "First name, last name, email, and password are required." },
      { status: 400 },
    )
  }

  const ipAddress = getClientIpAddress(request)
  const emailAddress = body.email.trim().toLowerCase()
  const [ipRateLimit, emailRateLimit] = await Promise.all([
    registerRateLimitAttempt({
      action: "register",
      scope: "ip",
      identifier: ipAddress,
      maxAttempts: 10,
      windowMs: 1000 * 60 * 60,
    }),
    registerRateLimitAttempt({
      action: "register",
      scope: "email",
      identifier: emailAddress,
      maxAttempts: 3,
      windowMs: 1000 * 60 * 60,
    }),
  ])

  if (!ipRateLimit.allowed || !emailRateLimit.allowed) {
    const retryAfterSeconds = ipRateLimit.retryAfterSeconds ?? emailRateLimit.retryAfterSeconds ?? 60
    return NextResponse.json(
      { error: "Too many registration attempts. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
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