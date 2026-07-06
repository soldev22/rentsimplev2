import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/server/session"
import { canManageProperties } from "@/lib/auth"
import { getPropertyForUser } from "@/lib/server/properties"
import { getCaseById, getCaseAttachmentById, deleteCaseAttachmentMetadata } from "@/lib/server/cases"
import { downloadCaseAttachment, deleteCaseAttachment } from "@/lib/server/blob"
import { writeAuditEvent } from "@/lib/server/audit"
import { AUDIT_ACTION_TYPES } from "@/lib/types/audit"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; caseId: string; attachmentId: string }> }
) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: propertyId, caseId, attachmentId } = await params
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

    const attachment = await getCaseAttachmentById(attachmentId, caseId)
    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 })
    }

    // Download from blob storage using the URL as reference
    // In production, you'd extract blobName from metadata or store it
    // For now, we'll return a redirect to the blob URL
    return NextResponse.redirect(attachment.url)
  } catch (error) {
    console.error("Error downloading attachment:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; caseId: string; attachmentId: string }> }
) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: propertyId, caseId, attachmentId } = await params
    const property = await getPropertyForUser(user, propertyId)

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    const case_ = await getCaseById(caseId, propertyId)
    if (!case_) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 })
    }

    const attachment = await getCaseAttachmentById(attachmentId, caseId)
    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 })
    }

    // Only allow deletion by uploader or property manager
    const isUploader = attachment.uploadedBy === user.email
    const isPropertyManager = canManageProperties(user)

    if (!isUploader && !isPropertyManager) {
      return NextResponse.json({ error: "Forbidden: can only delete own uploads" }, { status: 403 })
    }

    // Mark metadata as deleted (soft delete)
    await deleteCaseAttachmentMetadata(attachment)

    // Write audit event
    await writeAuditEvent({
      entityType: "case_attachment",
      entityId: caseId,
      action: AUDIT_ACTION_TYPES.EXECUTED_BY_SYSTEM,
      fieldPath: "attachment_deleted",
      oldValue: { fileName: attachment.fileName, uploadedBy: attachment.uploadedBy },
      newValue: { deleted: true, deletedAt: new Date().toISOString() },
      performedBy: user.email,
      metadata: {
        propertyId,
        attachmentId,
        fileName: attachment.fileName,
        originalUploader: attachment.uploadedBy,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting attachment:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
