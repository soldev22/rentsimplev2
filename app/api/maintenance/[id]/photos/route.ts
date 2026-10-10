import "server-only"

import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"

import { getSessionUser } from "@/lib/server/session"
import { isPendingApproval, getUserRole } from "@/lib/auth"
import { getMaintenanceContainer } from "@/lib/server/cosmos"
import { uploadToBlob, getBlobUrl } from "@/lib/server/blob"
import { MAX_MAINTENANCE_UPDATE_PHOTO_SIZE } from "@/lib/types/maintenance"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPendingApproval(user)) {
    return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
  }

  try {
    const { id } = await context.params
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > MAX_MAINTENANCE_UPDATE_PHOTO_SIZE || file.size === 0) {
      return NextResponse.json({ error: "Use a JPEG, PNG, or WebP image smaller than 10 MB." }, { status: 400 })
    }

    // Get the issue to verify access
    const container = await getMaintenanceContainer()
    const { resources } = await container.items
      .query({
        query: "SELECT c.id, c.propertyId, c.tenantId FROM c WHERE c.id = @id",
        parameters: [{ name: "@id", value: id }],
      })
      .fetchAll()

    const issue = resources[0]
    if (!issue) {
      return NextResponse.json({ error: "Maintenance issue not found" }, { status: 404 })
    }

    // Verify user can access this issue
    const role = getUserRole(user)
    if (role === "tenant" && issue.tenantId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Upload to blob storage
    const photoId = randomUUID()
    const blobPath = `maintenance/${id}/${photoId}`
    const buffer = await file.arrayBuffer()

    await uploadToBlob(blobPath, buffer, file.type)

    // Get the URL
    const photoUrl = getBlobUrl(blobPath)

    // Update the issue with the new photo ID
    const issueRecord = await container.item(id, issue.propertyId).read()
    const updatedIssue = {
      ...issueRecord.resource,
      photoIds: [...(issueRecord.resource.photoIds || []), photoId],
      photoUrls: [...(issueRecord.resource.photoUrls || []), { id: photoId, url: photoUrl, uploadedAt: new Date().toISOString() }],
      updatedAt: new Date().toISOString(),
    }

    await container.item(id, issue.propertyId).replace(updatedIssue)

    return NextResponse.json(
      {
        photo: {
          id: photoId,
          url: photoUrl,
          uploadedAt: new Date().toISOString(),
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Photo upload error:", error)
    return NextResponse.json({ error: "Failed to upload photo" }, { status: 500 })
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await context.params
    const { photoId } = (await request.json()) as { photoId: string }

    if (!photoId) {
      return NextResponse.json({ error: "Photo ID required" }, { status: 400 })
    }

    // Get the issue
    const container = await getMaintenanceContainer()
    const { resources } = await container.items
      .query({
        query: "SELECT c.id, c.propertyId, c.tenantId FROM c WHERE c.id = @id",
        parameters: [{ name: "@id", value: id }],
      })
      .fetchAll()

    const issue = resources[0]
    if (!issue) {
      return NextResponse.json({ error: "Maintenance issue not found" }, { status: 404 })
    }

    // Update the issue
    const issueRecord = await container.item(id, issue.propertyId).read()
    const updatedIssue = {
      ...issueRecord.resource,
      photoIds: (issueRecord.resource.photoIds || []).filter((id: string) => id !== photoId),
      photoUrls: (issueRecord.resource.photoUrls || []).filter((photo: { id: string }) => photo.id !== photoId),
      updatedAt: new Date().toISOString(),
    }

    await container.item(id, issue.propertyId).replace(updatedIssue)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Photo delete error:", error)
    return NextResponse.json({ error: "Failed to delete photo" }, { status: 500 })
  }
}
