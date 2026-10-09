import "server-only"

import { randomUUID } from "node:crypto"

import { type AuthUser, type TenancyApplicationRecord } from "@/lib/auth"
import { writeAuditEvents } from "@/lib/server/audit"
import { getApplicationsContainer } from "@/lib/server/cosmos"
import {
  sendCreditReportRequestNotification,
  sendGuarantorReferenceRequestNotification,
} from "@/lib/server/notifications"
import { createAuthChallenge } from "@/lib/server/auth-security"
import { inspectAuthChallenge } from "@/lib/server/auth-security"
import {
  GUARANTOR_REFERENCE_TOKEN_DURATION_MS,
  assertReviewer,
  normalizeRefereeContact,
  normalizeReferenceRequest,
  createCreditReportRequest,
  getAuditMetadata,
  buildApplicationAuditEvents,
  stripStoredCommunicationEntries,
  syncStoredCommunicationEntries,
  getApplicationById,
  getRefereeRequestExpiry,
  hasActiveReferenceRequest,
  hasActiveEmailReferenceRequest,
} from "./shared"

export async function requestGuarantorReferenceRequestsForApplication(
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

  if (existingApplication.approvalDecision.outcome !== "approved_with_guarantor") {
    throw new Error("GuarantorDecisionRequired")
  }

  const referees = (existingApplication.referencingInstruction.referees ?? []).map((referee) => normalizeRefereeContact(referee))
  const validReferees = referees.filter((referee) => referee.fullName)

  if (validReferees.length === 0) {
    throw new Error("RefereeContactRequired")
  }

  const hasMissingGuarantorChecks = validReferees.some(
    (referee) =>
      !referee.relationship ||
      !referee.relationshipToApplicantConfirmed ||
      !referee.idDocumentCheckComplete ||
      !referee.proofOfAddressCheckComplete,
  )

  if (hasMissingGuarantorChecks) {
    throw new Error("GuarantorPrecheckRequired")
  }

  const now = new Date().toISOString()
  const existingRequests = (existingApplication.referencingInstruction.referenceRequests ?? []).map((request) =>
    normalizeReferenceRequest(request),
  )
  const nextRequests = [...existingRequests]
  let sentCount = 0
  let manualCount = 0
  let failedCount = 0
  let resentCount = 0

  for (const referee of validReferees) {
    const hasActiveRequest = hasActiveReferenceRequest(nextRequests, referee.id)
    const hasActiveEmailRequest = hasActiveEmailReferenceRequest(nextRequests, referee.id)

    if (hasActiveRequest && (!forceResend || !hasActiveEmailRequest)) {
      continue
    }

    const normalizedEmail = referee.email?.trim()
    const isResendAttempt = forceResend && hasActiveEmailRequest

    if (normalizedEmail && referee.preferredChannel === "email") {
      const requestId = randomUUID()
      const challenge = await createAuthChallenge(normalizedEmail, "guarantor_reference", GUARANTOR_REFERENCE_TOKEN_DURATION_MS, {
        applicationId: existingApplication.id,
        refereeId: referee.id,
        requestId,
      })
      const consentUrl = `${appOrigin}/guarantor/consent?token=${encodeURIComponent(challenge.token)}`

      const notificationSent = await sendGuarantorReferenceRequestNotification({
        toEmail: normalizedEmail,
        requestedByEmail: user.email,
        requestedAt: now,
        applicantName: existingApplication.applicantName,
        applicantEmail: existingApplication.applicantEmail,
        propertyAddress: existingApplication.propertyAddress,
        applicationId: existingApplication.id,
        refereeName: referee.fullName,
        consentUrl,
      })

      if (notificationSent) {
        nextRequests.push({
          id: requestId,
          refereeId: referee.id,
          channel: "email",
          status: "sent",
          requestedAt: now,
          requestedByEmail: user.email,
          sentAt: now,
          expiresAt: getRefereeRequestExpiry(now),
        })
        sentCount += 1
        if (isResendAttempt) {
          resentCount += 1
        }
      } else {
        nextRequests.push({
          id: requestId,
          refereeId: referee.id,
          channel: "email",
          status: "failed",
          requestedAt: now,
          requestedByEmail: user.email,
          lastError: "Notification could not be sent.",
        })
        failedCount += 1
        if (isResendAttempt) {
          resentCount += 1
        }
      }

      continue
    }

    if (isResendAttempt) {
      continue
    }

    nextRequests.push({
      id: randomUUID(),
      refereeId: referee.id,
      channel: "manual",
      status: "pending_manual",
      requestedAt: now,
      requestedByEmail: user.email,
    })
    manualCount += 1
  }

  const alreadyRequested = sentCount === 0 && manualCount === 0 && failedCount === 0

  if (alreadyRequested) {
    return {
      application: existingApplication,
      alreadyRequested: true,
      sentCount,
      manualCount,
      failedCount,
      resentCount,
    }
  }

  const nextApplication: TenancyApplicationRecord = {
    ...existingApplication,
    updatedAt: now,
    referencingInstruction: {
      ...existingApplication.referencingInstruction,
      referees: validReferees,
      referenceRequests: nextRequests,
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
      action: "guarantor_reference_requests_submitted",
      fieldPath: "referencingInstruction.referenceRequests",
      oldValue: existingApplication.referencingInstruction.referenceRequests ?? [],
      newValue: nextApplication.referencingInstruction.referenceRequests,
      performedBy: user.email,
      metadata: getAuditMetadata(nextApplication, user),
      timestamp: now,
    },
  ]

  if (auditEvents.length > 0) {
    await writeAuditEvents(auditEvents)
  }

  return {
    application: nextApplication,
    alreadyRequested: false,
    sentCount,
    manualCount,
    failedCount,
    resentCount,
  }
}

export async function recordGuarantorReferenceDecision(input: {
  applicationId: string
  refereeId: string
  requestId: string
  responderEmail: string
  decision: "agree" | "decline"
}) {
  const existingApplication = await getApplicationById(input.applicationId)

  if (!existingApplication) {
    return { application: null, declarationContext: null, error: "ApplicationNotFound" as const }
  }

  const existingRequests = (existingApplication.referencingInstruction.referenceRequests ?? []).map((request) =>
    normalizeReferenceRequest(request),
  )

  const targetIndex = existingRequests.findIndex(
    (request) => request.id === input.requestId && request.refereeId === input.refereeId,
  )

  if (targetIndex === -1) {
    return { application: null, declarationContext: null, error: "RequestNotFound" as const }
  }

  const referee = (existingApplication.referencingInstruction.referees ?? []).find((candidate) => candidate.id === input.refereeId)

  const targetRequest = existingRequests[targetIndex]

  if (targetRequest.status === "completed" || targetRequest.status === "declined") {
    return {
      application: existingApplication,
      declarationContext: null,
      alreadyResponded: true,
      existingStatus: targetRequest.status,
      error: null,
    }
  }

  const now = new Date().toISOString()
  const nextRequests = [...existingRequests]
  const nextStatus = input.decision === "agree" ? "completed" : "declined"
  nextRequests[targetIndex] = {
    ...targetRequest,
    status: nextStatus,
    respondedAt: now,
    lastError: undefined,
  }

  const nextApplication: TenancyApplicationRecord = {
    ...existingApplication,
    updatedAt: now,
    referencingInstruction: {
      ...existingApplication.referencingInstruction,
      referenceRequests: nextRequests,
    },
  }

  const container = await getApplicationsContainer()
  await syncStoredCommunicationEntries(nextApplication, nextApplication.postMoveInManagement.communicationEntries)
  await container.item(nextApplication.id, nextApplication.applicantId).replace(stripStoredCommunicationEntries(nextApplication))

  await writeAuditEvents([
    {
      entityType: "application",
      entityId: nextApplication.id,
      action: input.decision === "agree" ? "guarantor_reference_consent_received" : "guarantor_reference_consent_declined",
      fieldPath: `referencingInstruction.referenceRequests.${targetRequest.id}`,
      oldValue: targetRequest,
      newValue: nextRequests[targetIndex],
      performedBy: input.responderEmail,
      metadata: {
        applicantId: nextApplication.applicantId,
        propertyId: nextApplication.propertyId,
        refereeId: input.refereeId,
      },
      timestamp: now,
    },
  ])

  const nextRequest = nextRequests[targetIndex]
  const declarationContext = referee
    ? {
        applicationId: nextApplication.id,
        applicantName: nextApplication.applicantName,
        applicantEmail: nextApplication.applicantEmail,
        propertyAddress: nextApplication.propertyAddress,
        refereeName: referee.fullName,
        refereeEmail: referee.email ?? input.responderEmail,
        requestedByEmail: nextRequest.requestedByEmail,
        requestedAt: nextRequest.requestedAt,
        requestStatus: nextRequest.status,
        respondedAt: nextRequest.respondedAt ?? null,
        expiresAt: nextRequest.expiresAt ?? null,
      }
    : null

  return {
    application: nextApplication,
    declarationContext,
    alreadyResponded: false,
    existingStatus: null,
    error: null,
  }
}

export async function getGuarantorReferenceConsentContext(token: string) {
  const inspected = await inspectAuthChallenge("guarantor_reference", token)

  if (inspected.error || !inspected.applicationId || !inspected.refereeId || !inspected.requestId) {
    return { context: null, error: "InvalidToken" as const }
  }

  const application = await getApplicationById(inspected.applicationId)

  if (!application) {
    return { context: null, error: "ApplicationNotFound" as const }
  }

  const referee = (application.referencingInstruction.referees ?? []).find((candidate) => candidate.id === inspected.refereeId)
  const request = (application.referencingInstruction.referenceRequests ?? [])
    .map((candidate) => normalizeReferenceRequest(candidate))
    .find((candidate) => candidate.id === inspected.requestId && candidate.refereeId === inspected.refereeId)

  if (!referee || !request) {
    return { context: null, error: "RequestNotFound" as const }
  }

  const canRespond = !inspected.isExpired && !inspected.consumedAt && request.status !== "completed" && request.status !== "declined"

  return {
    context: {
      applicationId: application.id,
      applicantName: application.applicantName,
      applicantEmail: application.applicantEmail,
      propertyAddress: application.propertyAddress,
      refereeName: referee.fullName,
      refereeEmail: referee.email ?? inspected.email ?? "",
      requestedByEmail: request.requestedByEmail,
      requestedAt: request.requestedAt,
      requestStatus: request.status,
      respondedAt: request.respondedAt ?? null,
      expiresAt: request.expiresAt ?? inspected.expiresAt,
      tokenConsumedAt: inspected.consumedAt,
      tokenExpired: inspected.isExpired,
      canRespond,
    },
    error: null,
  }
}

export async function getGuarantorReferenceConsentContextForRequest(user: AuthUser, applicationId: string, requestId: string) {
  assertReviewer(user)

  const application = await getApplicationById(applicationId)

  if (!application) {
    return { context: null, error: "ApplicationNotFound" as const }
  }

  const request = (application.referencingInstruction.referenceRequests ?? [])
    .map((candidate) => normalizeReferenceRequest(candidate))
    .find((candidate) => candidate.id === requestId)

  if (!request) {
    return { context: null, error: "RequestNotFound" as const }
  }

  const referee = (application.referencingInstruction.referees ?? []).find((candidate) => candidate.id === request.refereeId)

  if (!referee) {
    return { context: null, error: "RequestNotFound" as const }
  }

  const expiresAt = request.expiresAt ?? null
  const expiryTime = expiresAt ? Date.parse(expiresAt) : Number.NaN
  const tokenExpired = Number.isFinite(expiryTime) ? Date.now() >= expiryTime : false
  const canRespond = !tokenExpired && request.status !== "completed" && request.status !== "declined"

  return {
    context: {
      applicationId: application.id,
      applicantName: application.applicantName,
      applicantEmail: application.applicantEmail,
      propertyAddress: application.propertyAddress,
      refereeName: referee.fullName,
      refereeEmail: referee.email ?? "",
      requestedByEmail: request.requestedByEmail,
      requestedAt: request.requestedAt,
      requestStatus: request.status,
      respondedAt: request.respondedAt ?? null,
      expiresAt,
      tokenConsumedAt: null,
      tokenExpired,
      canRespond,
    },
    error: null,
  }
}

export async function requestCreditReportForApplication(user: AuthUser, applicationId: string) {
  assertReviewer(user)

  const existingApplication = await getApplicationById(applicationId)

  if (!existingApplication) {
    return null
  }

  if (existingApplication.referencingReport.creditReportRequest?.requested) {
    return {
      application: existingApplication,
      notificationSent: false,
      alreadyRequested: true,
    }
  }

  const now = new Date().toISOString()
  const nextApplication: TenancyApplicationRecord = {
    ...existingApplication,
    updatedAt: now,
    referencingReport: {
      ...existingApplication.referencingReport,
      creditReportRequest: createCreditReportRequest(now, user.email),
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
      action: "credit_report_requested",
      fieldPath: "referencingReport.creditReportRequest",
      oldValue: existingApplication.referencingReport.creditReportRequest,
      newValue: nextApplication.referencingReport.creditReportRequest,
      performedBy: user.email,
      metadata: getAuditMetadata(nextApplication, user),
      timestamp: now,
    },
  ]

  if (auditEvents.length > 0) {
    await writeAuditEvents(auditEvents)
  }

  const notificationSent = await sendCreditReportRequestNotification({
    toEmail: "mike@solutionsdeveloped.co.uk",
    requestedByEmail: user.email,
    requestedAt: now,
    applicantName: nextApplication.applicantName,
    applicantEmail: nextApplication.applicantEmail,
    propertyAddress: nextApplication.propertyAddress,
    applicationId: nextApplication.id,
  })

  return {
    application: nextApplication,
    notificationSent,
    alreadyRequested: false,
  }
}
