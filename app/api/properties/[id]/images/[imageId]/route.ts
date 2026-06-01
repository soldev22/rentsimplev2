import { NextResponse } from "next/server"

import { isPendingApproval } from "@/lib/auth"
import { downloadPropertyImage } from "@/lib/server/blob"
import { getPropertyForUser } from "@/lib/server/properties"
import { getSessionUser } from "@/lib/server/session"

type RouteContext = {
  params: Promise<{
    id: string
    imageId: string
  }>
}

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPendingApproval(user)) {
    return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
  }

  const { id, imageId } = await params
  const property = await getPropertyForUser(user, id)

  if (!property) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 })
  }

  const image = property.images.find((candidate) => candidate.id === imageId)

  if (!image) {
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
        "Cache-Control": "private, max-age=300",
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
