import { NextResponse } from "next/server"

import { isPendingApproval, type PropertyInsurance } from "@/lib/auth"
import { updatePropertyInsurance } from "@/lib/server/properties"
import { getSessionUser } from "@/lib/server/session"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function PUT(request: Request, context: RouteContext) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPendingApproval(user)) {
    return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
  }

  try {
    const body = (await request.json()) as {
      isInsured?: unknown
      insurerName?: unknown
      policyNumber?: unknown
      renewalDate?: unknown
      notes?: unknown
    }

    if (typeof body.isInsured !== "boolean") {
      return NextResponse.json({ error: "isInsured must be a boolean." }, { status: 400 })
    }

    const insurance: PropertyInsurance = {
      isInsured: body.isInsured,
      insurerName: typeof body.insurerName === "string" ? body.insurerName : undefined,
      policyNumber: typeof body.policyNumber === "string" ? body.policyNumber : undefined,
      renewalDate: typeof body.renewalDate === "string" ? body.renewalDate : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    }

    const { id } = await context.params
    const property = await updatePropertyInsurance(user, id, insurance)

    if (!property) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ property })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({ error: "Unable to update insurance details." }, { status: 500 })
  }
}
