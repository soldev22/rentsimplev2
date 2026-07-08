import { NextResponse } from "next/server"

import { getUserRole, isPendingApproval } from "@/lib/auth"
import { listAuditEventsForEntity } from "@/lib/server/audit"
import { requestCreditReportForApplication } from "@/lib/server/applications"
import { getSessionUser } from "@/lib/server/session"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function POST(_request: Request, context: RouteContext) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPendingApproval(user)) {
    return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
  }

  if (getUserRole(user) !== "landlord") {
    return NextResponse.json({ error: "Only landlords can request credit reports." }, { status: 403 })
  }

  try {
    const { id } = await context.params
    const result = await requestCreditReportForApplication(user, id)

    if (!result) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 })
    }

    const auditEvents = await listAuditEventsForEntity("application", result.application.id)

    return NextResponse.json({
      application: result.application,
      auditEvents,
      message: result.alreadyRequested
        ? "Credit report already requested. The report is expected within 24 hours."
        : "Credit report request submitted. The report will be ready in 24 hours and an email has been sent to mike@solutionsdeveloped.co.uk.",
      notificationSent: result.notificationSent,
      alreadyRequested: result.alreadyRequested,
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({ error: "Unable to request credit report." }, { status: 500 })
  }
}
