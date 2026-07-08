import { NextResponse } from "next/server"

import { getGuarantorReferenceConsentContext, recordGuarantorReferenceDecision } from "@/lib/server/applications"
import { consumeAuthChallenge } from "@/lib/server/auth-security"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token")?.trim()

  if (!token) {
    return NextResponse.json({ error: "Consent token is required." }, { status: 400 })
  }

  const result = await getGuarantorReferenceConsentContext(token)

  if (result.error === "InvalidToken") {
    return NextResponse.json({ error: "This guarantor link is invalid." }, { status: 400 })
  }

  if (result.error === "ApplicationNotFound" || result.error === "RequestNotFound") {
    return NextResponse.json({ error: "This guarantor request is no longer available." }, { status: 404 })
  }

  if (result.error || !result.context) {
    return NextResponse.json({ error: "Unable to load guarantor details." }, { status: 500 })
  }

  return NextResponse.json({ context: result.context })
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        token?: string
        decision?: "agree" | "decline"
      }
    | null

  const token = body?.token?.trim()
  const decision = body?.decision === "decline" ? "decline" : "agree"

  if (!token) {
    return NextResponse.json({ error: "Consent token is required." }, { status: 400 })
  }

  const consumed = await consumeAuthChallenge("guarantor_reference", token)

  if (consumed.error || !consumed.email || !consumed.applicationId || !consumed.refereeId || !consumed.requestId) {
    return NextResponse.json({ error: "This guarantor link is invalid or has expired." }, { status: 400 })
  }

  const result = await recordGuarantorReferenceDecision({
    applicationId: consumed.applicationId,
    refereeId: consumed.refereeId,
    requestId: consumed.requestId,
    responderEmail: consumed.email,
    decision,
  })

  if (result.error === "ApplicationNotFound" || result.error === "RequestNotFound") {
    return NextResponse.json({ error: "This guarantor request is no longer available." }, { status: 404 })
  }

  if (result.error) {
    return NextResponse.json({ error: "Unable to record guarantor consent." }, { status: 500 })
  }

  const alreadyRespondedMessage =
    result.existingStatus === "declined"
      ? "Your guarantor response has already been recorded as declined."
      : "Your guarantor confirmation has already been recorded."

  const successMessage =
    decision === "decline"
      ? "Your response has been recorded. You have declined to act as guarantor."
      : "Thank you. Your guarantor confirmation has been recorded."

  return NextResponse.json({
    message: result.alreadyResponded ? alreadyRespondedMessage : successMessage,
    alreadyResponded: result.alreadyResponded,
  })
}
