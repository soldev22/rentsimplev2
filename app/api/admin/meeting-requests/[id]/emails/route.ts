import { NextResponse } from "next/server"
import { validateMeetingEmail } from "@/lib/meeting-requests"
import { getSessionUser } from "@/lib/server/session"
import { canManageMeetingRequests } from "@/lib/server/meeting-requests"
import { MeetingEmailError, sendMeetingEmail } from "@/lib/server/meeting-email"
import { registerRateLimitAttempt } from "@/lib/server/auth-security"
import { hashRegistrationIdentifier } from "@/lib/server/registration-authenticity"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!canManageMeetingRequests(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const origin = request.headers.get("origin")
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const { id } = await params
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid meeting ID." }, { status: 400 })
    if (!request.headers.get("content-type")?.includes("application/json")) return NextResponse.json({ error: "Send a JSON request." }, { status: 415 })
    const text = await request.text()
    if (text.length > 65000) return NextResponse.json({ error: "Email request is too large." }, { status: 413 })
    let body: unknown
    try { body = JSON.parse(text) } catch {
      return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 })
    }
    const input = validateMeetingEmail(body)
    if (!input) return NextResponse.json({ error: "Enter a subject of up to 200 characters and a message of up to 10000 characters." }, { status: 400 })
    const limit = await registerRateLimitAttempt({
      action: "meeting_email", scope: "email", identifier: hashRegistrationIdentifier(user.email),
      maxAttempts: 20, windowMs: 60 * 60 * 1000,
    })
    if (!limit.allowed) return NextResponse.json({ error: "Too many meeting emails. Please wait before sending another." }, {
      status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds ?? 60) },
    })
    const message = await sendMeetingEmail(user, id, input)
    return NextResponse.json({ message })
  } catch (error) {
    if (error instanceof MeetingEmailError) {
      const status = { not_found: 404, conflict: 409, configuration: 503, thread_full: 409, invalid: 400 }[error.code]
      return NextResponse.json({ error: error.message }, { status })
    }
    console.error("Meeting email send failed.", { errorName: error instanceof Error ? error.name : "UnknownError" })
    return NextResponse.json({ error: "Unable to confirm email delivery. Refresh the thread before trying again." }, { status: 500 })
  }
}
