import { NextRequest, NextResponse } from "next/server"

import { getSessionUser } from "@/lib/server/session"
import {
  addPropertyCompliance,
  updatePropertyCompliance,
  removePropertyCompliance,
} from "@/lib/server/properties"
import type { PropertyCompliance } from "@/lib/auth"

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await context.params
    const body = await request.json()
    const { compliance } = body as { compliance: PropertyCompliance }

    if (!compliance || !compliance.type || (!compliance.notApplicable && !compliance.expirationDate)) {
      return NextResponse.json(
        { error: "Missing required fields: type and expirationDate (unless not applicable)" },
        { status: 400 },
      )
    }

    const result = await addPropertyCompliance(user, id, compliance)

    if (!result) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Forbidden") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await context.params
    const body = await request.json()
    const { complianceId, compliance } = body as { complianceId: string; compliance: PropertyCompliance }

    if (!complianceId || !compliance || !compliance.type || (!compliance.notApplicable && !compliance.expirationDate)) {
      return NextResponse.json(
        { error: "Missing required fields: complianceId, type, and expirationDate (unless not applicable)" },
        { status: 400 },
      )
    }

    const result = await updatePropertyCompliance(user, id, complianceId, compliance)

    if (!result) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Forbidden") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await context.params
    const body = await request.json()
    const { complianceId } = body as { complianceId: string }

    if (!complianceId) {
      return NextResponse.json({ error: "Missing required field: complianceId" }, { status: 400 })
    }

    const result = await removePropertyCompliance(user, id, complianceId)

    if (!result) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Forbidden") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
