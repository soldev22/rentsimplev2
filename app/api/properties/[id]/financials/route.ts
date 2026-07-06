import { NextResponse } from "next/server"

import { isPendingApproval, type PropertyFinancials } from "@/lib/auth"
import { updatePropertyFinancials } from "@/lib/server/properties"
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
      propertyValue?: unknown
      annualAppreciationRate?: unknown
      estimatedAnnualCosts?: unknown
    }

    if (typeof body.propertyValue !== "number" || body.propertyValue < 0) {
      return NextResponse.json({ error: "propertyValue must be a non-negative number." }, { status: 400 })
    }

    if (typeof body.annualAppreciationRate !== "number" || body.annualAppreciationRate < -100 || body.annualAppreciationRate > 100) {
      return NextResponse.json({ error: "annualAppreciationRate must be a number between -100 and 100." }, { status: 400 })
    }

    if (typeof body.estimatedAnnualCosts !== "number" || body.estimatedAnnualCosts < 0) {
      return NextResponse.json({ error: "estimatedAnnualCosts must be a non-negative number." }, { status: 400 })
    }

    const financials: PropertyFinancials = {
      propertyValue: body.propertyValue,
      annualAppreciationRate: body.annualAppreciationRate,
      estimatedAnnualCosts: body.estimatedAnnualCosts,
    }

    const { id } = await context.params
    const property = await updatePropertyFinancials(user, id, financials)

    if (!property) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ property })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({ error: "Unable to update financials." }, { status: 500 })
  }
}
