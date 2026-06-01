import { NextResponse } from "next/server"

import { canManageProperties, isPendingApproval } from "@/lib/auth"
import { generatePropertyDescription } from "@/lib/server/ai"
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
