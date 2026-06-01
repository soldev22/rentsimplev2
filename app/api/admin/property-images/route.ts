import { NextResponse } from "next/server"

import { listPendingPropertyImagesForAdmin, reviewPropertyImageForAdmin } from "@/lib/server/properties"
import { getSessionUser } from "@/lib/server/session"

export async function GET() {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const reviews = await listPendingPropertyImagesForAdmin(user)
    return NextResponse.json({ reviews })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({ error: "Unable to load pending image reviews." }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as {
      propertyId?: string
      imageId?: string
      action?: "approve" | "reject"
    }

    if (!body.propertyId || !body.imageId || !body.action) {
      return NextResponse.json({ error: "propertyId, imageId, and action are required." }, { status: 400 })
    }

    if (body.action !== "approve" && body.action !== "reject") {
      return NextResponse.json({ error: "action must be approve or reject." }, { status: 400 })
    }

    const property = await reviewPropertyImageForAdmin(user, body.propertyId, body.imageId, body.action)

    if (!property) {
      return NextResponse.json({ error: "Pending property image not found." }, { status: 404 })
    }

    return NextResponse.json({ property })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({ error: "Unable to review property image." }, { status: 500 })
  }
}