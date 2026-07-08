import "server-only"

import { randomUUID } from "node:crypto"

import {
  canReviewTenancyApplications,
  getDisplayName,
  getUserRole,
  type ApprovalDecision,
  type ApplicantChecklistSignOff,
  type AuthUser,
  type DepositProtection,
  type FullReferencingChecks,
  type MoveInChecklist,
  type PostMoveInManagement,
  type PreferredContactMethod,
  type PreMoveInCompliance,
  type ApplicationQuestionnaire,
  type ReferencingInstruction,
  type ReferencingReport,
  type RefereeRequestChannel,
  type TenancyCreditReportRequest,
  type TenancyRefereeContact,
  type TenancyReferenceRequest,
  type TenancyReferenceRequestStatus,
  type TenancyVerificationDocument,
  type TenancyVerificationDocumentCategory,
  type TenancyDocumentTracking,
  type TenancyAgreementPreparation,
  type TenancyApplicationRecord,
  type TenancyApplicationStage,
  type TenancyApplicationStatus,
  type TenantCommunicationNotification,
  type TenantCommunicationEntry,
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
  sendCreditReportRequestNotification,
  sendGuarantorReferenceRequestNotification,
} from "@/lib/server/notifications"
import { DEFAULT_AFFORDABILITY_MULTIPLE, getPublicAvailableProperty, listPropertiesForUser } from "@/lib/server/properties"
import { setUserRoleForWorkflow } from "@/lib/server/users"
import {
  deleteTenancyVerificationDocument,
  downloadTenancyVerificationDocument,
  uploadTenancyVerificationDocument,
} from "@/lib/server/blob"
import { createAuthChallenge } from "@/lib/server/auth-security"
import { inspectAuthChallenge } from "@/lib/server/auth-security"

const LEGACY_COMMUNICATION_ENTRY_ID = "legacy-communication-notes"

type ApplicationCommunicationRecord = TenantCommunicationEntry & {
  applicationId: string
  applicantId: string
  propertyId: string
  createdAt: string
  updatedAt: string
}

type CreateTenancyApplicationInput = ApplicationQuestionnaire & {
  propertyId: string
}

type ApplicantUpdateInput = Partial<ApplicationQuestionnaire> &
  Partial<{
    applicantChecklist: Partial<ApplicantChecklistSignOff>
    agreementSigned: boolean
  }>

type ReviewerUpdateInput = Partial<{
  currentStage: TenancyApplicationStage
  status: TenancyApplicationStatus
  referencingInstruction: Partial<ReferencingInstruction>
  referencingReport: Partial<ReferencingReport> & {
    checks?: Partial<FullReferencingChecks>
  }
  approvalDecision: Partial<ApprovalDecision>
  tenancyAgreement: Partial<TenancyAgreementPreparation>
  preMoveInCompliance: Partial<PreMoveInCompliance>
  moveInChecklist: Partial<MoveInChecklist>
  depositProtection: Partial<DepositProtection>
  postMoveInManagement: Partial<PostMoveInManagement>
}>

const APPLICATION_AUDIT_FIELDS = [
  { path: "currentStage", action: "stage_changed" },
  { path: "status", action: "status_changed" },
  { path: "applicantProfile", action: "applicant_profile_updated" },
  { path: "referencingInstruction", action: "referencing_instruction_updated" },
  { path: "referencingReport", action: "referencing_report_updated" },
  { path: "approvalDecision", action: "approval_decision_updated" },
  { path: "tenancyAgreement", action: "tenancy_agreement_updated" },
  { path: "applicantChecklist", action: "applicant_checklist_updated" },
  { path: "preMoveInCompliance", action: "pre_move_in_compliance_updated" },
  { path: "moveInChecklist", action: "move_in_checklist_updated" },
  { path: "depositProtection", action: "deposit_protection_updated" },
  { path: "postMoveInManagement.firstInspectionDate", action: "first_inspection_updated" },
  { path: "postMoveInManagement.maintenanceLogNotes", action: "maintenance_log_updated" },
  { path: "postMoveInManagement.communicationLogNotes", action: "communication_notes_updated" },
] as const

const TENANCY_VERIFICATION_DOCUMENT_CATEGORIES: TenancyVerificationDocumentCategory[] = [
  "noIdRequired",
  "photoIdReceived",
  "proofOfAddressReceived",
  "creditReferenceCheckReceived",
  "previousLandlordReferenceReceived",
  "incomeEvidenceReceived",
]

const GUARANTOR_REFERENCE_TOKEN_DURATION_MS = 1000 * 60 * 60 * 24 * 7

function assertApplicant(user: AuthUser) {
  if (getUserRole(user) !== "applicant") {
    throw new Error("Forbidden")
  }
}

function assertReviewer(user: AuthUser) {
  if (!canReviewTenancyApplications(user)) {
    throw new Error("Forbidden")
  }
}

function hasFinalDecision(application: TenancyApplicationRecord) {
  return (
    application.approvalDecision.outcome === "approved" ||
    application.approvalDecision.outcome === "approved_with_guarantor" ||
    application.approvalDecision.outcome === "declined"
  )
}

function canApplicantEditApplication(application: TenancyApplicationRecord) {
  return (
    application.status !== "withdrawn" &&
    application.status !== "active_tenant" &&
    application.status !== "declined" &&
    !hasFinalDecision(application)
  )
}

function canApplicantWithdrawApplication(application: TenancyApplicationRecord) {
  return (
    application.status !== "withdrawn" &&
    application.status !== "active_tenant" &&
    !hasFinalDecision(application)
  )
}

function canApplicantCompleteChecklist(application: TenancyApplicationRecord) {
  return application.approvalDecision.outcome === "approved" || application.approvalDecision.outcome === "approved_with_guarantor"
}

function hasApplicantChecklistUpdate(input: ApplicantUpdateInput) {
  return typeof input.agreementSigned === "boolean" || typeof input.applicantChecklist === "object"
}

function toNonNegativeNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

function normalizeQuestionnaire(input: CreateTenancyApplicationInput): CreateTenancyApplicationInput {
  const preferredContactMethods = Array.isArray(input.preferredContactMethods)
    ? input.preferredContactMethods.filter((value): value is PreferredContactMethod =>
        value === "email" || value === "phone" || value === "sms" || value === "whatsapp",
      )
    : []

  return {
    propertyId: input.propertyId,
    employmentStatus: input.employmentStatus,
    annualIncome: toNonNegativeNumber(input.annualIncome),
    moveInDate: typeof input.moveInDate === "string" ? input.moveInDate.trim() : "",
    preferredContactMethods,
    hasPets: Boolean(input.hasPets),
    petDetails: typeof input.petDetails === "string" ? input.petDetails.trim() : "",
    smokes: Boolean(input.smokes),
    occupantCount: Math.max(1, Math.round(toNonNegativeNumber(input.occupantCount) || 1)),
    hasAdverseCredit: Boolean(input.hasAdverseCredit),
    adverseCreditDetails: typeof input.adverseCreditDetails === "string" ? input.adverseCreditDetails.trim() : "",
    creditCheckConsentGiven: Boolean(input.creditCheckConsentGiven),
    creditCheckConsentGivenAt:
      typeof input.creditCheckConsentGivenAt === "string" ? input.creditCheckConsentGivenAt.trim() : "",
    creditCheckConsentVersion:
      typeof input.creditCheckConsentVersion === "string" && input.creditCheckConsentVersion.trim()
        ? input.creditCheckConsentVersion.trim()
        : "tenant-credit-check-consent-v1",
  }
}

function createDefaultReferencingInstruction(): ReferencingInstruction {
  return {
    noIdRequired: false,
    photoIdReceived: false,
    proofOfAddressReceived: false,
    creditReferenceCheckReceived: false,
    previousLandlordReferenceReceived: false,
    incomeEvidenceReceived: false,
    verificationNotRequired: {
      noIdRequired: false,
      photoIdReceived: false,
      proofOfAddressReceived: false,
      creditReferenceCheckReceived: false,
      previousLandlordReferenceReceived: false,
      incomeEvidenceReceived: false,
    },
    verificationDocuments: [],
    referees: [],
    referenceRequests: [],
    employerContactDetails: "",
    previousLandlordContactDetails: "",
    notes: "",
  }
}

function normalizeRefereeChannel(value: unknown): RefereeRequestChannel {
  return value === "email" || value === "phone" || value === "sms" || value === "postal" || value === "manual"
    ? value
    : "email"
}

function normalizeRefereeContact(referee: Partial<TenancyRefereeContact>): TenancyRefereeContact {
  return {
    id: typeof referee.id === "string" && referee.id.trim() ? referee.id : randomUUID(),
    fullName: typeof referee.fullName === "string" ? referee.fullName.trim() : "",
    relationship: typeof referee.relationship === "string" ? referee.relationship.trim() : "",
    relationshipToApplicantConfirmed: Boolean(referee.relationshipToApplicantConfirmed),
    idDocumentCheckComplete: Boolean(referee.idDocumentCheckComplete),
    proofOfAddressCheckComplete: Boolean(referee.proofOfAddressCheckComplete),
    email: typeof referee.email === "string" && referee.email.trim() ? referee.email.trim() : undefined,
    phone: typeof referee.phone === "string" && referee.phone.trim() ? referee.phone.trim() : undefined,
    preferredChannel: normalizeRefereeChannel(referee.preferredChannel),
    postalAddress:
      typeof referee.postalAddress === "string" && referee.postalAddress.trim() ? referee.postalAddress.trim() : undefined,
    notes: typeof referee.notes === "string" && referee.notes.trim() ? referee.notes.trim() : undefined,
  }
}

function normalizeReferenceRequestStatus(value: unknown): TenancyReferenceRequestStatus {
  return value === "not_requested" ||
    value === "pending_delivery" ||
    value === "sent" ||
    value === "pending_manual" ||
    value === "received_manual" ||
    value === "completed" ||
    value === "declined" ||
    value === "failed"
    ? value
    : "not_requested"
}

function normalizeReferenceRequest(request: Partial<TenancyReferenceRequest>): TenancyReferenceRequest {
  return {
    id: typeof request.id === "string" && request.id.trim() ? request.id : randomUUID(),
    refereeId: typeof request.refereeId === "string" ? request.refereeId.trim() : "",
    channel: normalizeRefereeChannel(request.channel),
    status: normalizeReferenceRequestStatus(request.status),
    requestedAt: typeof request.requestedAt === "string" ? request.requestedAt : new Date().toISOString(),
    requestedByEmail: typeof request.requestedByEmail === "string" ? request.requestedByEmail : "",
    sentAt: typeof request.sentAt === "string" ? request.sentAt : undefined,
    respondedAt: typeof request.respondedAt === "string" ? request.respondedAt : undefined,
    expiresAt: typeof request.expiresAt === "string" ? request.expiresAt : undefined,
    lastError: typeof request.lastError === "string" ? request.lastError : undefined,
  }
}

function isValidTenancyVerificationDocumentCategory(
  value: string,
): value is TenancyVerificationDocumentCategory {
  return TENANCY_VERIFICATION_DOCUMENT_CATEGORIES.includes(value as TenancyVerificationDocumentCategory)
}

function createDefaultReferencingReport(): ReferencingReport {
  return {
    outcome: "pending",
    summary: "",
    checks: {
      identityDocumentVerified: false,
      addressVerified: false,
      fraudMarkersClear: false,
      creditFileReviewed: false,
      creditIssuesClear: false,
      linkedAddressesReviewed: false,
      creditScore: "",
      affordabilityVerified: false,
      employmentReferenceVerified: false,
      previousLandlordReferenceVerified: false,
      guarantorRequired: false,
      guarantorVerified: false,
      guarantorAnnualIncome: 0,
      notes: "",
    },
    creditReportRequest: {
      requested: false,
      status: "not_requested",
    },
  }
}

function createCreditReportRequest(requestedAt: string, requestedByEmail: string): TenancyCreditReportRequest {
  return {
    requested: true,
    requestedAt,
    requestedByEmail,
    status: "requested",
  }
}

function createDefaultApprovalDecision(): ApprovalDecision {
  return {
    outcome: "pending",
    rationale: "",
  }
}

function createDefaultTenancyDocumentTracking(): TenancyDocumentTracking {
  return {
    reference: "",
    url: "",
    sent: false,
    sentAt: undefined,
    signedCopyReceived: false,
    signedCopyReceivedAt: undefined,
  }
}

function createDefaultTenancyAgreement(rentAmount: number): TenancyAgreementPreparation {
  return {
    legalFramework: "",
    tenancyType: "",
    rentAmount,
    rentDueDate: "",
    depositAmount: 0,
    termLengthMonths: 0,
    guarantorDeedRequired: false,
    agreementProvider: "",
    agreementReference: "",
    agreementSigningUrl: "",
    agreementSentForSignature: false,
    agreementSentAt: undefined,
    agreementSigned: false,
    agreementSignedAt: undefined,
    offerLetter: createDefaultTenancyDocumentTracking(),
    leaseDocument: createDefaultTenancyDocumentTracking(),
    supportingLegalDocuments: {
      ...createDefaultTenancyDocumentTracking(),
      summary: "",
    },
  }
}

function createDefaultApplicantChecklist(): ApplicantChecklistSignOff {
  return {
    applicationInformationConfirmed: false,
    moveInFundsConfirmed: false,
    agreementTermsAccepted: false,
    documentsReadyConfirmed: false,
    signedFullName: "",
    signedAt: undefined,
  }
}

function createDefaultPreMoveInCompliance(): PreMoveInCompliance {
  return {
    epcIssued: false,
    gasSafetyIssued: false,
    eicrIssued: false,
    howToRentIssued: false,
    depositLeafletIssued: false,
    checkInScheduled: false,
    inventoryPrepared: false,
    siteVisit: {
      status: "not_scheduled",
      scheduledAt: undefined,
      completedAt: undefined,
      assigneeName: "",
      notes: "",
    },
  }
}

function createDefaultMoveInChecklist(): MoveInChecklist {
  return {
    inspectionCompleted: false,
    inventoryCompletedWithPhotos: false,
    meterReadingsRecorded: false,
    smokeAlarmsTested: false,
    keysIssued: false,
    keyNumbers: "",
    tenantContactConfirmed: false,
  }
}

function createDefaultDepositProtection(): DepositProtection {
  return {
    protectedWithinThirtyDays: false,
    prescribedInformationIssued: false,
    certificateUploaded: false,
    certificateReference: "",
  }
}

function createDefaultPostMoveInManagement(): PostMoveInManagement {
  return {
    firstInspectionDate: "",
    maintenanceLogNotes: "",
    communicationLogNotes: "",
    communicationEntries: [],
  }
}

function createLegacyCommunicationEntry(summary: string): TenantCommunicationEntry {
  return {
    id: LEGACY_COMMUNICATION_ENTRY_ID,
    occurredAt: new Date().toISOString(),
    channel: "other",
    direction: "outbound",
    subject: "Legacy communication notes",
    summary,
    recordedByName: "Legacy migration",
  }
}

function normalizeCommunicationEntry(entry: Partial<TenantCommunicationEntry> | undefined): TenantCommunicationEntry | null {
  if (!entry) {
    return null
  }

  const subject = typeof entry.subject === "string" ? entry.subject.trim() : ""
  const summary = typeof entry.summary === "string" ? entry.summary.trim() : ""

  if (!subject || !summary) {
    return null
  }

  const notification = normalizeCommunicationNotification(entry.notification)

  return {
    id: typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : randomUUID(),
    occurredAt: typeof entry.occurredAt === "string" && entry.occurredAt.trim() ? entry.occurredAt.trim() : new Date().toISOString(),
    channel:
      entry.channel === "email" ||
      entry.channel === "phone" ||
      entry.channel === "sms" ||
      entry.channel === "whatsapp" ||
      entry.channel === "portal" ||
      entry.channel === "letter" ||
      entry.channel === "in_person" ||
      entry.channel === "other"
        ? entry.channel
        : "other",
    direction: entry.direction === "inbound" ? "inbound" : "outbound",
    subject,
    summary,
    recordedByName: typeof entry.recordedByName === "string" && entry.recordedByName.trim() ? entry.recordedByName.trim() : "System",
    notification,
  }
}

function normalizeCommunicationNotification(
  notification: Partial<TenantCommunicationNotification> | undefined,
): TenantCommunicationNotification | undefined {
  if (!notification || typeof notification.status !== "string") {
    return undefined
  }

  const status =
    notification.status === "pending" ||
    notification.status === "sent" ||
    notification.status === "skipped" ||
    notification.status === "failed" ||
    notification.status === "not_applicable"
      ? notification.status
      : "not_applicable"

  return {
    channel: notification.channel === "email" || notification.channel === "sms" ? notification.channel : undefined,
    target: typeof notification.target === "string" ? notification.target.trim() : undefined,
    status,
    attemptedAt: typeof notification.attemptedAt === "string" ? notification.attemptedAt.trim() : undefined,
    sentAt: typeof notification.sentAt === "string" ? notification.sentAt.trim() : undefined,
    fromAddress: typeof notification.fromAddress === "string" ? notification.fromAddress.trim() : undefined,
    replyTo: typeof notification.replyTo === "string" ? notification.replyTo.trim() : undefined,
    copiedTo: Array.isArray(notification.copiedTo)
      ? notification.copiedTo.filter((value): value is string => typeof value === "string" && value.trim().length > 0).map((value) => value.trim())
      : undefined,
    detail: typeof notification.detail === "string" ? notification.detail.trim() : "",
  }
}

function normalizeCommunicationEntries(entries: Partial<TenantCommunicationEntry>[] | undefined) {
  if (!Array.isArray(entries)) {
    return [] as TenantCommunicationEntry[]
  }

  return entries
    .map((entry) => normalizeCommunicationEntry(entry))
    .filter((entry): entry is TenantCommunicationEntry => Boolean(entry))
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
}

function mergeCommunicationEntries(...groups: Array<Partial<TenantCommunicationEntry>[] | undefined>) {
  const merged = new Map<string, TenantCommunicationEntry>()

  groups.forEach((group) => {
    normalizeCommunicationEntries(group).forEach((entry) => {
      merged.set(entry.id, entry)
    })
  })

  return normalizeCommunicationEntries([...merged.values()])
}

function hydratePostMoveInManagement(
  postMoveInManagement: Partial<PostMoveInManagement> | undefined,
  options?: { includeLegacyCommunicationEntry?: boolean },
) {
  const defaults = createDefaultPostMoveInManagement()
  const legacyCommunicationLogNotes =
    typeof postMoveInManagement?.communicationLogNotes === "string" ? postMoveInManagement.communicationLogNotes.trim() : ""
  const communicationEntries = normalizeCommunicationEntries(postMoveInManagement?.communicationEntries)

  if (options?.includeLegacyCommunicationEntry !== false && legacyCommunicationLogNotes && communicationEntries.length === 0) {
    communicationEntries.push(createLegacyCommunicationEntry(legacyCommunicationLogNotes))
  }

  return {
    ...defaults,
    ...postMoveInManagement,
    firstInspectionDate:
      typeof postMoveInManagement?.firstInspectionDate === "string" ? postMoveInManagement.firstInspectionDate.trim() : "",
    maintenanceLogNotes:
      typeof postMoveInManagement?.maintenanceLogNotes === "string" ? postMoveInManagement.maintenanceLogNotes.trim() : "",
    communicationLogNotes: legacyCommunicationLogNotes,
    communicationEntries,
  }
}

function sortApplications(applications: TenancyApplicationRecord[]) {
  return [...applications].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
}

function getAuditMetadata(application: TenancyApplicationRecord, user: AuthUser) {
  return {
    applicantId: application.applicantId,
    propertyId: application.propertyId,
    performedByRole: getUserRole(user),
  }
}

function getValueAtPath(record: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((value, segment) => {
    if (!value || typeof value !== "object") {
      return undefined
    }

    return (value as Record<string, unknown>)[segment]
  }, record)
}

function areAuditValuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

function buildApplicationAuditEvents(
  previousApplication: TenancyApplicationRecord,
  nextApplication: TenancyApplicationRecord,
  user: AuthUser,
) {
  return APPLICATION_AUDIT_FIELDS.flatMap(({ path, action }) => {
    const oldValue = getValueAtPath(previousApplication as unknown as Record<string, unknown>, path)
    const newValue = getValueAtPath(nextApplication as unknown as Record<string, unknown>, path)

    if (areAuditValuesEqual(oldValue, newValue)) {
      return []
    }

    return [
      {
        entityType: "application",
        entityId: nextApplication.id,
        action,
        fieldPath: path,
        oldValue,
        newValue,
        performedBy: user.email,
        metadata: getAuditMetadata(nextApplication, user),
        timestamp: nextApplication.updatedAt,
      },
    ]
  })
}

function buildCommunicationAuditEvents(
  previousEntries: TenantCommunicationEntry[],
  nextEntries: TenantCommunicationEntry[],
  application: TenancyApplicationRecord,
  user: AuthUser,
) {
  const previousEntriesById = new Map(previousEntries.map((entry) => [entry.id, entry]))
  const nextEntriesById = new Map(nextEntries.map((entry) => [entry.id, entry]))
  const metadata = getAuditMetadata(application, user)
  const timestamp = application.updatedAt
  const events: Array<{
    entityType: string
    entityId: string
    action: string
    fieldPath: string
    oldValue?: TenantCommunicationEntry
    newValue?: TenantCommunicationEntry
    performedBy: string
    metadata: ReturnType<typeof getAuditMetadata>
    timestamp: string
  }> = []

  nextEntries.forEach((entry) => {
    const previousEntry = previousEntriesById.get(entry.id)

    if (!previousEntry) {
      events.push({
        entityType: "application",
        entityId: application.id,
        action: "communication_entry_added",
        fieldPath: `postMoveInManagement.communicationEntries.${entry.id}`,
        newValue: entry,
        performedBy: user.email,
        metadata,
        timestamp,
      })
      return
    }

    if (!areAuditValuesEqual(previousEntry, entry)) {
      events.push({
        entityType: "application",
        entityId: application.id,
        action: "communication_entry_updated",
        fieldPath: `postMoveInManagement.communicationEntries.${entry.id}`,
        oldValue: previousEntry,
        newValue: entry,
        performedBy: user.email,
        metadata,
        timestamp,
      })
    }
  })

  previousEntries.forEach((entry) => {
    if (!nextEntriesById.has(entry.id)) {
      events.push({
        entityType: "application",
        entityId: application.id,
        action: "communication_entry_deleted",
        fieldPath: `postMoveInManagement.communicationEntries.${entry.id}`,
        oldValue: entry,
        performedBy: user.email,
        metadata,
        timestamp,
      })
    }
  })

  return events
}

function mergeTenancyDocumentTracking(
  existingDocument: TenancyDocumentTracking,
  inputDocument: Partial<TenancyDocumentTracking> | undefined,
) {
  return {
    ...existingDocument,
    ...(inputDocument ?? {}),
  }
}

function syncDocumentAuditTrail(
  existingDocument: TenancyDocumentTracking,
  nextDocument: TenancyDocumentTracking,
  now: string,
): TenancyDocumentTracking {
  const syncedDocument = { ...nextDocument }

  if (syncedDocument.sent && !existingDocument.sent) {
    syncedDocument.sentAt = syncedDocument.sentAt || now
  }

  if (!syncedDocument.sent) {
    syncedDocument.sentAt = undefined
  }

  if (syncedDocument.signedCopyReceived && !existingDocument.signedCopyReceived) {
    syncedDocument.signedCopyReceivedAt = syncedDocument.signedCopyReceivedAt || now
  }

  if (!syncedDocument.signedCopyReceived) {
    syncedDocument.signedCopyReceivedAt = undefined
  }

  return syncedDocument
}

function hydrateStoredApplication(application: TenancyApplicationRecord): TenancyApplicationRecord {
  const defaultTenancyAgreement = createDefaultTenancyAgreement(application.monthlyRent)
  const defaultReferencingInstruction = createDefaultReferencingInstruction()
  const defaultReferencingReport = createDefaultReferencingReport()
  const defaultCreditReportRequest = defaultReferencingReport.creditReportRequest ?? {
    requested: false,
    status: "not_requested" as const,
  }
  const defaultApprovalDecision = createDefaultApprovalDecision()
  const defaultPreMoveInCompliance = createDefaultPreMoveInCompliance()

  return {
    ...application,
    affordabilityMultiple: toNonNegativeNumber(application.affordabilityMultiple) || DEFAULT_AFFORDABILITY_MULTIPLE,
    referencingInstruction: {
      ...defaultReferencingInstruction,
      ...application.referencingInstruction,
      verificationNotRequired: {
        ...defaultReferencingInstruction.verificationNotRequired,
        ...(application.referencingInstruction?.verificationNotRequired ?? {}),
      },
      verificationDocuments: application.referencingInstruction?.verificationDocuments ?? [],
      referees: (application.referencingInstruction?.referees ?? []).map((referee) => normalizeRefereeContact(referee)),
      referenceRequests: (application.referencingInstruction?.referenceRequests ?? []).map((request) =>
        normalizeReferenceRequest(request),
      ),
      employerContactDetails:
        typeof application.referencingInstruction?.employerContactDetails === "string"
          ? application.referencingInstruction.employerContactDetails.trim()
          : "",
      previousLandlordContactDetails:
        typeof application.referencingInstruction?.previousLandlordContactDetails === "string"
          ? application.referencingInstruction.previousLandlordContactDetails.trim()
          : "",
      notes: typeof application.referencingInstruction?.notes === "string" ? application.referencingInstruction.notes.trim() : "",
    },
    referencingReport: {
      ...defaultReferencingReport,
      ...application.referencingReport,
      checks: {
        ...defaultReferencingReport.checks,
        ...(application.referencingReport?.checks ?? {}),
      },
      creditReportRequest: {
        ...defaultCreditReportRequest,
        ...(application.referencingReport?.creditReportRequest ?? {}),
        requested: Boolean(
          application.referencingReport?.creditReportRequest?.requested ??
            defaultCreditReportRequest.requested,
        ),
        status:
          application.referencingReport?.creditReportRequest?.status ??
          defaultCreditReportRequest.status,
      },
    },
    approvalDecision: {
      ...defaultApprovalDecision,
      ...application.approvalDecision,
    },
    tenancyAgreement: {
      ...defaultTenancyAgreement,
      ...application.tenancyAgreement,
      offerLetter: mergeTenancyDocumentTracking(
        defaultTenancyAgreement.offerLetter,
        application.tenancyAgreement?.offerLetter,
      ),
      leaseDocument: mergeTenancyDocumentTracking(
        defaultTenancyAgreement.leaseDocument,
        application.tenancyAgreement?.leaseDocument,
      ),
      supportingLegalDocuments: {
        ...mergeTenancyDocumentTracking(
          defaultTenancyAgreement.supportingLegalDocuments,
          application.tenancyAgreement?.supportingLegalDocuments,
        ),
        summary:
          typeof application.tenancyAgreement?.supportingLegalDocuments?.summary === "string"
            ? application.tenancyAgreement.supportingLegalDocuments.summary.trim()
            : "",
      },
    },
    applicantChecklist: {
      ...createDefaultApplicantChecklist(),
      ...application.applicantChecklist,
      signedFullName:
        typeof application.applicantChecklist?.signedFullName === "string"
          ? application.applicantChecklist.signedFullName.trim()
          : "",
    },
    preMoveInCompliance: {
      ...defaultPreMoveInCompliance,
      ...application.preMoveInCompliance,
      siteVisit: {
        ...defaultPreMoveInCompliance.siteVisit,
        ...(application.preMoveInCompliance?.siteVisit ?? {}),
        // Keep legacy checkbox behavior intact while transitioning to structured site-visit workflow.
        status:
          application.preMoveInCompliance?.siteVisit?.status ??
          (application.preMoveInCompliance?.checkInScheduled ? "scheduled" : "not_scheduled"),
        assigneeName:
          typeof application.preMoveInCompliance?.siteVisit?.assigneeName === "string"
            ? application.preMoveInCompliance.siteVisit.assigneeName.trim()
            : "",
        notes:
          typeof application.preMoveInCompliance?.siteVisit?.notes === "string"
            ? application.preMoveInCompliance.siteVisit.notes.trim()
            : "",
      },
    },
    applicantProfile: normalizeQuestionnaire({
      propertyId: application.propertyId,
      employmentStatus: application.applicantProfile?.employmentStatus ?? "other",
      annualIncome: application.applicantProfile?.annualIncome ?? 0,
      moveInDate: application.applicantProfile?.moveInDate ?? "",
      preferredContactMethods: application.applicantProfile?.preferredContactMethods ?? [],
      hasPets: application.applicantProfile?.hasPets ?? false,
      petDetails: application.applicantProfile?.petDetails ?? "",
      smokes: application.applicantProfile?.smokes ?? false,
      occupantCount: application.applicantProfile?.occupantCount ?? 1,
      hasAdverseCredit: application.applicantProfile?.hasAdverseCredit ?? false,
      adverseCreditDetails: application.applicantProfile?.adverseCreditDetails ?? "",
      creditCheckConsentGiven: application.applicantProfile?.creditCheckConsentGiven ?? false,
      creditCheckConsentGivenAt: application.applicantProfile?.creditCheckConsentGivenAt ?? "",
      creditCheckConsentVersion: application.applicantProfile?.creditCheckConsentVersion ?? "tenant-credit-check-consent-v1",
    }),
    postMoveInManagement: hydratePostMoveInManagement(application.postMoveInManagement, {
      includeLegacyCommunicationEntry: false,
    }),
  }
}

async function listStoredCommunicationRecordsByApplicationIds(applicationIds: string[]) {
  if (applicationIds.length === 0) {
    return [] as ApplicationCommunicationRecord[]
  }

  const container = await getApplicationCommunicationsContainer()
  const { resources } = await container.items
    .query<ApplicationCommunicationRecord>({
      query: "SELECT * FROM c WHERE ARRAY_CONTAINS(@applicationIds, c.applicationId)",
      parameters: [{ name: "@applicationIds", value: applicationIds }],
    })
    .fetchAll()

  return resources
}

async function listStoredCommunicationEntriesByApplicationId(applicationIds: string[]) {
  const records = await listStoredCommunicationRecordsByApplicationIds(applicationIds)
  const groupedEntries = new Map<string, TenantCommunicationEntry[]>()

  records.forEach((record) => {
    const existingEntries = groupedEntries.get(record.applicationId) ?? []
    existingEntries.push({
      id: record.id,
      occurredAt: record.occurredAt,
      channel: record.channel,
      direction: record.direction,
      subject: record.subject,
      summary: record.summary,
      recordedByName: record.recordedByName,
      notification: record.notification,
    })
    groupedEntries.set(record.applicationId, existingEntries)
  })

  groupedEntries.forEach((entries, applicationId) => {
    groupedEntries.set(applicationId, normalizeCommunicationEntries(entries))
  })

  return groupedEntries
}

async function hydrateApplicationsWithCommunications(applications: TenancyApplicationRecord[]) {
  if (applications.length === 0) {
    return [] as TenancyApplicationRecord[]
  }

  const hydratedApplications = applications.map(hydrateStoredApplication)
  const entriesByApplicationId = await listStoredCommunicationEntriesByApplicationId(
    hydratedApplications.map((application) => application.id),
  )

  return hydratedApplications.map((application) => {
    const mergedEntries = mergeCommunicationEntries(
      application.postMoveInManagement.communicationEntries,
      entriesByApplicationId.get(application.id),
    )
    const nextEntries =
      mergedEntries.length > 0 || !application.postMoveInManagement.communicationLogNotes
        ? mergedEntries
        : [createLegacyCommunicationEntry(application.postMoveInManagement.communicationLogNotes)]

    return {
      ...application,
      postMoveInManagement: {
        ...application.postMoveInManagement,
        communicationEntries: nextEntries,
      },
    }
  })
}

async function hydrateApplicationWithCommunications(application: TenancyApplicationRecord | null) {
  if (!application) {
    return null
  }

  const [hydratedApplication] = await hydrateApplicationsWithCommunications([application])
  return hydratedApplication ?? null
}

function stripStoredCommunicationEntries(application: TenancyApplicationRecord): TenancyApplicationRecord {
  return {
    ...application,
    postMoveInManagement: {
      ...hydratePostMoveInManagement(application.postMoveInManagement, {
        includeLegacyCommunicationEntry: false,
      }),
      communicationEntries: [],
    },
  }
}

function isNotFoundError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 404
}

async function syncStoredCommunicationEntries(application: TenancyApplicationRecord, entries: TenantCommunicationEntry[]) {
  const container = await getApplicationCommunicationsContainer()
  const existingRecords = await listStoredCommunicationRecordsByApplicationIds([application.id])
  const existingById = new Map(existingRecords.map((record) => [record.id, record]))
  const now = new Date().toISOString()
  const nextEntries = mergeCommunicationEntries(entries)
  const nextRecords: ApplicationCommunicationRecord[] = nextEntries.map((entry) => {
    const existingRecord = existingById.get(entry.id)

    return {
      ...entry,
      applicationId: application.id,
      applicantId: application.applicantId,
      propertyId: application.propertyId,
      createdAt: existingRecord?.createdAt ?? now,
      updatedAt: now,
    }
  })
  const nextIds = new Set(nextRecords.map((record) => record.id))

  await Promise.all(nextRecords.map((record) => container.items.upsert(record)))
  await Promise.all(
    existingRecords
      .filter((record) => !nextIds.has(record.id))
      .map((record) =>
        container.item(record.id, record.applicationId).delete().catch((error: unknown) => {
          if (!isNotFoundError(error)) {
            throw error
          }
        }),
      ),
  )

  return nextEntries
}

async function getApplicationById(id: string) {
  const container = await getApplicationsContainer()
  const { resources } = await container.items
    .query<TenancyApplicationRecord>({
      query: "SELECT * FROM c WHERE c.id = @id",
      parameters: [{ name: "@id", value: id }],
    })
    .fetchAll()

  return hydrateApplicationWithCommunications(resources[0] ?? null)
}

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
  const application: TenancyApplicationRecord = {
    id: randomUUID(),
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

export async function uploadVerificationDocumentForApplication(
  user: AuthUser,
  applicationId: string,
  category: string,
  file: File,
  replaceDocumentId?: string,
) {
  assertReviewer(user)

  if (!isValidTenancyVerificationDocumentCategory(category)) {
    throw new Error("InvalidVerificationCategory")
  }

  const existingApplication = await getApplicationById(applicationId)

  if (!existingApplication) {
    return null
  }

  const role = getUserRole(user)

  if (role !== "admin") {
    const accessibleProperties = await listPropertiesForUser(user)
    const hasAccess = accessibleProperties.some((property) => property.id === existingApplication.propertyId)

    if (!hasAccess) {
      throw new Error("Forbidden")
    }
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer())
  const upload = await uploadTenancyVerificationDocument({
    applicationId: existingApplication.id,
    category,
    fileName: file.name,
    fileBuffer,
    mimeType: file.type || "application/octet-stream",
  })

  const now = new Date().toISOString()
  const document: TenancyVerificationDocument = {
    id: replaceDocumentId || randomUUID(),
    category,
    fileName: file.name,
    blobName: upload.blobName,
    url: upload.url,
    contentType: file.type || "application/octet-stream",
    size: upload.size,
    uploadedAt: now,
    uploadedByEmail: user.email,
  }

  const nextApplication: TenancyApplicationRecord = {
    ...existingApplication,
    updatedAt: now,
    referencingInstruction: {
      ...existingApplication.referencingInstruction,
      verificationDocuments: [
        ...(existingApplication.referencingInstruction.verificationDocuments ?? []).filter(
          (candidate) => candidate.id !== replaceDocumentId,
        ),
        document,
      ],
    },
  }

  const replacedDocument = replaceDocumentId
    ? (existingApplication.referencingInstruction.verificationDocuments ?? []).find(
        (candidate) => candidate.id === replaceDocumentId,
      )
    : undefined

  const container = await getApplicationsContainer()
  await syncStoredCommunicationEntries(nextApplication, nextApplication.postMoveInManagement.communicationEntries)
  await container.item(nextApplication.id, nextApplication.applicantId).replace(stripStoredCommunicationEntries(nextApplication))

  await writeAuditEvents([
    {
      entityType: "application",
      entityId: nextApplication.id,
      action: replaceDocumentId ? "verification_document_replaced" : "verification_document_uploaded",
      fieldPath: "referencingInstruction.verificationDocuments",
      oldValue: replacedDocument ?? null,
      newValue: document,
      performedBy: user.email,
      metadata: getAuditMetadata(nextApplication, user),
      timestamp: now,
    },
  ])

  if (replacedDocument?.blobName) {
    await deleteTenancyVerificationDocument(replacedDocument.blobName).catch(() => undefined)
  }

  return {
    application: nextApplication,
    document,
  }
}

async function canAccessApplicationForReviewer(user: AuthUser, application: TenancyApplicationRecord) {
  const role = getUserRole(user)

  if (role === "admin") {
    return true
  }

  const accessibleProperties = await listPropertiesForUser(user)
  return accessibleProperties.some((property) => property.id === application.propertyId)
}

export async function getVerificationDocumentForApplication(user: AuthUser, applicationId: string, documentId: string) {
  const application = await getApplicationById(applicationId)

  if (!application) {
    return null
  }

  const role = getUserRole(user)

  if (role === "applicant") {
    if (application.applicantId !== user.id) {
      throw new Error("Forbidden")
    }
  } else if (canReviewTenancyApplications(user)) {
    const canAccess = await canAccessApplicationForReviewer(user, application)

    if (!canAccess) {
      throw new Error("Forbidden")
    }
  } else {
    throw new Error("Forbidden")
  }

  const document = (application.referencingInstruction.verificationDocuments ?? []).find(
    (candidate) => candidate.id === documentId,
  )

  if (!document) {
    return {
      application,
      document: null,
    }
  }

  const download = await downloadTenancyVerificationDocument(document.blobName)

  return {
    application,
    document,
    download,
  }
}

export async function deleteVerificationDocumentForApplication(user: AuthUser, applicationId: string, documentId: string) {
  assertReviewer(user)

  const application = await getApplicationById(applicationId)

  if (!application) {
    return null
  }

  const canAccess = await canAccessApplicationForReviewer(user, application)

  if (!canAccess) {
    throw new Error("Forbidden")
  }

  const existingDocuments = application.referencingInstruction.verificationDocuments ?? []
  const removedDocument = existingDocuments.find((candidate) => candidate.id === documentId)

  if (!removedDocument) {
    return {
      application,
      deleted: false,
    }
  }

  const now = new Date().toISOString()
  const nextApplication: TenancyApplicationRecord = {
    ...application,
    updatedAt: now,
    referencingInstruction: {
      ...application.referencingInstruction,
      verificationDocuments: existingDocuments.filter((candidate) => candidate.id !== documentId),
    },
  }

  const container = await getApplicationsContainer()
  await syncStoredCommunicationEntries(nextApplication, nextApplication.postMoveInManagement.communicationEntries)
  await container.item(nextApplication.id, nextApplication.applicantId).replace(stripStoredCommunicationEntries(nextApplication))

  await writeAuditEvents([
    {
      entityType: "application",
      entityId: nextApplication.id,
      action: "verification_document_deleted",
      fieldPath: "referencingInstruction.verificationDocuments",
      oldValue: removedDocument,
      newValue: null,
      performedBy: user.email,
      metadata: getAuditMetadata(nextApplication, user),
      timestamp: now,
    },
  ])

  await deleteTenancyVerificationDocument(removedDocument.blobName).catch(() => undefined)

  return {
    application: nextApplication,
    deleted: true,
  }
}

function getRefereeRequestExpiry(requestedAtIso: string) {
  const requestedAt = new Date(requestedAtIso)
  requestedAt.setDate(requestedAt.getDate() + 7)
  return requestedAt.toISOString()
}

function hasActiveReferenceRequest(requests: TenancyReferenceRequest[], refereeId: string) {
  return requests.some(
    (request) =>
      request.refereeId === refereeId &&
      request.status !== "declined" &&
      request.status !== "failed" &&
      request.status !== "not_requested",
  )
}

function hasActiveEmailReferenceRequest(requests: TenancyReferenceRequest[], refereeId: string) {
  return requests.some(
    (request) =>
      request.refereeId === refereeId &&
      request.channel === "email" &&
      request.status !== "declined" &&
      request.status !== "failed" &&
      request.status !== "not_requested",
  )
}

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
    return { application: null, error: "ApplicationNotFound" as const }
  }

  const existingRequests = (existingApplication.referencingInstruction.referenceRequests ?? []).map((request) =>
    normalizeReferenceRequest(request),
  )

  const targetIndex = existingRequests.findIndex(
    (request) => request.id === input.requestId && request.refereeId === input.refereeId,
  )

  if (targetIndex === -1) {
    return { application: null, error: "RequestNotFound" as const }
  }

  const targetRequest = existingRequests[targetIndex]

  if (targetRequest.status === "completed" || targetRequest.status === "declined") {
    return {
      application: existingApplication,
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

  return {
    application: nextApplication,
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