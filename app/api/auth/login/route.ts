import { NextResponse } from "next/server"

import { createSession } from "@/lib/server/session"
import { getClientIpAddress, registerRateLimitAttempt } from "@/lib/server/auth-security"
import { authenticateUser } from "@/lib/server/users"

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string
    password?: string
  }

  if (!body.email?.trim() || !body.password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 })
  }

  const ipAddress = getClientIpAddress(request)
  const emailAddress = body.email.trim().toLowerCase()
  const [ipRateLimit, emailRateLimit] = await Promise.all([
    registerRateLimitAttempt({
      action: "login",
      scope: "ip",
      identifier: ipAddress,
      maxAttempts: 20,
      windowMs: 1000 * 60 * 15,
    }),
    registerRateLimitAttempt({
      action: "login",
      scope: "email",
      identifier: emailAddress,
      maxAttempts: 10,
      windowMs: 1000 * 60 * 15,
    }),
  ])

  if (!ipRateLimit.allowed || !emailRateLimit.allowed) {
    const retryAfterSeconds = ipRateLimit.retryAfterSeconds ?? emailRateLimit.retryAfterSeconds ?? 60
    return NextResponse.json(
      { error: "Too many sign-in attempts. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    )
  }

  const { user, error, errorCode, retryAfterSeconds } = await authenticateUser({
    email: body.email,
    password: body.password,
  })

  if (!user || error) {
    const status = errorCode === "AccountLocked" ? 423 : errorCode === "EmailVerificationRequired" ? 403 : 401
    return NextResponse.json(
      { error: error ?? "Unable to sign you in.", errorCode, retryAfterSeconds },
      status === 423 && retryAfterSeconds
        ? { status, headers: { "Retry-After": String(retryAfterSeconds) } }
        : { status },
    )
  }

  await createSession(user.email)

  return NextResponse.json({ user })
}