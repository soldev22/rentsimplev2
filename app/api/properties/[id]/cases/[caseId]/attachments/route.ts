import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/server/session"
import { canManageProperties } from "@/lib/auth"
import { getPropertyForUser } from "@/lib/server/properties"
import { getCaseById, getCaseAttachmentsByCaseId, saveCaseAttachmentToDb } from "@/lib/server/cases"
import { uploadCaseAttachment } from "@/lib/server/blob"
import { writeAuditEvent } from "@/lib/server/audit"
import { AUDIT_ACTION_TYPES } from "@/lib/types/audit"
import { randomUUID } from "node:crypto"
import type { CaseAttachment } from "@/lib/types/case"

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

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // Upload to blob storage
    const { blobName, url, size } = await uploadCaseAttachment({
      caseId,
      fileName: file.name,
      fileBuffer: buffer,
      mimeType: file.type,
      uploadedBy: user.email,
    })

    // Create attachment metadata
    const attachmentId = randomUUID()
    const attachment: CaseAttachment = {
      id: attachmentId,
      fileName: file.name,
      fileType: file.type,
      url,
      uploadedAt: new Date().toISOString(),
      uploadedBy: user.email,
      size,
    }

    const saved = await saveCaseAttachmentToDb(attachment)

    // Update case attachment count
    case_.attachmentCount = (case_.attachmentCount || 0) + 1
    case_.updatedAt = new Date().toISOString()

    // Write audit event
    await writeAuditEvent({
      entityType: "case_attachment",
      entityId: caseId,
      action: AUDIT_ACTION_TYPES.EXECUTED_BY_SYSTEM,
      fieldPath: "attachments",
      oldValue: { count: (case_.attachmentCount || 1) - 1 },
      newValue: { count: case_.attachmentCount },
      performedBy: user.email,
      metadata: {
        propertyId,
        fileName: file.name,
        fileSize: size,
        fileType: file.type,
        blobName,
      },
    })

    return NextResponse.json(saved, { status: 201 })
  } catch (error) {
    console.error("Error uploading attachment:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
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

    const attachments = await getCaseAttachmentsByCaseId(caseId)
    return NextResponse.json(attachments)
  } catch (error) {
    console.error("Error fetching attachments:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
