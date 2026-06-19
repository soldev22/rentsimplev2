import { NextResponse } from "next/server"

import { isPendingApproval } from "@/lib/auth"
import { createProperty, listPropertiesForUser } from "@/lib/server/properties"
import { getSessionUser } from "@/lib/server/session"

export async function GET() {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPendingApproval(user)) {
    return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
  }

  const properties = await listPropertiesForUser(user)

  return NextResponse.json({ properties })
}

export async function POST(request: Request) {
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

    if (!body.addressLine1 || !body.city || !body.postcode || !body.type || !body.status) {
      return NextResponse.json({ error: "Address line 1, city, postcode, type, and status are required." }, { status: 400 })
    }

    const property = await createProperty(user, {
      address: body.address,
      addressLine1: body.addressLine1,
      addressLine2: body.addressLine2,
      city: body.city,
      postcode: body.postcode,
      type: body.type,
      status: body.status,
      shortDescription: body.shortDescription,
      longDescription: body.longDescription,
      description: body.description,
      bedrooms: body.bedrooms,
      bathrooms: body.bathrooms,
      monthlyRent: body.monthlyRent,
      affordabilityMultiple: body.affordabilityMultiple,
    })

    return NextResponse.json({ property }, { status: 201 })
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

    return NextResponse.json({ error: "Unable to create property." }, { status: 500 })
  }
}