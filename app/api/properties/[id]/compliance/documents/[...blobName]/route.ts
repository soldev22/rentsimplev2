import { Readable } from "node:stream"

import { NextResponse } from "next/server"

import { getPropertyForUser } from "@/lib/server/properties"
import { updatePropertyCompliance } from "@/lib/server/properties"
import { getSessionUser } from "@/lib/server/session"
import { getBlobServiceClient } from "@/lib/server/blob"
import { canManageProperties, type ComplianceDocument } from "@/lib/auth"

const complianceDocumentsContainerName =
  process.env.COMPLIANCE_DOCUMENTS_CONTAINER?.trim() || "compliance-documents"

type RouteContext = {
  params: Promise<{ id: string; blobName: string[] }>
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: propertyId, blobName: blobNameParts } = await context.params
  const blobName = blobNameParts.join("/")
  const expectedPrefix = `properties/${propertyId}/compliance/`
  if (!blobName.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "Invalid compliance document path" }, { status: 400 })
  }

  const property = await getPropertyForUser(user, propertyId)
  if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 })

  try {
    const containerClient = getBlobServiceClient().getContainerClient(complianceDocumentsContainerName)
    const download = await containerClient.getBlobClient(blobName).download()
    if (!download.readableStreamBody) throw new Error("Blob stream unavailable")

    return new NextResponse(Readable.toWeb(download.readableStreamBody as Readable) as ReadableStream, {
      headers: {
        "Content-Type": download.contentType || "application/octet-stream",
        ...(typeof download.contentLength === "number" ? { "Content-Length": String(download.contentLength) } : null),
        "Content-Disposition": `inline; filename="${blobName.split("/").pop() ?? "certificate"}"`,
      },
    })
  } catch (error) {
    console.error("Error downloading compliance document:", error)
    return NextResponse.json({ error: "Compliance document not found" }, { status: 404 })
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManageProperties(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id: propertyId, blobName: blobNameParts } = await context.params
  const blobName = blobNameParts.join("/")
  const expectedPrefix = `properties/${propertyId}/compliance/`
  if (!blobName.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "Invalid compliance document path" }, { status: 400 })
  }

  const body = await request.json() as { complianceId?: string }
  if (!body.complianceId) return NextResponse.json({ error: "complianceId is required" }, { status: 400 })

  const property = await getPropertyForUser(user, propertyId)
  if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 })

  const compliance = property.compliance?.find((item) => item.id === body.complianceId)
  if (!compliance) return NextResponse.json({ error: "Compliance record not found" }, { status: 404 })

  const documents: ComplianceDocument[] = compliance.documents ?? (compliance.documentUrl
    ? [{ url: compliance.documentUrl, fileName: "Certificate", uploadedAt: "" }]
    : [])
  const document = documents.find((item) => item.blobName === blobName || item.url.includes(blobName))
  if (!document) return NextResponse.json({ error: "Certificate not found" }, { status: 404 })

  const remainingDocuments = documents.filter((item) => item !== document)
  const updated = await updatePropertyCompliance(user, propertyId, compliance.id, {
    ...compliance,
    documents: remainingDocuments,
    documentUrl: remainingDocuments.at(-1)?.url,
  })
  if (!updated) return NextResponse.json({ error: "Property not found" }, { status: 404 })

  try {
    const containerClient = getBlobServiceClient().getContainerClient(complianceDocumentsContainerName)
    await containerClient.deleteBlob(blobName, { deleteSnapshots: "include" })
  } catch (error) {
    console.error("Compliance record updated but certificate Blob could not be deleted:", error)
  }

  return NextResponse.json({ property: updated })
}