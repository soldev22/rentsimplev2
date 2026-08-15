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
      purchaseCost?: unknown
      mortgageLender?: unknown
      mortgageBalance?: unknown
      mortgageInterestRate?: unknown
      mortgageMonthlyPayment?: unknown
      mortgageRenewalDate?: unknown
      depositAmount?: unknown
      depositProtectionScheme?: unknown
      depositReference?: unknown
      paymentFrequency?: unknown
      paymentDueDay?: unknown
      latePaymentPolicy?: unknown
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

    const optionalNonNegativeNumberFields = ["purchaseCost", "mortgageBalance", "mortgageInterestRate", "mortgageMonthlyPayment", "depositAmount"] as const
    for (const field of optionalNonNegativeNumberFields) {
      if (body[field] !== undefined && (typeof body[field] !== "number" || body[field] < 0)) {
        return NextResponse.json({ error: `${field} must be a non-negative number.` }, { status: 400 })
      }
    }

    if (body.mortgageLender !== undefined && typeof body.mortgageLender !== "string") {
      return NextResponse.json({ error: "mortgageLender must be a string." }, { status: 400 })
    }

    if (body.mortgageRenewalDate !== undefined && typeof body.mortgageRenewalDate !== "string") {
      return NextResponse.json({ error: "mortgageRenewalDate must be a string." }, { status: 400 })
    }

    const optionalStringFields = ["depositProtectionScheme", "depositReference", "latePaymentPolicy"] as const
    for (const field of optionalStringFields) {
      if (body[field] !== undefined && typeof body[field] !== "string") {
        return NextResponse.json({ error: `${field} must be a string.` }, { status: 400 })
      }
    }

    if (body.paymentFrequency !== undefined && !["weekly", "monthly", "quarterly"].includes(body.paymentFrequency as string)) {
      return NextResponse.json({ error: "paymentFrequency must be weekly, monthly, or quarterly." }, { status: 400 })
    }

    if (body.paymentDueDay !== undefined && (typeof body.paymentDueDay !== "number" || !Number.isInteger(body.paymentDueDay) || body.paymentDueDay < 1 || body.paymentDueDay > 31)) {
      return NextResponse.json({ error: "paymentDueDay must be a whole number between 1 and 31." }, { status: 400 })
    }

    const financials: PropertyFinancials = {
      propertyValue: body.propertyValue,
      annualAppreciationRate: body.annualAppreciationRate,
      estimatedAnnualCosts: body.estimatedAnnualCosts,
      purchaseCost: body.purchaseCost as number | undefined,
      mortgageLender: body.mortgageLender as string | undefined,
      mortgageBalance: body.mortgageBalance as number | undefined,
      mortgageInterestRate: body.mortgageInterestRate as number | undefined,
      mortgageMonthlyPayment: body.mortgageMonthlyPayment as number | undefined,
      mortgageRenewalDate: body.mortgageRenewalDate as string | undefined,
      depositAmount: body.depositAmount as number | undefined,
      depositProtectionScheme: body.depositProtectionScheme as string | undefined,
      depositReference: body.depositReference as string | undefined,
      paymentFrequency: body.paymentFrequency as PropertyFinancials["paymentFrequency"],
      paymentDueDay: body.paymentDueDay as number | undefined,
      latePaymentPolicy: body.latePaymentPolicy as string | undefined,
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
