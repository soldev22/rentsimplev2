import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/server/session"
import { canManageProperties } from "@/lib/auth"
import { getPropertyForUser } from "@/lib/server/properties"
import { getCaseById } from "@/lib/server/cases"
import { saveCaseToDb } from "@/lib/server/cases"
import { writeAuditEvent } from "@/lib/server/audit"
import { AUDIT_ACTION_TYPES } from "@/lib/types/audit"

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string
      caseId: string
      stageId: string
    }>
  }
) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: propertyId, caseId, stageId } = await params

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

    if (case_.caseType !== "damp") {
      return NextResponse.json({ error: "Inspection reports only allowed for damp cases" }, { status: 400 })
    }

    // Verify stage exists
    const stage = case_.stages.find((s) => s.id === stageId)
    if (!stage) {
      return NextResponse.json({ error: "Stage not found" }, { status: 404 })
    }

    const reportData = await request.json()
    const now = new Date()

    // Create report object
    const report = {
      id: `report-${Date.now()}`,
      stageId,
      caseId: case_.id,
      propertyId: case_.propertyId,
      ...reportData,
      reportSubmittedBy: user.email,
      reportSubmittedAt: now.toISOString(),
    }

    // Initialize reports array if needed
    if (!case_.dampInspectionReports) {
      case_.dampInspectionReports = []
    }

    case_.dampInspectionReports.push(report)
    case_.updatedAt = now.toISOString()

    // Log report submission to audit trail
    await writeAuditEvent({
      entityType: "property_case",
      entityId: case_.id,
      action: AUDIT_ACTION_TYPES.EXECUTED_BY_SYSTEM,
      fieldPath: `dampInspectionReports.${report.id}`,
      oldValue: null,
      newValue: report,
      performedBy: user.email,
      metadata: {
        propertyId: case_.propertyId,
        caseType: case_.caseType,
        stageId,
        severity: report.severityLevel,
        rootCause: report.rootCause,
        urgency: report.urgencyLevel,
        action: "inspection_report_submitted",
      },
    })

    // Save to database
    const saved = await saveCaseToDb(case_)
    return NextResponse.json(saved)
  } catch (error) {
    console.error("Error saving inspection report:", error)
    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
