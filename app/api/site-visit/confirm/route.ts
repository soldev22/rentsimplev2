import { NextResponse } from "next/server"

import { getSiteVisitMeetingConsentContext, recordSiteVisitMeetingDecision } from "@/lib/server/applications"
import { consumeAuthChallenge } from "@/lib/server/auth-security"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token")?.trim()

  if (!token) {
    return NextResponse.json({ error: "Confirmation token is required." }, { status: 400 })
  }

  const result = await getSiteVisitMeetingConsentContext(token)

  if (result.error === "InvalidToken") {
    return NextResponse.json({ error: "This site visit link is invalid." }, { status: 400 })
  }

  if (result.error === "ApplicationNotFound" || result.error === "RequestNotFound") {
    return NextResponse.json({ error: "This site visit request is no longer available." }, { status: 404 })
  }

  if (result.error || !result.context) {
    return NextResponse.json({ error: "Unable to load site visit details." }, { status: 500 })
  }

  return NextResponse.json({ context: result.context })
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        token?: string
        decision?: "agree" | "decline"
        alternativeSuggestedAt?: string
      }
    | null

  const token = body?.token?.trim()
  const decision = body?.decision === "decline" ? "decline" : "agree"
  const alternativeSuggestedAt =
    decision === "decline" && typeof body?.alternativeSuggestedAt === "string" && body.alternativeSuggestedAt.trim().length > 0
      ? body.alternativeSuggestedAt.trim()
      : undefined

  if (!token) {
    return NextResponse.json({ error: "Confirmation token is required." }, { status: 400 })
  }

  const consumed = await consumeAuthChallenge("site_visit_confirmation", token)

  if (consumed.error || !consumed.email || !consumed.applicationId || !consumed.requestId) {
    return NextResponse.json({ error: "This site visit link is invalid or has expired." }, { status: 400 })
  }

  const result = await recordSiteVisitMeetingDecision({
    applicationId: consumed.applicationId,
    requestId: consumed.requestId,
    responderEmail: consumed.email,
    decision,
    alternativeSuggestedAt,
  })

  if (result.error === "ApplicationNotFound" || result.error === "RequestNotFound") {
    return NextResponse.json({ error: "This site visit request is no longer available." }, { status: 404 })
  }

  if (result.error) {
    return NextResponse.json({ error: "Unable to record site visit response." }, { status: 500 })
  }

  const alreadyRespondedMessage =
    result.existingStatus === "declined"
      ? "Your site visit response has already been recorded as declined."
      : "Your site visit confirmation has already been recorded."

  const successMessage =
    decision === "decline"
      ? "Your response has been recorded. You have declined this proposed meeting time."
      : "Thank you. Your site visit meeting confirmation has been recorded."

  return NextResponse.json({
    message: result.alreadyResponded ? alreadyRespondedMessage : successMessage,
    alreadyResponded: result.alreadyResponded,
  })
}
