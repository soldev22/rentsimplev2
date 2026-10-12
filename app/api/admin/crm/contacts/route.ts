import { NextResponse } from "next/server"

import { validateCrmContactInput } from "@/lib/crm"
import { getSessionUser } from "@/lib/server/session"
import { canManageCrm, createCrmContact, listCrmContacts } from "@/lib/server/crm"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!canManageCrm(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    return NextResponse.json({ contacts: await listCrmContacts(user) })
  } catch (error) {
    console.error("CRM contact list failed.", { errorName: error instanceof Error ? error.name : "UnknownError" })
    return NextResponse.json({ error: "Unable to load CRM contacts." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!canManageCrm(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const origin = request.headers.get("origin")
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const text = await request.text()
    if (text.length > 6000) return NextResponse.json({ error: "Request is too large." }, { status: 413 })
    let body: unknown
    try { body = JSON.parse(text) } catch {
      return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 })
    }
    const input = validateCrmContactInput(body)
    if (!input.ok) return NextResponse.json({ error: "Check the highlighted contact details.", errors: input.errors }, { status: 400 })
    const result = await createCrmContact(user, input.value)
    if (result.kind === "duplicate") {
      return NextResponse.json({ error: "A CRM contact with this email already exists. Edit the existing contact instead.", id: result.id }, { status: 409 })
    }
    return NextResponse.json({ contact: result.contact, warning: result.warning }, { status: 201 })
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined
    if (code === 409) return NextResponse.json({ error: "A CRM contact with this email already exists. Edit the existing contact instead." }, { status: 409 })
    console.error("CRM contact creation failed.", { errorName: error instanceof Error ? error.name : "UnknownError" })
    return NextResponse.json({ error: "Unable to add the CRM contact." }, { status: 500 })
  }
}
