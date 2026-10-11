import { NextResponse } from "next/server"

import { validateMeetingRequest } from "@/lib/meeting-requests"
import { getClientIpAddress, registerRateLimitAttempt } from "@/lib/server/auth-security"
import { hashRegistrationIdentifier } from "@/lib/server/registration-authenticity"
import { createMeetingRequest } from "@/lib/server/meeting-requests"
import { sendMeetingRequestNotifications } from "@/lib/server/meeting-request-notifications"

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Send a JSON request." }, { status: 415 })
  }
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  try {
    const ipLimit = await registerRateLimitAttempt({
      action: "meeting_request", scope: "ip", identifier: hashRegistrationIdentifier(getClientIpAddress(request)),
      maxAttempts: 5, windowMs: 60 * 60 * 1000,
    })
    if (!ipLimit.allowed) return NextResponse.json(
      { error: "Too many meeting requests. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds ?? 60) } },
    )
    const text = await request.text()
    if (text.length > 16000) return NextResponse.json({ error: "Request is too large." }, { status: 413 })
    let body: unknown
    try { body = JSON.parse(text) } catch {
      return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 })
    }
    const validation = validateMeetingRequest(body)
    if (!validation.success) return NextResponse.json({ error: "Please check your details.", errors: validation.errors }, { status: 400 })
    const emailLimit = await registerRateLimitAttempt({
      action: "meeting_request", scope: "email", identifier: hashRegistrationIdentifier(validation.data.email),
      maxAttempts: 3, windowMs: 60 * 60 * 1000,
    })
    if (!emailLimit.allowed) return NextResponse.json(
      { error: "Too many meeting requests. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(emailLimit.retryAfterSeconds ?? 60) } },
    )
    const record = await createMeetingRequest(validation.data)
    let confirmationSent = false
    try {
      const delivery = await sendMeetingRequestNotifications(record)
      confirmationSent = delivery.confirmationSent
    } catch (error) {
      console.error("Stored meeting request notification failed.", { requestId: record.id, errorName: error instanceof Error ? error.name : "UnknownError" })
    }
    return NextResponse.json({
      id: record.id, confirmationSent,
      message: confirmationSent
        ? "Your meeting request has been received. We'll contact you to agree a date and time. Check your email for confirmation."
        : "Your meeting request has been received. We'll contact you to agree a date and time. We couldn't send the confirmation email, but your request is safely stored.",
    }, { status: 201 })
  } catch (error) {
    console.error("Meeting request failed.", { errorName: error instanceof Error ? error.name : "UnknownError" })
    return NextResponse.json({ error: "Unable to save your meeting request. Please try again shortly." }, { status: 500 })
  }
}
