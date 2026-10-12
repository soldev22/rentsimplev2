import { NextResponse } from "next/server"

import { validateCrmContactUpdate } from "@/lib/crm"
import { getSessionUser } from "@/lib/server/session"
import { canManageCrm, updateCrmContact } from "@/lib/server/crm"

const conflictMessage = "This contact has changed since you opened it. Refresh before saving."

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!canManageCrm(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const origin = request.headers.get("origin")
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const { id } = await params
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid contact ID." }, { status: 400 })
    const text = await request.text()
    if (text.length > 6000) return NextResponse.json({ error: "Request is too large." }, { status: 413 })
    let body: unknown
    try { body = JSON.parse(text) } catch {
      return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 })
    }
    const input = validateCrmContactUpdate(body)
    if (!input.ok) return NextResponse.json({ error: "Check the highlighted contact details.", errors: input.errors }, { status: 400 })
    const result = await updateCrmContact(user, id, input.value)
    if (result.kind === "not_found") return NextResponse.json({ error: "CRM contact not found." }, { status: 404 })
    if (result.kind === "conflict") return NextResponse.json({ error: conflictMessage }, { status: 409 })
    if (result.kind === "unchanged") return NextResponse.json({ error: "Change a contact detail or the note before saving." }, { status: 400 })
    return NextResponse.json({ contact: result.contact, warning: result.warning })
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined
    if (code === 412) return NextResponse.json({ error: conflictMessage }, { status: 409 })
    if (code === 404) return NextResponse.json({ error: "CRM contact not found." }, { status: 404 })
    console.error("CRM contact update failed.", { errorName: error instanceof Error ? error.name : "UnknownError" })
    return NextResponse.json({ error: "Unable to update the CRM contact." }, { status: 500 })
  }
}
