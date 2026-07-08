import { NextResponse } from "next/server"

import { isPendingApproval } from "@/lib/auth"
import { listAuditEventsForEntity } from "@/lib/server/audit"
import { requestGuarantorReferenceRequestsForApplication } from "@/lib/server/applications"
import { getSessionUser } from "@/lib/server/session"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPendingApproval(user)) {
    return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
  }

  try {
    const body = (await request.json().catch(() => null)) as
      | {
          forceResend?: boolean
        }
      | null
    const forceResend = body?.forceResend === true
    const { id } = await context.params
    const appOrigin = new URL(request.url).origin
    const result = await requestGuarantorReferenceRequestsForApplication(user, id, { forceResend, appOrigin })

    if (!result) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 })
    }

    const auditEvents = await listAuditEventsForEntity("application", result.application.id)

    const message = result.alreadyRequested
      ? forceResend
        ? "No active guarantor email requests were eligible for resend."
        : "Guarantor approval requests are already active for every listed contact."
      : forceResend
        ? `Guarantor resend complete: ${result.sentCount} email sent (${result.resentCount} resent), ${result.manualCount} manual follow-up required, ${result.failedCount} failed.`
        : `Guarantor approval run complete: ${result.sentCount} email sent, ${result.manualCount} manual follow-up required, ${result.failedCount} failed.`

    return NextResponse.json({
      application: result.application,
      auditEvents,
      message,
      alreadyRequested: result.alreadyRequested,
      sentCount: result.sentCount,
      manualCount: result.manualCount,
      failedCount: result.failedCount,
      resentCount: result.resentCount,
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (error instanceof Error && error.message === "GuarantorDecisionRequired") {
      return NextResponse.json({ error: "Set the decision to approved with guarantor before requesting guarantor approval." }, { status: 400 })
    }

    if (error instanceof Error && error.message === "RefereeContactRequired") {
      return NextResponse.json({ error: "Add at least one guarantor contact with a name before sending requests." }, { status: 400 })
    }

    if (error instanceof Error && error.message === "GuarantorPrecheckRequired") {
      return NextResponse.json(
        { error: "Complete relationship to applicant and full ID checks (ID document and proof of address) before requesting." },
        { status: 400 },
      )
    }

    return NextResponse.json({ error: "Unable to send guarantor approval requests." }, { status: 500 })
  }
}
