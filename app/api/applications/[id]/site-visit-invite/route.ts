import { NextResponse } from "next/server"

import { isPendingApproval } from "@/lib/auth"
import { listAuditEventsForEntity } from "@/lib/server/audit"
import { requestSiteVisitMeetingInviteForApplication } from "@/lib/server/applications"
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
    const result = await requestSiteVisitMeetingInviteForApplication(user, id, { forceResend, appOrigin })

    if (!result) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 })
    }

    const auditEvents = await listAuditEventsForEntity("application", result.application.id)

    const message = result.alreadyRequested
      ? "A site visit invite is already active for this applicant."
      : result.notificationSent
        ? forceResend
          ? "Site visit invite has been re-sent to the applicant."
          : "Site visit invite has been sent to the applicant."
        : `Unable to send site visit invite email${result.deliveryError ? `: ${result.deliveryError}` : "."}${
            result.rejectedRecipients && result.rejectedRecipients.length > 0
              ? ` Rejected recipients: ${result.rejectedRecipients.join(", ")}.`
              : ""
          }`

    return NextResponse.json({
      application: result.application,
      auditEvents,
      message,
      alreadyRequested: result.alreadyRequested,
      notificationSent: result.notificationSent,
      failedCount: result.failedCount,
      deliveryError: result.deliveryError,
      deliveryMessageId: result.deliveryMessageId,
      acceptedRecipients: result.acceptedRecipients,
      rejectedRecipients: result.rejectedRecipients,
      confirmationUrl: result.confirmationUrl,
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (error instanceof Error && error.message === "SiteVisitScheduleRequired") {
      return NextResponse.json({ error: "Set the site visit scheduled date and time before sending an invite." }, { status: 400 })
    }

    if (error instanceof Error && error.message === "ApplicantEmailRequired") {
      return NextResponse.json({ error: "The applicant does not have an email address on this application." }, { status: 400 })
    }

    return NextResponse.json({ error: "Unable to send site visit invite." }, { status: 500 })
  }
}
