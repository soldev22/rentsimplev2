import { NextResponse } from "next/server"

import { canManageProperties, getUserRole, isPendingApproval } from "@/lib/auth"
import { AUDIT_ACTION_TYPES } from "@/lib/types/audit"
import { writeAuditEvent } from "@/lib/server/audit"
import { generatePropertyDescription } from "@/lib/server/ai"
import { getPropertyForUser } from "@/lib/server/properties"
import { getSessionUser } from "@/lib/server/session"

export async function POST(request: Request) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPendingApproval(user)) {
    return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
  }

  if (!canManageProperties(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = (await request.json()) as {
      propertyId?: string
      addressLine1?: string
      addressLine2?: string
      city?: string
      postcode?: string
      type?: string
      status?: string
      bedrooms?: number
      bathrooms?: number
      monthlyRent?: number
    }

    if (!body.addressLine1 || !body.city || !body.postcode || !body.type || !body.status) {
      return NextResponse.json(
        { error: "Address line 1, city, postcode, property type, and status are required." },
        { status: 400 },
      )
    }

    const description = await generatePropertyDescription({
      addressLine1: body.addressLine1,
      addressLine2: body.addressLine2,
      city: body.city,
      postcode: body.postcode,
      type: body.type,
      status: body.status,
      bedrooms: body.bedrooms,
      bathrooms: body.bathrooms,
      monthlyRent: body.monthlyRent,
    })

    const propertyId = typeof body.propertyId === "string" ? body.propertyId.trim() : ""

    if (propertyId) {
      const property = await getPropertyForUser(user, propertyId)

      if (property) {
        await writeAuditEvent({
          entityType: "property",
          entityId: property.id,
          action: AUDIT_ACTION_TYPES.SUGGESTED,
          fieldPath: "listingDescription",
          oldValue: {
            shortDescription: property.shortDescription,
            longDescription: property.longDescription,
          },
          newValue: description,
          performedBy: "system",
          metadata: {
            ownerId: property.ownerId,
            propertyStatus: body.status,
            requestedBy: user.email,
            requestedByRole: getUserRole(user),
            workflow: "publishing",
            source: "ai_property_description",
          },
        })
      }
    }

    return NextResponse.json(description)
  } catch (error) {
    if (error instanceof Error && error.message === "AiNotConfigured") {
      return NextResponse.json(
        { error: "OpenAI is not configured. Set OPENAI_API_KEY and OPENAI_MODEL." },
        { status: 500 },
      )
    }

    return NextResponse.json({ error: "Unable to generate property description." }, { status: 500 })
  }
}
