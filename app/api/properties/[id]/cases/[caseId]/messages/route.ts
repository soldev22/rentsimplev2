import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/server/session"
import { canManageProperties, getDisplayName } from "@/lib/auth"
import { getPropertyForUser } from "@/lib/server/properties"
import { getCaseById, getCaseMessagesByCaseId, saveCaseMessageToDb } from "@/lib/server/cases"
import type { CaseMessage } from "@/lib/types/case"
import { randomUUID } from "node:crypto"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; caseId: string }> }
) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: propertyId, caseId } = await params
    const property = await getPropertyForUser(user, propertyId)

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    if (!canManageProperties(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const case_ = await getCaseById(caseId, propertyId)
    if (!case_) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 })
    }

    const body = await request.json()
    const { content, attachmentIds, senderRole } = body

    if (!content) {
      return NextResponse.json({ error: "Message content required" }, { status: 400 })
    }

    const message: CaseMessage = {
      id: randomUUID(),
      caseId,
      senderRole: senderRole || "landlord",
      senderEmail: user.email,
      senderName: getDisplayName(user) || user.email,
      content,
      attachmentIds: attachmentIds || [],
      readBy: [],
      createdAt: new Date().toISOString(),
    }

    const saved = await saveCaseMessageToDb(message)

    // Increment message count on case
    case_.messageCount = (case_.messageCount || 0) + 1
    case_.lastMessageAt = message.createdAt
    case_.updatedAt = message.createdAt

    return NextResponse.json(saved, { status: 201 })
  } catch (error) {
    console.error("Error creating message:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; caseId: string }> }
) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: propertyId, caseId } = await params
    const property = await getPropertyForUser(user, propertyId)

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    if (!canManageProperties(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const case_ = await getCaseById(caseId, propertyId)
    if (!case_) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 })
    }

    const messages = await getCaseMessagesByCaseId(caseId)

    // Mark all as read for current user
    const unreadMessages = messages.filter((m) => !m.readBy.some((r) => r.email === user.email))
    for (const msg of unreadMessages) {
      msg.readBy.push({
        email: user.email,
        readAt: new Date().toISOString(),
      })
      await saveCaseMessageToDb(msg)
    }

    return NextResponse.json(messages)
  } catch (error) {
    console.error("Error fetching messages:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
