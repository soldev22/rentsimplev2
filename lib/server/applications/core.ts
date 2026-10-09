import "server-only"

import { randomUUID } from "node:crypto"

import {
  getDisplayName,
  getUserRole,
  type ApplicantChecklistSignOff,
  type AuthUser,
  type TenancyApplicationRecord,
} from "@/lib/auth"
import { writeAuditEvents } from "@/lib/server/audit"
import { getApplicationCommunicationsContainer, getApplicationsContainer } from "@/lib/server/cosmos"
import {
  buildPaginatedResult,
  fetchQueryPageWithContinuation,
  normalizePageOptions,
  type PageOptions,
} from "@/lib/server/pagination"
import {
  deliverTenantCommunicationNotification,
  sendNewApplicationNotifications,
} from "@/lib/server/notifications"
import {
  DEFAULT_AFFORDABILITY_MULTIPLE,
  getPublicAvailableProperty,
  listPropertiesForUser,
} from "@/lib/server/properties"
import { setUserRoleForWorkflow } from "@/lib/server/users"
import {
  CreateTenancyApplicationInput,
  ApplicantUpdateInput,
  ReviewerUpdateInput,
  assertApplicant,
  assertTenant,
  assertReviewer,
  canApplicantEditApplication,
  canApplicantWithdrawApplication,
  canApplicantCompleteChecklist,
  hasApplicantChecklistUpdate,
  normalizeQuestionnaire,
  createDefaultReferencingInstruction,
  normalizeRefereeContact,
  normalizeReferenceRequest,
  createDefaultReferencingReport,
  createDefaultApprovalDecision,
  createDefaultTenancyAgreement,
  createDefaultApplicantChecklist,
  createDefaultPreMoveInCompliance,
  createDefaultMoveInChecklist,
  createDefaultDepositProtection,
  createDefaultDepositRecord,
  createDefaultPostMoveInManagement,
  normalizeCommunicationEntries,
  hydratePostMoveInManagement,
  sortApplications,
  getAuditMetadata,
  buildApplicationAuditEvents,
  buildCommunicationAuditEvents,
  mergeTenancyDocumentTracking,
  syncDocumentAuditTrail,
  listStoredCommunicationRecordsByApplicationIds,
  hydrateApplicationsWithCommunications,
  stripStoredCommunicationEntries,
  isNotFoundError,
  syncStoredCommunicationEntries,
  getApplicationById,
} from "./shared"

/**
 * Get an application by ID (for system use, not user-scoped)
 */
export async function getApplicationByIdForSystem(id: string) {
  return getApplicationById(id)
}

export async function listApplicationsForApplicant(user: AuthUser) {
  const paged = await listApplicationsForApplicantPage(user, { page: 1, pageSize: 1000 })
  return paged.items
}

export async function listApplicationsForTenant(user: AuthUser) {
  assertTenant(user)

  const container = await getApplicationsContainer()
  const { resources } = await container.items
    .query<TenancyApplicationRecord>({
      query:
        "SELECT * FROM c WHERE c.status = @activeTenantStatus AND (c.applicantId = @applicantId OR c.applicantEmail = @applicantEmail) ORDER BY c.createdAt DESC",
      parameters: [
        { name: "@activeTenantStatus", value: "active_tenant" },
        { name: "@applicantId", value: user.id },
        { name: "@applicantEmail", value: user.email },
      ],
    })
    .fetchAll()

  const hydratedApplications = await hydrateApplicationsWithCommunications(resources)
  return sortApplications(hydratedApplications)
}

export async function listApplicationsForApplicantPage(user: AuthUser, options?: PageOptions) {
  assertApplicant(user)

  const container = await getApplicationsContainer()
  const { page, pageSize, offset } = normalizePageOptions(options, { defaultPageSize: 25, maxPageSize: 100 })
  const countQuery = "SELECT VALUE COUNT(1) FROM c WHERE c.applicantId = @applicantId"
  const dataQuery = `SELECT * FROM c WHERE c.applicantId = @applicantId ORDER BY c.createdAt DESC OFFSET ${offset} LIMIT ${pageSize}`

  const [{ resources: countRows }, { resources }] = await Promise.all([
    container.items
      .query<number>({
        query: countQuery,
        parameters: [{ name: "@applicantId", value: user.id }],
      })
      .fetchAll(),
    container.items
      .query<TenancyApplicationRecord>({
        query: dataQuery,
        parameters: [{ name: "@applicantId", value: user.id }],
      })
      .fetchAll(),
  ])

  const hydratedApplications = await hydrateApplicationsWithCommunications(resources)
  return buildPaginatedResult(sortApplications(hydratedApplications), countRows[0] ?? 0, page, pageSize)
}

export async function listApplicationsForApplicantByContinuation(
  user: AuthUser,
  options?: {
    continuationToken?: string
    maxItemCount?: number
  },
) {
  assertApplicant(user)

  const container = await getApplicationsContainer()
  const page = await fetchQueryPageWithContinuation<TenancyApplicationRecord>(
    container,
    {
      query: "SELECT * FROM c WHERE c.applicantId = @applicantId ORDER BY c.createdAt DESC",
      parameters: [{ name: "@applicantId", value: user.id }],
    },
    options,
  )
  const hydratedApplications = await hydrateApplicationsWithCommunications(page.items)

  return {
    items: sortApplications(hydratedApplications),
    continuationToken: page.continuationToken,
    maxItemCount: page.maxItemCount,
  }
}

export async function getApplicationForApplicant(user: AuthUser, applicationId: string) {
  assertApplicant(user)

  const application = await getApplicationById(applicationId)

  if (!application || application.applicantId !== user.id) {
    return null
  }

  return application
}

export async function listApplicationsForReview(user: AuthUser, landlordId?: string) {
  const paged = await listApplicationsForReviewPage(user, landlordId, { page: 1, pageSize: 1000 })
  return paged.items
}

export async function listApplicationsForReviewPage(
  user: AuthUser,
  landlordId?: string,
  options?: PageOptions & {
    statusFilter?: "withdrawn" | "non_withdrawn"
  },
) {
  assertReviewer(user)

  const container = await getApplicationsContainer()
  const { page, pageSize, offset } = normalizePageOptions(options, { defaultPageSize: 25, maxPageSize: 100 })
  const role = getUserRole(user)
  const statusFilter = options?.statusFilter

  const statusWhereClause =
    statusFilter === "withdrawn"
      ? " c.status = @withdrawnStatus"
      : statusFilter === "non_withdrawn"
        ? " (NOT IS_DEFINED(c.status) OR IS_NULL(c.status) OR c.status != @withdrawnStatus)"
        : ""
  const statusParameters = statusFilter ? [{ name: "@withdrawnStatus", value: "withdrawn" }] : []

  if (role === "admin" && !landlordId) {
    const countQuery = statusWhereClause ? `SELECT VALUE COUNT(1) FROM c WHERE${statusWhereClause}` : "SELECT VALUE COUNT(1) FROM c"
    const dataQuery = statusWhereClause
      ? `SELECT * FROM c WHERE${statusWhereClause} ORDER BY c.createdAt DESC OFFSET ${offset} LIMIT ${pageSize}`
      : `SELECT * FROM c ORDER BY c.createdAt DESC OFFSET ${offset} LIMIT ${pageSize}`

    const [{ resources: countRows }, { resources }] = await Promise.all([
      container.items.query<number>({ query: countQuery, parameters: statusParameters }).fetchAll(),
      container.items
        .query<TenancyApplicationRecord>({
          query: dataQuery,
          parameters: statusParameters,
        })
        .fetchAll(),
    ])

    const hydratedApplications = await hydrateApplicationsWithCommunications(resources)
    return buildPaginatedResult(sortApplications(hydratedApplications), countRows[0] ?? 0, page, pageSize)
  }

  const accessibleProperties = await listPropertiesForUser(user, landlordId)
  const propertyIds = [...new Set(accessibleProperties.map((property) => property.id))]

  if (propertyIds.length === 0) {
    return buildPaginatedResult([] as TenancyApplicationRecord[], 0, page, pageSize)
  }

  const parameters = propertyIds.map((propertyId, index) => ({ name: `@propertyId${index}`, value: propertyId }))
  const inClause = parameters.map((parameter) => parameter.name).join(", ")
  const whereClause = statusWhereClause
    ? ` WHERE c.propertyId IN (${inClause}) AND${statusWhereClause}`
    : ` WHERE c.propertyId IN (${inClause})`
  const countQuery = `SELECT VALUE COUNT(1) FROM c${whereClause}`
  const dataQuery = `SELECT * FROM c${whereClause} ORDER BY c.createdAt DESC OFFSET ${offset} LIMIT ${pageSize}`
  const queryParameters = [...parameters, ...statusParameters]

  const [{ resources: countRows }, { resources }] = await Promise.all([
    container.items.query<number>({ query: countQuery, parameters: queryParameters }).fetchAll(),
    container.items.query<TenancyApplicationRecord>({ query: dataQuery, parameters: queryParameters }).fetchAll(),
  ])

  const hydratedApplications = await hydrateApplicationsWithCommunications(resources)
  return buildPaginatedResult(sortApplications(hydratedApplications), countRows[0] ?? 0, page, pageSize)
}

export async function listApplicationsForReviewByContinuation(
  user: AuthUser,
  landlordId?: string,
  options?: {
    continuationToken?: string
    maxItemCount?: number
  },
) {
  assertReviewer(user)

  const container = await getApplicationsContainer()
  const role = getUserRole(user)

  if (role === "admin" && !landlordId) {
    const page = await fetchQueryPageWithContinuation<TenancyApplicationRecord>(
      container,
      {
        query: "SELECT * FROM c ORDER BY c.createdAt DESC",
      },
      options,
    )
    const hydratedApplications = await hydrateApplicationsWithCommunications(page.items)

    return {
      items: sortApplications(hydratedApplications),
      continuationToken: page.continuationToken,
      maxItemCount: page.maxItemCount,
    }
  }

  const accessibleProperties = await listPropertiesForUser(user, landlordId)
  const propertyIds = [...new Set(accessibleProperties.map((property) => property.id))]

  if (propertyIds.length === 0) {
    return {
      items: [] as TenancyApplicationRecord[],
      continuationToken: undefined,
      maxItemCount: Math.max(1, Math.min(options?.maxItemCount ?? 50, 200)),
    }
  }

  const parameters = propertyIds.map((propertyId, index) => ({ name: `@propertyId${index}`, value: propertyId }))
  const inClause = parameters.map((parameter) => parameter.name).join(", ")
  const page = await fetchQueryPageWithContinuation<TenancyApplicationRecord>(
    container,
    {
      query: `SELECT * FROM c WHERE c.propertyId IN (${inClause}) ORDER BY c.createdAt DESC`,
      parameters,
    },
    options,
  )
  const hydratedApplications = await hydrateApplicationsWithCommunications(page.items)

  return {
    items: sortApplications(hydratedApplications),
    continuationToken: page.continuationToken,
    maxItemCount: page.maxItemCount,
  }
}

export async function createTenancyApplication(user: AuthUser, input: CreateTenancyApplicationInput) {
  assertApplicant(user)

  const questionnaire = normalizeQuestionnaire(input)

  if (!questionnaire.creditCheckConsentGiven) {
    throw new Error("CreditCheckConsentRequired")
  }

  if (questionnaire.preferredContactMethods.length === 0) {
    throw new Error("PreferredContactMethodRequired")
  }

  if (!questionnaire.creditCheckConsentGivenAt) {
    questionnaire.creditCheckConsentGivenAt = new Date().toISOString()
  }

  const property = await getPublicAvailableProperty(questionnaire.propertyId)

  if (!property) {
    return null
  }

  const container = await getApplicationsContainer()
  const { resources: existingApplications } = await container.items
    .query<TenancyApplicationRecord>({
      query: "SELECT * FROM c WHERE c.applicantId = @applicantId AND c.propertyId = @propertyId",
      parameters: [
        { name: "@applicantId", value: user.id },
        { name: "@propertyId", value: property.id },
      ],
    })
    .fetchAll()

  if (existingApplications.some((application) => application.status !== "declined" && application.status !== "withdrawn")) {
    throw new Error("ApplicationAlreadyExists")
  }

  const now = new Date().toISOString()
  const applicationId = randomUUID()
  const application: TenancyApplicationRecord = {
    id: applicationId,
    propertyId: property.id,
    propertyAddress: property.address,
    propertyCity: property.city,
    monthlyRent: property.monthlyRent,
    affordabilityMultiple: property.affordabilityMultiple || DEFAULT_AFFORDABILITY_MULTIPLE,
    applicantId: user.id,
    applicantEmail: user.email,
    applicantName: getDisplayName(user),
    currentStage: "referencing_instruction",
    status: "submitted",
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
    applicantProfile: questionnaire,
    referencingInstruction: createDefaultReferencingInstruction(),
    referencingReport: createDefaultReferencingReport(),
    approvalDecision: createDefaultApprovalDecision(),
    tenancyAgreement: createDefaultTenancyAgreement(property.monthlyRent),
    applicantChecklist: createDefaultApplicantChecklist(),
    preMoveInCompliance: createDefaultPreMoveInCompliance(),
    moveInChecklist: createDefaultMoveInChecklist(),
    depositProtection: createDefaultDepositProtection(),
    depositRecord: createDefaultDepositRecord({
      applicationId,
      propertyId: property.id,
      landlordId: property.ownerId,
      tenantId: user.id,
      amount: createDefaultTenancyAgreement(property.monthlyRent).depositAmount,
    }),
    postMoveInManagement: createDefaultPostMoveInManagement(),
  }

  await container.items.create(stripStoredCommunicationEntries(application))
  await writeAuditEvents([
    {
      entityType: "application",
      entityId: application.id,
      action: "application_created",
      newValue: {
        currentStage: application.currentStage,
        status: application.status,
        applicantId: application.applicantId,
        propertyId: application.propertyId,
      },
      performedBy: user.email,
      metadata: getAuditMetadata(application, user),
      timestamp: application.createdAt,
    },
  ])
  try {
    await sendNewApplicationNotifications(application)
  } catch (error) {
    console.error("Error sending new application notifications:", error)
  }
  return application
}

export async function updateApplicationForApplicant(user: AuthUser, applicationId: string, input: ApplicantUpdateInput) {
  assertApplicant(user)

  const existingApplication = await getApplicationById(applicationId)

  if (!existingApplication || existingApplication.applicantId !== user.id) {
    return null
  }

  if (hasApplicantChecklistUpdate(input)) {
    if (!canApplicantCompleteChecklist(existingApplication)) {
      throw new Error("ApplicantChecklistUnavailable")
    }

    if (!existingApplication.tenancyAgreement.agreementSentForSignature) {
      throw new Error("AgreementNotSentForSignature")
    }

    if (
      !existingApplication.tenancyAgreement.offerLetter.sent ||
      !existingApplication.tenancyAgreement.leaseDocument.sent ||
      !existingApplication.tenancyAgreement.supportingLegalDocuments.sent
    ) {
      throw new Error("RequiredTenancyDocumentsNotIssued")
    }

    const signedFullName =
      typeof input.applicantChecklist?.signedFullName === "string"
        ? input.applicantChecklist.signedFullName.trim()
        : existingApplication.applicantChecklist.signedFullName

    const nextChecklist: ApplicantChecklistSignOff = {
      ...existingApplication.applicantChecklist,
      ...input.applicantChecklist,
      signedFullName,
    }

    if (
      !nextChecklist.applicationInformationConfirmed ||
      !nextChecklist.moveInFundsConfirmed ||
      !nextChecklist.agreementTermsAccepted ||
      !nextChecklist.documentsReadyConfirmed ||
      !signedFullName
    ) {
      throw new Error("ApplicantChecklistIncomplete")
    }

    if (input.agreementSigned !== true && !existingApplication.tenancyAgreement.agreementSigned) {
      throw new Error("AgreementSignatureRequired")
    }

    const now = new Date().toISOString()
    const nextApplication: TenancyApplicationRecord = {
      ...existingApplication,
      updatedAt: now,
      applicantChecklist: {
        ...nextChecklist,
        signedAt: now,
      },
      tenancyAgreement: {
        ...existingApplication.tenancyAgreement,
        agreementSigned: true,
        agreementSignedAt: existingApplication.tenancyAgreement.agreementSignedAt || now,
        leaseDocument: {
          ...existingApplication.tenancyAgreement.leaseDocument,
          signedCopyReceived: true,
          signedCopyReceivedAt: existingApplication.tenancyAgreement.leaseDocument.signedCopyReceivedAt || now,
        },
      },
    }

    const container = await getApplicationsContainer()
    await syncStoredCommunicationEntries(nextApplication, nextApplication.postMoveInManagement.communicationEntries)
    await container.item(nextApplication.id, nextApplication.applicantId).replace(stripStoredCommunicationEntries(nextApplication))
    const auditEvents = [
      ...buildApplicationAuditEvents(existingApplication, nextApplication, user),
      ...buildCommunicationAuditEvents(
        existingApplication.postMoveInManagement.communicationEntries,
        nextApplication.postMoveInManagement.communicationEntries,
        nextApplication,
        user,
      ),
    ]

    if (auditEvents.length > 0) {
      await writeAuditEvents(auditEvents)
    }

    return nextApplication
  }

  if (!canApplicantEditApplication(existingApplication)) {
    throw new Error("ApplicantEditLocked")
  }

  const questionnaire = normalizeQuestionnaire({
    propertyId: existingApplication.propertyId,
    ...existingApplication.applicantProfile,
    ...input,
  })

  if (!questionnaire.creditCheckConsentGiven) {
    throw new Error("CreditCheckConsentRequired")
  }

  if (questionnaire.preferredContactMethods.length === 0) {
    throw new Error("PreferredContactMethodRequired")
  }

  if (!questionnaire.creditCheckConsentGivenAt) {
    questionnaire.creditCheckConsentGivenAt = new Date().toISOString()
  }

  const nextApplication: TenancyApplicationRecord = {
    ...existingApplication,
    updatedAt: new Date().toISOString(),
    applicantProfile: questionnaire,
  }

  const container = await getApplicationsContainer()
  await syncStoredCommunicationEntries(nextApplication, nextApplication.postMoveInManagement.communicationEntries)
  await container.item(nextApplication.id, nextApplication.applicantId).replace(stripStoredCommunicationEntries(nextApplication))
  const auditEvents = [
    ...buildApplicationAuditEvents(existingApplication, nextApplication, user),
    ...buildCommunicationAuditEvents(
      existingApplication.postMoveInManagement.communicationEntries,
      nextApplication.postMoveInManagement.communicationEntries,
      nextApplication,
      user,
    ),
  ]

  if (auditEvents.length > 0) {
    await writeAuditEvents(auditEvents)
  }

  return nextApplication
}

export async function updateApplicationForReviewer(user: AuthUser, applicationId: string, input: ReviewerUpdateInput) {
  assertReviewer(user)

  const existingApplication = await getApplicationById(applicationId)

  if (!existingApplication) {
    return null
  }

  const now = new Date().toISOString()
  const nextOfferLetter = mergeTenancyDocumentTracking(
    existingApplication.tenancyAgreement.offerLetter,
    input.tenancyAgreement?.offerLetter,
  )
  const nextLeaseDocument = mergeTenancyDocumentTracking(
    existingApplication.tenancyAgreement.leaseDocument,
    input.tenancyAgreement?.leaseDocument,
  )
  const nextSupportingLegalDocuments = {
    ...mergeTenancyDocumentTracking(
      existingApplication.tenancyAgreement.supportingLegalDocuments,
      input.tenancyAgreement?.supportingLegalDocuments,
    ),
    summary:
      typeof input.tenancyAgreement?.supportingLegalDocuments?.summary === "string"
        ? input.tenancyAgreement.supportingLegalDocuments.summary.trim()
        : existingApplication.tenancyAgreement.supportingLegalDocuments.summary,
  }

  const nextApplication: TenancyApplicationRecord = {
    ...existingApplication,
    currentStage: input.currentStage ?? existingApplication.currentStage,
    status: input.status ?? existingApplication.status,
    updatedAt: now,
    referencingInstruction: {
      ...existingApplication.referencingInstruction,
      ...input.referencingInstruction,
      referees:
        input.referencingInstruction?.referees !== undefined
          ? input.referencingInstruction.referees.map((referee) => normalizeRefereeContact(referee))
          : existingApplication.referencingInstruction.referees,
      referenceRequests:
        input.referencingInstruction?.referenceRequests !== undefined
          ? input.referencingInstruction.referenceRequests.map((request) => normalizeReferenceRequest(request))
          : existingApplication.referencingInstruction.referenceRequests,
    },
    referencingReport: {
      ...existingApplication.referencingReport,
      ...input.referencingReport,
      checks: {
        ...existingApplication.referencingReport.checks,
        ...(input.referencingReport?.checks ?? {}),
      },
    },
    approvalDecision: {
      ...existingApplication.approvalDecision,
      ...input.approvalDecision,
    },
    tenancyAgreement: {
      ...existingApplication.tenancyAgreement,
      ...input.tenancyAgreement,
      offerLetter: nextOfferLetter,
      leaseDocument: nextLeaseDocument,
      supportingLegalDocuments: nextSupportingLegalDocuments,
    },
    preMoveInCompliance: {
      ...existingApplication.preMoveInCompliance,
      ...input.preMoveInCompliance,
      siteVisit: {
        ...existingApplication.preMoveInCompliance.siteVisit,
        ...(input.preMoveInCompliance?.siteVisit ?? {}),
      },
    },
    moveInChecklist: {
      ...existingApplication.moveInChecklist,
      ...input.moveInChecklist,
    },
    depositProtection: {
      ...existingApplication.depositProtection,
      ...input.depositProtection,
    },
    postMoveInManagement: {
      ...hydratePostMoveInManagement(existingApplication.postMoveInManagement),
      ...input.postMoveInManagement,
      communicationEntries: normalizeCommunicationEntries(
        input.postMoveInManagement?.communicationEntries ?? existingApplication.postMoveInManagement.communicationEntries,
      ),
    },
  }

  const existingCommunicationIds = new Set(existingApplication.postMoveInManagement.communicationEntries.map((entry) => entry.id))
  nextApplication.postMoveInManagement.communicationEntries = await Promise.all(
    nextApplication.postMoveInManagement.communicationEntries.map((entry) =>
      existingCommunicationIds.has(entry.id) ? Promise.resolve(entry) : deliverTenantCommunicationNotification(nextApplication, entry),
    ),
  )
  nextApplication.postMoveInManagement.communicationEntries = await syncStoredCommunicationEntries(
    nextApplication,
    nextApplication.postMoveInManagement.communicationEntries,
  )

  if (nextApplication.tenancyAgreement.agreementSentForSignature && !existingApplication.tenancyAgreement.agreementSentForSignature) {
    nextApplication.tenancyAgreement.agreementSentAt = now
  }

  if (!nextApplication.tenancyAgreement.agreementSentForSignature) {
    nextApplication.tenancyAgreement.agreementSentAt = undefined
  }

  if (nextApplication.preMoveInCompliance.siteVisit.status === "scheduled" || nextApplication.preMoveInCompliance.siteVisit.status === "completed") {
    nextApplication.preMoveInCompliance.checkInScheduled = true
  }

  if (nextApplication.preMoveInCompliance.siteVisit.status === "not_scheduled") {
    nextApplication.preMoveInCompliance.checkInScheduled = false
  }

  if (nextApplication.preMoveInCompliance.siteVisit.status !== "completed") {
    nextApplication.preMoveInCompliance.siteVisit.completedAt = undefined
  }

  if (nextApplication.tenancyAgreement.agreementSigned && !existingApplication.tenancyAgreement.agreementSigned) {
    nextApplication.tenancyAgreement.agreementSignedAt = now
  }

  if (!nextApplication.tenancyAgreement.agreementSigned) {
    nextApplication.tenancyAgreement.agreementSignedAt = undefined
  }

  if (nextApplication.tenancyAgreement.agreementSentForSignature) {
    nextApplication.tenancyAgreement.leaseDocument.sent = true
  }

  if (nextApplication.tenancyAgreement.legalFramework === "england_wales" && nextApplication.tenancyAgreement.tenancyType === "PRT") {
    nextApplication.tenancyAgreement.tenancyType = "AST"
  }

  if (nextApplication.tenancyAgreement.legalFramework === "scotland" && nextApplication.tenancyAgreement.tenancyType === "AST") {
    nextApplication.tenancyAgreement.tenancyType = "PRT"
  }

  if (nextApplication.tenancyAgreement.agreementSigned) {
    nextApplication.tenancyAgreement.leaseDocument.signedCopyReceived = true
  }

  if (nextApplication.tenancyAgreement.leaseDocument.sent) {
    nextApplication.tenancyAgreement.agreementSentForSignature = true
    nextApplication.tenancyAgreement.agreementSentAt = nextApplication.tenancyAgreement.agreementSentAt || now
  }

  if (nextApplication.tenancyAgreement.leaseDocument.signedCopyReceived) {
    nextApplication.tenancyAgreement.agreementSigned = true
    nextApplication.tenancyAgreement.agreementSignedAt = nextApplication.tenancyAgreement.agreementSignedAt || now
  }

  nextApplication.tenancyAgreement.offerLetter = syncDocumentAuditTrail(
    existingApplication.tenancyAgreement.offerLetter,
    nextApplication.tenancyAgreement.offerLetter,
    now,
  )
  nextApplication.tenancyAgreement.leaseDocument = syncDocumentAuditTrail(
    existingApplication.tenancyAgreement.leaseDocument,
    nextApplication.tenancyAgreement.leaseDocument,
    now,
  )
  nextApplication.tenancyAgreement.supportingLegalDocuments = {
    ...syncDocumentAuditTrail(
      existingApplication.tenancyAgreement.supportingLegalDocuments,
      nextApplication.tenancyAgreement.supportingLegalDocuments,
      now,
    ),
    summary: nextApplication.tenancyAgreement.supportingLegalDocuments.summary,
  }

  if (nextApplication.approvalDecision.outcome === "approved") {
    nextApplication.status = "approved"
    nextApplication.currentStage = input.currentStage ?? "agreement"
    nextApplication.approvalDecision.certificateIssuedAt = nextApplication.approvalDecision.certificateIssuedAt || now
  }

  if (nextApplication.approvalDecision.outcome === "approved_with_guarantor") {
    nextApplication.status = "approved_with_guarantor"
    nextApplication.currentStage = input.currentStage ?? "agreement"
    nextApplication.approvalDecision.certificateIssuedAt = nextApplication.approvalDecision.certificateIssuedAt || now
  }

  if (nextApplication.approvalDecision.outcome === "declined") {
    nextApplication.status = "declined"
    nextApplication.currentStage = input.currentStage ?? "decision"
    nextApplication.approvalDecision.certificateIssuedAt = nextApplication.approvalDecision.certificateIssuedAt || now
  }

  if (
    nextApplication.tenancyAgreement.agreementSentForSignature &&
    (nextApplication.approvalDecision.outcome === "approved" || nextApplication.approvalDecision.outcome === "approved_with_guarantor")
  ) {
    nextApplication.currentStage = input.currentStage ?? "agreement"
    nextApplication.status = "agreement_in_progress"
  }

  if (nextApplication.currentStage === "deposit_protection" && nextApplication.depositProtection.protectedWithinThirtyDays) {
    nextApplication.status = "deposit_protected"
  }

  if (nextApplication.currentStage === "post_move_in") {
    nextApplication.status = "active_tenant"
    await setUserRoleForWorkflow(nextApplication.applicantEmail, "tenant", "approved")
  }

  const container = await getApplicationsContainer()
  await container.item(nextApplication.id, nextApplication.applicantId).replace(stripStoredCommunicationEntries(nextApplication))
  const auditEvents = [
    ...buildApplicationAuditEvents(existingApplication, nextApplication, user),
    ...buildCommunicationAuditEvents(
      existingApplication.postMoveInManagement.communicationEntries,
      nextApplication.postMoveInManagement.communicationEntries,
      nextApplication,
      user,
    ),
  ]

  if (auditEvents.length > 0) {
    await writeAuditEvents(auditEvents)
  }

  return nextApplication
}

export async function withdrawApplicationForApplicant(user: AuthUser, applicationId: string) {
  assertApplicant(user)

  const existingApplication = await getApplicationById(applicationId)

  if (!existingApplication || existingApplication.applicantId !== user.id) {
    return null
  }

  if (!canApplicantWithdrawApplication(existingApplication)) {
    throw new Error("ApplicantWithdrawLocked")
  }

  const now = new Date().toISOString()
  const nextApplication: TenancyApplicationRecord = {
    ...existingApplication,
    status: "withdrawn",
    updatedAt: now,
  }

  const container = await getApplicationsContainer()
  await syncStoredCommunicationEntries(nextApplication, nextApplication.postMoveInManagement.communicationEntries)
  await container.item(nextApplication.id, nextApplication.applicantId).replace(stripStoredCommunicationEntries(nextApplication))

  const auditEvents = [
    ...buildApplicationAuditEvents(existingApplication, nextApplication, user),
    ...buildCommunicationAuditEvents(
      existingApplication.postMoveInManagement.communicationEntries,
      nextApplication.postMoveInManagement.communicationEntries,
      nextApplication,
      user,
    ),
    {
      entityType: "application",
      entityId: nextApplication.id,
      action: "application_withdrawn",
      fieldPath: "status",
      oldValue: existingApplication.status,
      newValue: nextApplication.status,
      performedBy: user.email,
      metadata: getAuditMetadata(nextApplication, user),
      timestamp: nextApplication.updatedAt,
    },
  ]

  await writeAuditEvents(auditEvents)

  return nextApplication
}

export async function deleteApplicationForAdmin(user: AuthUser, applicationId: string) {
  if (getUserRole(user) !== "admin") {
    throw new Error("Forbidden")
  }

  const existingApplication = await getApplicationById(applicationId)

  if (!existingApplication) {
    return null
  }

  const applicationsContainer = await getApplicationsContainer()
  const communicationsContainer = await getApplicationCommunicationsContainer()
  const communicationRecords = await listStoredCommunicationRecordsByApplicationIds([existingApplication.id])

  await Promise.all(
    communicationRecords.map((record) =>
      communicationsContainer.item(record.id, record.applicationId).delete().catch((error: unknown) => {
        if (!isNotFoundError(error)) {
          throw error
        }
      }),
    ),
  )

  await applicationsContainer.item(existingApplication.id, existingApplication.applicantId).delete()

  const deletedCheck = await getApplicationById(existingApplication.id)
  if (deletedCheck) {
    throw new Error("ApplicationDeleteFailed")
  }

  await writeAuditEvents([
    {
      entityType: "application",
      entityId: existingApplication.id,
      action: "application_deleted_by_admin",
      oldValue: {
        status: existingApplication.status,
        currentStage: existingApplication.currentStage,
        applicantId: existingApplication.applicantId,
        propertyId: existingApplication.propertyId,
      },
      newValue: null,
      performedBy: user.email,
      metadata: {
        ...getAuditMetadata(existingApplication, user),
        mode: "hard_delete",
      },
      timestamp: new Date().toISOString(),
    },
  ])

  return existingApplication
}
