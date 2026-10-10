import "server-only"

import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"

import { getUserRole, isPendingApproval, type MaintenanceIssueRecord } from "@/lib/auth"
import {
  MAX_MAINTENANCE_UPDATE_NOTE_LENGTH,
  MAX_MAINTENANCE_UPDATE_PHOTOS,
  MAX_MAINTENANCE_UPDATE_PHOTO_SIZE,
} from "@/lib/types/maintenance"
import { deleteBlob, getBlobUrl, uploadToBlob } from "@/lib/server/blob"
import { getMaintenanceContainer } from "@/lib/server/cosmos"
import { getMaintenanceIssueForUpdate } from "@/lib/server/maintenance"
import { getSessionUser } from "@/lib/server/session"

type RouteContext = {
  params: Promise<{ id: string }>
}

const allowedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"])

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPendingApproval(user)) {
    return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
  }

  if (!["tenant", "admin", "agent", "landlord", "builder"].includes(getUserRole(user))) {
    return NextResponse.json({ error: "Your account cannot add maintenance updates." }, { status: 403 })
  }

  const uploadedBlobPaths: string[] = []

  try {
    const { id } = await context.params
    const formData = await request.formData()
    const note = String(formData.get("note") ?? "").trim()
    const photoValues = formData.getAll("photos")

    if (photoValues.some((value) => typeof value === "string" && value !== "")) {
      throw new Error("MaintenanceUpdatePhotoValidationError")
    }

    const photos = photoValues.filter(
      (value): value is File => typeof value !== "string" && value.size > 0,
    )

    if (!note && photos.length === 0) {
      throw new Error("MaintenanceUpdateValidationError")
    }

    if (note.length > MAX_MAINTENANCE_UPDATE_NOTE_LENGTH) {
      throw new Error("MaintenanceUpdateNoteTooLong")
    }

    if (photos.length > MAX_MAINTENANCE_UPDATE_PHOTOS) {
      throw new Error("MaintenanceUpdateTooManyPhotos")
    }

    if (photos.some((photo) => !allowedPhotoTypes.has(photo.type) || photo.size > MAX_MAINTENANCE_UPDATE_PHOTO_SIZE || photo.size === 0)) {
      throw new Error("MaintenanceUpdatePhotoValidationError")
    }

    const issue = await getMaintenanceIssueForUpdate(user, id)

    if (!issue) {
      return NextResponse.json({ error: "Maintenance issue not found." }, { status: 404 })
    }

    const container = await getMaintenanceContainer()

    const updateId = randomUUID()
    const createdAt = new Date().toISOString()
    const uploadedPhotos: NonNullable<MaintenanceIssueRecord["photoUrls"]> = []

    for (const photo of photos) {
      const photoId = randomUUID()
      const blobPath = `maintenance/${id}/updates/${updateId}/${photoId}`
      await uploadToBlob(blobPath, await photo.arrayBuffer(), photo.type)
      uploadedBlobPaths.push(blobPath)
      uploadedPhotos.push({
        id: photoId,
        url: getBlobUrl(blobPath),
        uploadedAt: createdAt,
      })
    }

    const update = {
      id: updateId,
      authorId: user.id,
      authorName: user.first_name || user.last_name
        ? `${user.first_name} ${user.last_name}`.trim()
        : user.email,
      note,
      photos: uploadedPhotos,
      createdAt,
    }
    const updatedIssue: MaintenanceIssueRecord = {
      ...issue,
      updates: [...(issue.updates ?? []), update],
      updatedAt: createdAt,
    }

    await container.item(issue.id, issue.propertyId).replace(updatedIssue)

    return NextResponse.json({ update }, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Forbidden") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      if (error.message === "MaintenanceUpdateValidationError") {
        return NextResponse.json({ error: "Add a note or at least one photo." }, { status: 400 })
      }

      if (error.message === "MaintenanceUpdateNoteTooLong") {
        return NextResponse.json({ error: `Notes must be ${MAX_MAINTENANCE_UPDATE_NOTE_LENGTH} characters or fewer.` }, { status: 400 })
      }

      if (error.message === "MaintenanceUpdateTooManyPhotos") {
        return NextResponse.json({ error: `You can add up to ${MAX_MAINTENANCE_UPDATE_PHOTOS} photos per update.` }, { status: 400 })
      }

      if (error.message === "MaintenanceUpdatePhotoValidationError") {
        return NextResponse.json({ error: "Use JPEG, PNG, or WebP images smaller than 10 MB each." }, { status: 400 })
      }
    }

    const cleanupResults = await Promise.allSettled(uploadedBlobPaths.map((path) => deleteBlob(path)))
    cleanupResults.forEach((result) => {
      if (result.status === "rejected") {
        console.error("Maintenance update photo cleanup failed:", result.reason)
      }
    })

    console.error("Maintenance update error:", error)
    return NextResponse.json({ error: "Unable to save maintenance update." }, { status: 500 })
  }
}
