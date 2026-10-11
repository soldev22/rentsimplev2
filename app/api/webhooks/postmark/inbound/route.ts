import { NextResponse } from "next/server"
import { isPostmarkInboundAuthenticated, MeetingEmailError, parseInboundMeetingEmail, receiveMeetingEmail } from "@/lib/server/meeting-email"

export const runtime = "nodejs"
const MAX_WEBHOOK_BYTES = 10 * 1024 * 1024

export async function POST(request: Request) {
  if ((process.env.POSTMARK_INBOUND_WEBHOOK_SECRET?.trim().length ?? 0) < 32) {
    console.error("Postmark inbound webhook secret is not configured.")
    return NextResponse.json({ error: "Inbound email is not configured." }, { status: 503 })
  }
  if (!isPostmarkInboundAuthenticated(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Send a JSON webhook." }, { status: 415 })
  }
  try {
    const reader = request.body?.getReader()
    if (!reader) return NextResponse.json({ error: "Empty webhook." }, { status: 400 })
    const chunks: Uint8Array[] = []
    let size = 0
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_WEBHOOK_BYTES) {
        await reader.cancel()
        console.warn("Postmark inbound webhook exceeds the size limit.")
        return NextResponse.json({ error: "Webhook is too large." }, { status: 413 })
      }
      chunks.push(value)
    }
    let body: unknown
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")) } catch {
      return NextResponse.json({ error: "Invalid JSON webhook." }, { status: 400 })
    }
    const input = parseInboundMeetingEmail(body)
    if (!input) {
      console.warn("Postmark inbound email rejected: invalid payload or unrelated recipient.")
      return NextResponse.json({ error: "Unsupported meeting email." }, { status: 403 })
    }
    const result = await receiveMeetingEmail(input)
    return NextResponse.json({ received: true, duplicate: result.duplicate })
  } catch (error) {
    if (error instanceof MeetingEmailError && (error.code === "invalid" || error.code === "not_found")) {
      console.warn("Postmark inbound email rejected.", { reason: error.code })
      return NextResponse.json({ error: "Meeting reply could not be matched." }, { status: 403 })
    }
    console.error("Postmark inbound email could not be stored.", { errorName: error instanceof Error ? error.name : "UnknownError" })
    // Postmark retries temporary failures; never acknowledge a reply that was not saved.
    return NextResponse.json({ error: "Unable to store the reply. Please retry." }, { status: 503 })
  }
}
