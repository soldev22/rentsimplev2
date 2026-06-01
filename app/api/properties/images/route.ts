import { NextResponse } from "next/server"

import { MAX_PROPERTY_IMAGES, isPendingApproval } from "@/lib/auth"
import { deletePropertyImageAssets, uploadPropertyImage } from "@/lib/server/blob"
import { moderatePropertyImageUpload } from "@/lib/server/image-moderation"
import { addPropertyImage, getPropertyForUser, removePropertyImage } from "@/lib/server/properties"
import { getSessionUser } from "@/lib/server/session"

export async function POST(request: Request) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPendingApproval(user)) {
    return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const propertyId = formData.get("propertyId")
    const file = formData.get("file")

    if (typeof propertyId !== "string" || !propertyId) {
      return NextResponse.json({ error: "propertyId is required." }, { status: 400 })
    }

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "A file upload is required." }, { status: 400 })
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image uploads are supported." }, { status: 400 })
    }

    const property = await getPropertyForUser(user, propertyId)

    if (!property) {
      return NextResponse.json({ error: "Property not found." }, { status: 404 })
    }

    if (property.images.length >= MAX_PROPERTY_IMAGES) {
      return NextResponse.json({ error: `A property can only store ${MAX_PROPERTY_IMAGES} images.` }, { status: 409 })
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const moderation = await moderatePropertyImageUpload(fileBuffer)

    if (!moderation.allowed) {
      return NextResponse.json(
        { error: moderation.reason || "This image failed moderation and was not uploaded." },
        { status: 400 },
      )
    }

    const image = await uploadPropertyImage({
      propertyId,
      fileName: file.name,
      contentType: file.type,
      data: fileBuffer,
      moderationStatus: "pending_review",
      moderationReason: moderation.reason,
      moderationScores: moderation.scores,
      uploadedByUserId: user.id,
    })

    let savedImage = null

    try {
      savedImage = await addPropertyImage(user, propertyId, image)
    } catch (error) {
      await deletePropertyImageAssets(image)

      if (error instanceof Error && error.message === "PropertyImageLimitExceeded") {
        return NextResponse.json({ error: `A property can only store ${MAX_PROPERTY_IMAGES} images.` }, { status: 409 })
      }

      throw error
    }

    if (!savedImage) {
      await deletePropertyImageAssets(image)
      return NextResponse.json({ error: "Property not found." }, { status: 404 })
    }

    return NextResponse.json({ image: savedImage }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (error instanceof Error && error.message === "PropertyImageLimitExceeded") {
      return NextResponse.json({ error: `A property can only store ${MAX_PROPERTY_IMAGES} images.` }, { status: 409 })
    }

    if (error instanceof Error && error.message === "ImageModerationNotConfigured") {
      return NextResponse.json({ error: "Image moderation is not configured." }, { status: 500 })
    }

    if (error instanceof Error && error.message === "ImageModerationRequestFailed") {
      return NextResponse.json({ error: "Image moderation failed. Please try again." }, { status: 502 })
    }

    return NextResponse.json({ error: "Unable to upload image." }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPendingApproval(user)) {
    return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
  }

  try {
    const body = (await request.json()) as {
      propertyId?: string
      blobName?: string
    }

    if (!body.propertyId || !body.blobName) {
      return NextResponse.json({ error: "propertyId and blobName are required." }, { status: 400 })
    }

    const property = await removePropertyImage(user, body.propertyId, body.blobName)

    if (!property) {
      return NextResponse.json({ error: "Property image not found." }, { status: 404 })
    }

    return NextResponse.json({ property })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({ error: "Unable to delete image." }, { status: 500 })
  }
}
