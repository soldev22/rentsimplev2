import { NextRequest, NextResponse } from "next/server"

import { getSessionUser } from "@/lib/server/session"
import { canManageProperties } from "@/lib/auth"
import { getPropertyForUser } from "@/lib/server/properties"
import { getBlobServiceClient } from "@/lib/server/blob"

const complianceDocumentsContainerName =
  process.env.COMPLIANCE_DOCUMENTS_CONTAINER?.trim() || "compliance-documents"

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
]

const MAX_FILE_SIZE = 10 * 1024 * 1024

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-")
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!canManageProperties(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const { id: propertyId } = await context.params
    const property = await getPropertyForUser(user, propertyId)

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const type = formData.get("type") as string | null

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "A file upload is required." }, { status: 400 })
    }

    if (!type) {
      return NextResponse.json({ error: "Compliance type is required." }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File size exceeds maximum of 10MB." }, { status: 400 })
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "File type not allowed." }, { status: 400 })
    }

    const blobServiceClient = getBlobServiceClient()
    const containerClient = blobServiceClient.getContainerClient(complianceDocumentsContainerName)
    await containerClient.createIfNotExists()

    const timestamp = Date.now()
    const blobName = `properties/${propertyId}/compliance/${type}/${timestamp}-${sanitizeFileName(file.name)}`
    const blobClient = containerClient.getBlockBlobClient(blobName)
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    await blobClient.uploadData(fileBuffer, {
      blobHTTPHeaders: {
        blobContentType: file.type || "application/octet-stream",
      },
    })

    return NextResponse.json({ url: blobClient.url, blobName }, { status: 201 })
  } catch (error) {
    console.error("Error uploading compliance document:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to upload compliance document." },
      { status: 500 },
    )
  }
}
