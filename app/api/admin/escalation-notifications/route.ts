import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/server/session"
import { canManageProperties } from "@/lib/auth"
import { getEscalationNotificationCandidates, markEscalationAsNotified, getCaseById } from "@/lib/server/cases"
import { writeAuditEvent } from "@/lib/server/audit"
import { AUDIT_ACTION_TYPES } from "@/lib/types/audit"
import { sendEscalationNotification } from "@/lib/server/notifications"

/**
 * POST /api/admin/escalation-notifications
 * Trigger: Check for overdue case stages and send notifications
 * Requires admin or system access
 */
export async function POST(request: NextRequest) {
  try {
    // Verify auth token or admin user
    const user = await getSessionUser()
    if (!user || !canManageProperties(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const candidates = await getEscalationNotificationCandidates()

    const results = {
      checked: candidates.length,
      notified: 0,
      failed: 0,
    }

    for (const candidate of candidates) {
      try {
        const { case_, propertyId, stageId, escalationLevel } = candidate

        // Send email notification
        const stage = case_.stages.find((s) => s.id === stageId)
        if (!stage) continue

        const notificationSent = await sendEscalationNotification({
          caseId: case_.id,
          caseTitle: case_.title,
          propertyId,
          stageName: stage.requirement,
          escalationLevel,
          dueAt: stage.dueAt,
          recipientEmail: case_.createdBy, // Send to case creator (landlord)
        })

        if (notificationSent) {
          // Mark as notified
          await markEscalationAsNotified(case_, stageId, escalationLevel)

          // Write audit event
          await writeAuditEvent({
            entityType: "case_escalation",
            entityId: case_.id,
            action: AUDIT_ACTION_TYPES.EXECUTED_BY_SYSTEM,
            fieldPath: `escalation.${escalationLevel}`,
            oldValue: { notified: false },
            newValue: { notified: true },
            performedBy: "system@escalation",
            metadata: {
              propertyId,
              caseType: case_.caseType,
              stageId,
              escalationLevel,
            },
          })

          results.notified++
        }
      } catch (error) {
        console.error("Error sending escalation notification:", error)
        results.failed++
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error("Error processing escalations:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * GET /api/admin/escalation-notifications
 * Check status without sending
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || !canManageProperties(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const candidates = await getEscalationNotificationCandidates()

    return NextResponse.json({
      totalCandidates: candidates.length,
      byLevel: {
        alert_24h: candidates.filter((c) => c.escalationLevel === "alert_24h").length,
        alert_72h: candidates.filter((c) => c.escalationLevel === "alert_72h").length,
        alert_5d: candidates.filter((c) => c.escalationLevel === "alert_5d").length,
      },
      details: candidates.slice(0, 10), // First 10
    })
  } catch (error) {
    console.error("Error checking escalations:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
