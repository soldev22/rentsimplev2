import { NextResponse } from "next/server"

import { isPendingApproval } from "@/lib/auth"
import { deletePropertyForUser, getPropertyForUser, updateProperty } from "@/lib/server/properties"
import { getSessionUser } from "@/lib/server/session"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPendingApproval(user)) {
    return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
  }

  const { id } = await context.params
  const property = await getPropertyForUser(user, id)

  if (!property) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ property })
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPendingApproval(user)) {
    return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
  }

  try {
    const body = (await request.json()) as {
      address?: string
      addressLine1?: string
      addressLine2?: string
      city?: string
      postcode?: string
      type?: string
      status?: string
      shortDescription?: string
      longDescription?: string
      description?: string
      bedrooms?: number
      bathrooms?: number
      monthlyRent?: number
      affordabilityMultiple?: number
    }

    const { id } = await context.params
    const property = await updateProperty(user, id, body)

    if (!property) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ property })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (error instanceof Error && error.message === "PropertyValidationError") {
      return NextResponse.json(
        { error: "Address line 1, city, postcode, type, and status are required." },
        { status: 400 },
      )
    }

    return NextResponse.json({ error: "Unable to update property." }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPendingApproval(user)) {
    return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
  }

  try {
    const { id } = await context.params
    const deleted = await deletePropertyForUser(user, id)

    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({ error: "Unable to delete property." }, { status: 500 })
  }
}
