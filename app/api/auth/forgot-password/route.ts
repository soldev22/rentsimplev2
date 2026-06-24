import { NextResponse } from "next/server"

import { getClientIpAddress, registerRateLimitAttempt } from "@/lib/server/auth-security"
import { requestPasswordReset } from "@/lib/server/users"

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
      action: "forgot_password",
      scope: "ip",
      identifier: ipAddress,
      maxAttempts: 10,
      windowMs: 1000 * 60 * 60,
    }),
    registerRateLimitAttempt({
      action: "forgot_password",
      scope: "email",
      identifier: emailAddress,
      maxAttempts: 5,
      windowMs: 1000 * 60 * 60,
    }),
  ])

  if (!ipRateLimit.allowed || !emailRateLimit.allowed) {
    const retryAfterSeconds = ipRateLimit.retryAfterSeconds ?? emailRateLimit.retryAfterSeconds ?? 60
    return NextResponse.json(
      { error: "Too many reset requests. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    )
  }

  const reset = await requestPasswordReset(emailAddress, new URL(request.url).origin)

  return NextResponse.json({
    message: "If an account exists for that email, a reset link has been sent.",
    developmentResetUrl: process.env.NODE_ENV === "production" ? undefined : reset.resetUrl,
  })
}