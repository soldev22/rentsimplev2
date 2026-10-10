import { NextResponse } from "next/server"

import { registerRateLimitAttempt } from "@/lib/server/auth-security"
import { getSessionUser } from "@/lib/server/session"
import { requestEmailChange, type EmailChangeErrorCode } from "@/lib/server/users"

const ERROR_RESPONSES: Record<EmailChangeErrorCode, { message: string; status: number }> = {
  InvalidEmail: { message: "Enter a valid email address.", status: 400 },
  SameEmail: { message: "That is already your account email.", status: 400 },
  EmailAlreadyInUse: { message: "That email address is already used by another account.", status: 409 },
  InvalidPassword: { message: "Your current password is incorrect.", status: 401 },
  PasswordNotSet: { message: "Set a password on your account before changing your email.", status: 400 },
}

export async function POST(request: Request) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "You must be signed in to change your email." }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    newEmail?: string
    currentPassword?: string
  }

  if (!body.newEmail?.trim() || !body.currentPassword) {
    return NextResponse.json({ error: "New email and current password are required." }, { status: 400 })
  }

  const rateLimit = await registerRateLimitAttempt({
    action: "change_email",
    scope: "email",
    identifier: user.id,
    maxAttempts: 5,
    windowMs: 1000 * 60 * 60,
  })

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many email change attempts. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds ?? 60) } },
    )
  }

  const result = await requestEmailChange(
    user,
    { newEmail: body.newEmail, currentPassword: body.currentPassword },
    new URL(request.url).origin,
  )

  if (result.error) {
    const response = ERROR_RESPONSES[result.error]
    return NextResponse.json({ error: response.message }, { status: response.status })
  }

  const delivered = result.delivery?.status === "sent"

  return NextResponse.json({
    message: delivered
      ? "Check your new inbox for a confirmation link. Your email won't change until you confirm it."
      : "We couldn't send the confirmation email. Please try again later.",
    deliveryStatus: result.delivery?.status ?? "failed",
    developmentVerificationUrl: process.env.NODE_ENV === "production" ? undefined : result.confirmationUrl,
  })
}
