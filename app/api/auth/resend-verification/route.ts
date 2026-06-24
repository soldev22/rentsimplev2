import { NextResponse } from "next/server"

import { getClientIpAddress, registerRateLimitAttempt } from "@/lib/server/auth-security"
import { sendVerificationForUser } from "@/lib/server/users"

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string
  }

  if (!body.email?.trim()) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 })
  }

  const ipAddress = getClientIpAddress(request)
  const emailAddress = body.email.trim().toLowerCase()
  const [ipRateLimit, emailRateLimit] = await Promise.all([
    registerRateLimitAttempt({
      action: "verify_request",
      scope: "ip",
      identifier: ipAddress,
      maxAttempts: 10,
      windowMs: 1000 * 60 * 60,
    }),
    registerRateLimitAttempt({
      action: "verify_request",
      scope: "email",
      identifier: emailAddress,
      maxAttempts: 5,
      windowMs: 1000 * 60 * 60,
    }),
  ])

  if (!ipRateLimit.allowed || !emailRateLimit.allowed) {
    const retryAfterSeconds = ipRateLimit.retryAfterSeconds ?? emailRateLimit.retryAfterSeconds ?? 60
    return NextResponse.json(
      { error: "Too many verification requests. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    )
  }

  const verification = await sendVerificationForUser(emailAddress, new URL(request.url).origin)

  return NextResponse.json({
    message: "If the account is awaiting verification, a new link has been sent.",
    developmentVerificationUrl: process.env.NODE_ENV === "production" ? undefined : verification.verificationUrl,
  })
}