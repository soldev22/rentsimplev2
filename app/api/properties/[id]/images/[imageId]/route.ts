import { NextResponse } from "next/server"

import { isPendingApproval } from "@/lib/auth"
import { downloadPropertyImage } from "@/lib/server/blob"
import { getPropertyForUser, getPublicAvailableProperty } from "@/lib/server/properties"
import { getSessionUser } from "@/lib/server/session"

type RouteContext = {
  params: Promise<{
    id: string
    imageId: string
  }>
}

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getSessionUser()
  const { id, imageId } = await params
  let isPublicAssetRequest = false

  let property = null

  if (user && !isPendingApproval(user)) {
    property = await getPropertyForUser(user, id)
  }

  if (!property) {
    property = await getPublicAvailableProperty(id)
    isPublicAssetRequest = true
  }

  if (!property) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 })
  }

  const image = property.images.find((candidate) => candidate.id === imageId)

  if (!image) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 })
  }

  if (isPublicAssetRequest && image.moderationStatus !== "approved") {
    return NextResponse.json({ error: "Image not found." }, { status: 404 })
  }

  try {
    const requestUrl = new URL(_request.url)
    const variant = requestUrl.searchParams.get("variant")
    const blobName = variant === "thumbnail" && image.thumbnailBlobName ? image.thumbnailBlobName : image.blobName
    const download = await downloadPropertyImage(blobName)

    return new NextResponse(download.stream, {
      headers: {
        "Content-Type": download.contentType,
        "Cache-Control": isPublicAssetRequest ? "public, max-age=300" : "private, max-age=300",
        ...(typeof download.contentLength === "number"
          ? { "Content-Length": String(download.contentLength) }
          : null),
        ...(download.etag ? { ETag: download.etag } : null),
        ...(download.lastModified ? { "Last-Modified": download.lastModified.toUTCString() } : null),
      },
    })
  } catch {
    return NextResponse.json({ error: "Unable to load image." }, { status: 500 })
  }
}
