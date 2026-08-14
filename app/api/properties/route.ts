import { NextResponse } from "next/server"

import { isPendingApproval } from "@/lib/auth"
import { createProperty, listPropertiesForUserByContinuation, listPropertiesForUserPage } from "@/lib/server/properties"
import { getSessionUser } from "@/lib/server/session"

export async function GET(request: Request) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPendingApproval(user)) {
    return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
  }

  const url = new URL(request.url)
  const page = Number.isFinite(Number(url.searchParams.get("page"))) ? Number(url.searchParams.get("page")) : 1
  const pageSize = Number.isFinite(Number(url.searchParams.get("pageSize")))
    ? Number(url.searchParams.get("pageSize"))
    : 25
  const landlordId = url.searchParams.get("landlordId") ?? undefined
  const continuationToken = url.searchParams.get("continuationToken") ?? undefined
  const maxItemCount = Number.isFinite(Number(url.searchParams.get("maxItemCount")))
    ? Number(url.searchParams.get("maxItemCount"))
    : 50

  if (continuationToken) {
    const continuationPage = await listPropertiesForUserByContinuation(user, landlordId, {
      continuationToken,
      maxItemCount,
    })

    return NextResponse.json({
      properties: continuationPage.items,
      pagination: {
        mode: "continuation",
        continuationToken: continuationPage.continuationToken,
        maxItemCount: continuationPage.maxItemCount,
      },
    })
  }

  const paged = await listPropertiesForUserPage(user, landlordId, { page, pageSize })

  return NextResponse.json({ properties: paged.items, pagination: { mode: "offset", ...paged } })
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
      parking?: string
      heating?: string
      councilTaxBand?: string
      broadbandAvailable?: boolean | string
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
      parking: body.parking,
      heating: body.heating,
      councilTaxBand: body.councilTaxBand,
      broadbandAvailable: body.broadbandAvailable,
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