import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/server/session"
import { canManageProperties } from "@/lib/auth"
import { getPropertyForUser } from "@/lib/server/properties"
import { getCaseById, getCaseMessageById, saveCaseMessageToDb } from "@/lib/server/cases"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; caseId: string; messageId: string }> }
) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: propertyId, caseId, messageId } = await params
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

    const message = await getCaseMessageById(messageId, caseId)
    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    // Mark as read for current user
    const alreadyRead = message.readBy.some((r) => r.email === user.email)
    if (!alreadyRead) {
      message.readBy.push({
        email: user.email,
        readAt: new Date().toISOString(),
      })
    }

    const updated = await saveCaseMessageToDb(message)
    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating message:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; caseId: string; messageId: string }> }
) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: propertyId, caseId, messageId } = await params
    const property = await getPropertyForUser(user, propertyId)

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    // Only allow deletion by message sender
    const message = await getCaseMessageById(messageId, caseId)
    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    if (message.senderEmail !== user.email && !canManageProperties(user)) {
      return NextResponse.json({ error: "Forbidden: can only delete own messages" }, { status: 403 })
    }

    // Soft delete - set content to "[deleted]"
    message.content = "[deleted by " + user.email + " at " + new Date().toISOString() + "]"
    await saveCaseMessageToDb(message)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting message:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
