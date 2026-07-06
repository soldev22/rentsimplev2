import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/server/session"
import { canManageProperties } from "@/lib/auth"
import { getPropertyForUser } from "@/lib/server/properties"
import { getCaseById } from "@/lib/server/cases"
import { sendReportToTenant } from "@/lib/server/case-notifications"

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string
      caseId: string
      reportId: string
    }>
  },
) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: propertyId, caseId, reportId } = await params

    const property = await getPropertyForUser(user, propertyId)
    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    if (!canManageProperties(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const case_ = await getCaseById(caseId, propertyId)
    if (!case_) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 })
    }

    // Find the report
    const report = case_.dampInspectionReports?.find((r) => r.id === reportId)
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    // Get method from request body
    const body = await request.json()
    const method = body.method as "email" | "dashboard"

    if (!method || !["email", "dashboard"].includes(method)) {
      return NextResponse.json({ error: "Invalid method. Must be 'email' or 'dashboard'" }, { status: 400 })
    }

    // Send report to tenant
    const result = await sendReportToTenant(user, case_, report, { method })

    if (!result.success) {
      return NextResponse.json({ error: result.detail }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: result.detail,
      method: result.method,
    })
  } catch (error) {
    console.error("Error sending report to tenant:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
