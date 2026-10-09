import "server-only"

import { randomUUID } from "node:crypto"

import { type AuthUser, type TenancyApplicationRecord } from "@/lib/auth"
import { writeAuditEvents } from "@/lib/server/audit"
import { getApplicationsContainer } from "@/lib/server/cosmos"
import { sendSiteVisitMeetingInviteNotification } from "@/lib/server/notifications"
import { createAuthChallenge } from "@/lib/server/auth-security"
import { inspectAuthChallenge } from "@/lib/server/auth-security"
import {
  SITE_VISIT_CONFIRMATION_TOKEN_DURATION_MS,
  assertReviewer,
  getAuditMetadata,
  buildApplicationAuditEvents,
  stripStoredCommunicationEntries,
  syncStoredCommunicationEntries,
  getApplicationById,
  getSiteVisitInviteExpiry,
} from "./shared"

export async function requestSiteVisitMeetingInviteForApplication(
  user: AuthUser,
  applicationId: string,
  options?: {
    forceResend?: boolean
    appOrigin?: string
  },
) {
  assertReviewer(user)

  const forceResend = options?.forceResend === true
  const appOrigin = options?.appOrigin?.trim() || process.env.NEXT_PUBLIC_BASE_URL?.trim() || "http://localhost:3000"
  const existingApplication = await getApplicationById(applicationId)

  if (!existingApplication) {
    return null
  }

  const scheduledAt = existingApplication.preMoveInCompliance.siteVisit.scheduledAt

  if (!scheduledAt) {
    throw new Error("SiteVisitScheduleRequired")
  }

  const applicantEmail = existingApplication.applicantEmail?.trim()

  if (!applicantEmail) {
    throw new Error("ApplicantEmailRequired")
  }

  if (existingApplication.preMoveInCompliance.siteVisit.inviteStatus === "sent" && !forceResend) {
    return {
      application: existingApplication,
      alreadyRequested: true,
      notificationSent: false,
      failedCount: 0,
    }
  }

  const now = new Date().toISOString()
  const requestId = randomUUID()
  const challenge = await createAuthChallenge(applicantEmail, "site_visit_confirmation", SITE_VISIT_CONFIRMATION_TOKEN_DURATION_MS, {
    applicationId: existingApplication.id,
    requestId,
  })
  const meetingConfirmationUrl = `${appOrigin}/site-visit/confirm?token=${encodeURIComponent(challenge.token)}`
  const delivery = await sendSiteVisitMeetingInviteNotification({
    toEmail: applicantEmail,
    applicantName: existingApplication.applicantName,
    requestedByEmail: user.email,
    requestedAt: now,
    propertyAddress: existingApplication.propertyAddress,
    applicationId: existingApplication.id,
    scheduledAt,
    assigneeName: existingApplication.preMoveInCompliance.siteVisit.assigneeName,
    meetingConfirmationUrl,
  })
  const notificationSent = delivery.sent

  const nextApplication: TenancyApplicationRecord = {
    ...existingApplication,
    updatedAt: now,
    preMoveInCompliance: {
      ...existingApplication.preMoveInCompliance,
      checkInScheduled: true,
      siteVisit: {
        ...existingApplication.preMoveInCompliance.siteVisit,
        status:
          existingApplication.preMoveInCompliance.siteVisit.status === "not_scheduled"
            ? "scheduled"
            : existingApplication.preMoveInCompliance.siteVisit.status,
        inviteStatus: notificationSent ? "sent" : "failed",
        inviteRequestId: requestId,
        inviteRequestedAt: now,
        inviteSentAt: notificationSent ? now : undefined,
        inviteRespondedAt: undefined,
        inviteLastError: notificationSent
          ? undefined
          : delivery.error
            ? `${delivery.error}${delivery.messageId ? ` (message id: ${delivery.messageId})` : ""}`
            : "Notification could not be sent.",
      },
    },
  }

  const container = await getApplicationsContainer()
  await syncStoredCommunicationEntries(nextApplication, nextApplication.postMoveInManagement.communicationEntries)
  await container.item(nextApplication.id, nextApplication.applicantId).replace(stripStoredCommunicationEntries(nextApplication))

  const auditEvents = [
    ...buildApplicationAuditEvents(existingApplication, nextApplication, user),
    {
      entityType: "application",
      entityId: nextApplication.id,
      action: notificationSent ? "site_visit_invite_sent" : "site_visit_invite_failed",
      fieldPath: "preMoveInCompliance.siteVisit",
      oldValue: existingApplication.preMoveInCompliance.siteVisit,
      newValue: nextApplication.preMoveInCompliance.siteVisit,
      performedBy: user.email,
      metadata: {
        ...getAuditMetadata(nextApplication, user),
        expiresAt: getSiteVisitInviteExpiry(now),
      },
      timestamp: now,
    },
  ]

  if (auditEvents.length > 0) {
    await writeAuditEvents(auditEvents)
  }

  return {
    application: nextApplication,
    alreadyRequested: false,
    notificationSent,
    failedCount: notificationSent ? 0 : 1,
    deliveryError: delivery.error,
    deliveryMessageId: delivery.messageId,
    acceptedRecipients: delivery.accepted,
    rejectedRecipients: delivery.rejected,
    confirmationUrl: meetingConfirmationUrl,
  }
}

export async function getSiteVisitMeetingConsentContext(token: string) {
  const inspected = await inspectAuthChallenge("site_visit_confirmation", token)

  if (inspected.error || !inspected.applicationId || !inspected.requestId) {
    return { context: null, error: "InvalidToken" as const }
  }

  const application = await getApplicationById(inspected.applicationId)

  if (!application) {
    return { context: null, error: "ApplicationNotFound" as const }
  }

  const siteVisit = application.preMoveInCompliance.siteVisit

  if (siteVisit.inviteRequestId !== inspected.requestId) {
    return { context: null, error: "RequestNotFound" as const }
  }

  const canRespond = !inspected.isExpired && !inspected.consumedAt && siteVisit.inviteStatus === "sent"

  return {
    context: {
      applicationId: application.id,
      applicantName: application.applicantName,
      applicantEmail: application.applicantEmail,
      propertyAddress: application.propertyAddress,
      scheduledAt: siteVisit.scheduledAt ?? null,
      assigneeName: siteVisit.assigneeName,
      notes: siteVisit.notes,
      alternativeSuggestedAt: siteVisit.alternativeSuggestedAt ?? null,
      requestedAt: siteVisit.inviteRequestedAt ?? null,
      inviteStatus: siteVisit.inviteStatus,
      respondedAt: siteVisit.inviteRespondedAt ?? null,
      expiresAt: inspected.expiresAt,
      tokenConsumedAt: inspected.consumedAt,
      tokenExpired: inspected.isExpired,
      canRespond,
    },
    error: null,
  }
}

export async function recordSiteVisitMeetingDecision(input: {
  applicationId: string
  requestId: string
  responderEmail: string
  decision: "agree" | "decline"
  alternativeSuggestedAt?: string
}) {
  const existingApplication = await getApplicationById(input.applicationId)

  if (!existingApplication) {
    return { application: null, error: "ApplicationNotFound" as const }
  }

  const currentSiteVisit = existingApplication.preMoveInCompliance.siteVisit

  if (currentSiteVisit.inviteRequestId !== input.requestId) {
    return { application: null, error: "RequestNotFound" as const }
  }

  if (currentSiteVisit.inviteStatus === "confirmed" || currentSiteVisit.inviteStatus === "declined") {
    return {
      application: existingApplication,
      alreadyResponded: true,
      existingStatus: currentSiteVisit.inviteStatus,
      error: null,
    }
  }

  const now = new Date().toISOString()
  const nextInviteStatus = input.decision === "agree" ? "confirmed" : "declined"
  const nextApplication: TenancyApplicationRecord = {
    ...existingApplication,
    updatedAt: now,
    preMoveInCompliance: {
      ...existingApplication.preMoveInCompliance,
      checkInScheduled:
        input.decision === "agree"
          ? true
          : existingApplication.preMoveInCompliance.checkInScheduled,
      siteVisit: {
        ...currentSiteVisit,
        status:
          input.decision === "agree" && currentSiteVisit.status === "not_scheduled"
            ? "scheduled"
            : currentSiteVisit.status,
        alternativeSuggestedAt:
          input.decision === "decline"
            ? input.alternativeSuggestedAt ?? currentSiteVisit.alternativeSuggestedAt
            : currentSiteVisit.alternativeSuggestedAt,
        inviteStatus: nextInviteStatus,
        inviteRespondedAt: now,
        inviteLastError: undefined,
      },
    },
  }

  const container = await getApplicationsContainer()
  await syncStoredCommunicationEntries(nextApplication, nextApplication.postMoveInManagement.communicationEntries)
  await container.item(nextApplication.id, nextApplication.applicantId).replace(stripStoredCommunicationEntries(nextApplication))

  await writeAuditEvents([
    {
      entityType: "application",
      entityId: nextApplication.id,
      action: input.decision === "agree" ? "site_visit_invite_confirmed" : "site_visit_invite_declined",
      fieldPath: "preMoveInCompliance.siteVisit",
      oldValue: currentSiteVisit,
      newValue: nextApplication.preMoveInCompliance.siteVisit,
      performedBy: input.responderEmail,
      metadata: {
        applicantId: nextApplication.applicantId,
        propertyId: nextApplication.propertyId,
      },
      timestamp: now,
    },
  ])

  return {
    application: nextApplication,
    alreadyResponded: false,
    existingStatus: null,
    error: null,
  }
}
