import { NextResponse } from "next/server"

import { isRecord, validateMeetingRequestUpdate } from "@/lib/meeting-requests"
import { getSessionUser } from "@/lib/server/session"
import { canManageMeetingRequests, deleteMeetingRequest, updateMeetingRequest } from "@/lib/server/meeting-requests"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!canManageMeetingRequests(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const origin = request.headers.get("origin")
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const { id } = await params
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid request ID." }, { status: 400 })
    const text = await request.text()
    if (text.length > 6000) return NextResponse.json({ error: "Request is too large." }, { status: 413 })
    let body: unknown
    try { body = JSON.parse(text) } catch {
      return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 })
    }

    const input = validateMeetingRequestUpdate(body)
    if (!input) return NextResponse.json({ error: "Choose a valid status and enter a note of at most 2000 characters." }, { status: 400 })
    const result = await updateMeetingRequest(user, id, input)
    if (result.kind === "not_found") return NextResponse.json({ error: "Meeting request not found." }, { status: 404 })
    if (result.kind === "conflict") return NextResponse.json({ error: "This request has changed. Refresh before saving." }, { status: 409 })
    if (result.kind === "unchanged") return NextResponse.json({ error: "Change the status or add a note before saving." }, { status: 400 })
    return NextResponse.json({ request: result.request, warning: result.warning })
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined
    if (code === 412) return NextResponse.json({ error: "This request has changed. Refresh before saving." }, { status: 409 })
    if (code === 404) return NextResponse.json({ error: "Meeting request not found." }, { status: 404 })
    console.error("Meeting request update failed.", { errorName: error instanceof Error ? error.name : "UnknownError" })
    return NextResponse.json({ error: "Unable to update the meeting request." }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!canManageMeetingRequests(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const origin = request.headers.get("origin")
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const { id } = await params
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid request ID." }, { status: 400 })
    const text = await request.text()
    if (text.length > 1000) return NextResponse.json({ error: "Request is too large." }, { status: 413 })
    let body: unknown
    try { body = JSON.parse(text) } catch {
      return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 })
    }
    if (!isRecord(body) || typeof body.expectedUpdatedAt !== "string" || !body.expectedUpdatedAt.trim()) {
      return NextResponse.json({ error: "The request version is required." }, { status: 400 })
    }
    const result = await deleteMeetingRequest(user, id, body.expectedUpdatedAt)
    if (result.kind === "not_found") return NextResponse.json({ error: "Meeting request not found." }, { status: 404 })
    if (result.kind === "conflict") return NextResponse.json({ error: "This request has changed. Refresh before deleting." }, { status: 409 })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined
    if (code === 412) return NextResponse.json({ error: "This request has changed. Refresh before deleting." }, { status: 409 })
    if (code === 404) return NextResponse.json({ error: "Meeting request not found." }, { status: 404 })
    console.error("Meeting request deletion failed.", { errorName: error instanceof Error ? error.name : "UnknownError" })
    return NextResponse.json({ error: "Unable to delete the meeting request." }, { status: 500 })
  }
}
