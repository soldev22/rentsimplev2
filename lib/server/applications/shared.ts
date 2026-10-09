import "server-only"

import { randomUUID } from "node:crypto"

import {
  canReviewTenancyApplications,
  type DepositDocumentCategory,
  type DepositDocumentRecord,
  type DepositHistoryAction,
  type DepositHistoryEntry,
  type DepositRecord,
  getUserRole,
  type ApprovalDecision,
  type ApplicantChecklistSignOff,
  type AuthUser,
  type DepositProtection,
  type DepositStatus,
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
import { DEFAULT_AFFORDABILITY_MULTIPLE, listPropertiesForUser } from "@/lib/server/properties"

export const LEGACY_COMMUNICATION_ENTRY_ID = "legacy-communication-notes"

export type ApplicationCommunicationRecord = TenantCommunicationEntry & {
  applicationId: string
  applicantId: string
  propertyId: string
  createdAt: string
  updatedAt: string
}

export type CreateTenancyApplicationInput = ApplicationQuestionnaire & {
  propertyId: string
}

export type ApplicantUpdateInput = Partial<ApplicationQuestionnaire> &
  Partial<{
    applicantChecklist: Partial<ApplicantChecklistSignOff>
    agreementSigned: boolean
  }>

export type ReviewerUpdateInput = Partial<{
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
  depositRecord: Partial<DepositRecord>
  postMoveInManagement: Partial<PostMoveInManagement>
}>

export const APPLICATION_AUDIT_FIELDS = [
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
  { path: "depositRecord", action: "deposit_record_updated" },
  { path: "postMoveInManagement.firstInspectionDate", action: "first_inspection_updated" },
  { path: "postMoveInManagement.maintenanceLogNotes", action: "maintenance_log_updated" },
  { path: "postMoveInManagement.communicationLogNotes", action: "communication_notes_updated" },
] as const

export const TENANCY_VERIFICATION_DOCUMENT_CATEGORIES: TenancyVerificationDocumentCategory[] = [
  "noIdRequired",
  "photoIdReceived",
  "proofOfAddressReceived",
  "creditReferenceCheckReceived",
  "previousLandlordReferenceReceived",
  "incomeEvidenceReceived",
]

export const DEPOSIT_DOCUMENT_CATEGORIES: DepositDocumentCategory[] = [
  "request_notice",
  "payment_receipt",
  "protection_certificate",
  "other",
]

export const GUARANTOR_REFERENCE_TOKEN_DURATION_MS = 1000 * 60 * 60 * 24 * 7

export const SITE_VISIT_CONFIRMATION_TOKEN_DURATION_MS = 1000 * 60 * 60 * 24 * 7

export function assertApplicant(user: AuthUser) {
  if (getUserRole(user) !== "applicant") {
    throw new Error("Forbidden")
  }
}

export function assertTenant(user: AuthUser) {
  if (getUserRole(user) !== "tenant") {
    throw new Error("Forbidden")
  }
}

export function assertReviewer(user: AuthUser) {
  if (!canReviewTenancyApplications(user)) {
    throw new Error("Forbidden")
  }
}

export function hasFinalDecision(application: TenancyApplicationRecord) {
  return (
    application.approvalDecision.outcome === "approved" ||
    application.approvalDecision.outcome === "approved_with_guarantor" ||
    application.approvalDecision.outcome === "declined"
  )
}

export function canApplicantEditApplication(application: TenancyApplicationRecord) {
  return (
    application.status !== "withdrawn" &&
    application.status !== "active_tenant" &&
    application.status !== "declined" &&
    !hasFinalDecision(application)
  )
}

export function canApplicantWithdrawApplication(application: TenancyApplicationRecord) {
  return (
    application.status !== "withdrawn" &&
    application.status !== "active_tenant" &&
    !hasFinalDecision(application)
  )
}

export function canApplicantCompleteChecklist(application: TenancyApplicationRecord) {
  return application.approvalDecision.outcome === "approved" || application.approvalDecision.outcome === "approved_with_guarantor"
}

export function hasApplicantChecklistUpdate(input: ApplicantUpdateInput) {
  return typeof input.agreementSigned === "boolean" || typeof input.applicantChecklist === "object"
}

export function toNonNegativeNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

export function normalizeQuestionnaire(input: CreateTenancyApplicationInput): CreateTenancyApplicationInput {
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

export function createDefaultReferencingInstruction(): ReferencingInstruction {
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

export function normalizeRefereeChannel(value: unknown): RefereeRequestChannel {
  return value === "email" || value === "phone" || value === "sms" || value === "postal" || value === "manual"
    ? value
    : "email"
}

export function normalizeRefereeContact(referee: Partial<TenancyRefereeContact>): TenancyRefereeContact {
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

export function normalizeReferenceRequestStatus(value: unknown): TenancyReferenceRequestStatus {
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

export function normalizeReferenceRequest(request: Partial<TenancyReferenceRequest>): TenancyReferenceRequest {
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

export function isValidTenancyVerificationDocumentCategory(
  value: string,
): value is TenancyVerificationDocumentCategory {
  return TENANCY_VERIFICATION_DOCUMENT_CATEGORIES.includes(value as TenancyVerificationDocumentCategory)
}

export function normalizeDepositStatus(value: unknown): DepositStatus {
  return value === "requested" ||
    value === "awaiting_payment" ||
    value === "payment_received" ||
    value === "protection_pending" ||
    value === "protected" ||
    value === "returned" ||
    value === "disputed"
    ? value
    : "requested"
}

export function normalizeDepositDocumentCategory(value: unknown): DepositDocumentCategory {
  return DEPOSIT_DOCUMENT_CATEGORIES.includes(value as DepositDocumentCategory) ? (value as DepositDocumentCategory) : "other"
}

export function normalizeDepositHistoryAction(value: unknown): DepositHistoryAction {
  return value === "deposit_requested" ||
    value === "deposit_acknowledged" ||
    value === "deposit_payment_confirmed_by_tenant" ||
    value === "deposit_payment_received" ||
    value === "deposit_protection_recorded" ||
    value === "deposit_returned" ||
    value === "deposit_disputed" ||
    value === "deposit_document_uploaded" ||
    value === "deposit_document_deleted" ||
    value === "deposit_reminder_sent"
    ? value
    : "deposit_requested"
}

export function normalizeDepositDocument(document: Partial<DepositDocumentRecord>): DepositDocumentRecord {
  return {
    id: typeof document.id === "string" && document.id.trim() ? document.id : randomUUID(),
    category: normalizeDepositDocumentCategory(document.category),
    fileName: typeof document.fileName === "string" ? document.fileName.trim() : "document",
    blobName: typeof document.blobName === "string" ? document.blobName.trim() : "",
    url: typeof document.url === "string" ? document.url.trim() : "",
    contentType: typeof document.contentType === "string" ? document.contentType.trim() : "application/octet-stream",
    size: toNonNegativeNumber(document.size),
    uploadedAt: typeof document.uploadedAt === "string" ? document.uploadedAt : new Date().toISOString(),
    uploadedByEmail: typeof document.uploadedByEmail === "string" ? document.uploadedByEmail.trim() : "",
  }
}

export function normalizeDepositHistoryEntry(entry: Partial<DepositHistoryEntry>): DepositHistoryEntry {
  return {
    id: typeof entry.id === "string" && entry.id.trim() ? entry.id : randomUUID(),
    action: normalizeDepositHistoryAction(entry.action),
    status: normalizeDepositStatus(entry.status),
    performedBy: typeof entry.performedBy === "string" ? entry.performedBy.trim() : "system",
    timestamp: typeof entry.timestamp === "string" ? entry.timestamp : new Date().toISOString(),
    notes: typeof entry.notes === "string" ? entry.notes.trim() : "",
  }
}

export function createDefaultReferencingReport(): ReferencingReport {
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

export function createCreditReportRequest(requestedAt: string, requestedByEmail: string): TenancyCreditReportRequest {
  return {
    requested: true,
    requestedAt,
    requestedByEmail,
    status: "requested",
  }
}

export function createDefaultApprovalDecision(): ApprovalDecision {
  return {
    outcome: "pending",
    rationale: "",
  }
}

export function createDefaultTenancyDocumentTracking(): TenancyDocumentTracking {
  return {
    reference: "",
    url: "",
    sent: false,
    sentAt: undefined,
    signedCopyReceived: false,
    signedCopyReceivedAt: undefined,
  }
}

export function createDefaultTenancyAgreement(rentAmount: number): TenancyAgreementPreparation {
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

export function createDefaultApplicantChecklist(): ApplicantChecklistSignOff {
  return {
    applicationInformationConfirmed: false,
    moveInFundsConfirmed: false,
    agreementTermsAccepted: false,
    documentsReadyConfirmed: false,
    signedFullName: "",
    signedAt: undefined,
  }
}

export function createDefaultPreMoveInCompliance(): PreMoveInCompliance {
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
      alternativeSuggestedAt: undefined,
      assigneeName: "",
      notes: "",
      inviteStatus: "not_sent",
      inviteRequestId: undefined,
      inviteRequestedAt: undefined,
      inviteSentAt: undefined,
      inviteRespondedAt: undefined,
      inviteLastError: undefined,
    },
  }
}

export function createDefaultMoveInChecklist(): MoveInChecklist {
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

export function createDefaultDepositProtection(): DepositProtection {
  return {
    protectedWithinThirtyDays: false,
    prescribedInformationIssued: false,
    certificateUploaded: false,
    certificateReference: "",
  }
}

export function createDefaultDepositRecord(input: {
  applicationId: string
  propertyId: string
  landlordId: string
  tenantId: string
  amount: number
  requestedByEmail?: string
}): DepositRecord {
  return {
    id: randomUUID(),
    tenancyId: input.applicationId,
    propertyId: input.propertyId,
    landlordId: input.landlordId,
    tenantId: input.tenantId,
    amount: toNonNegativeNumber(input.amount),
    currency: "GBP",
    status: "requested",
    requestedDate: undefined,
    paymentDueDate: "",
    paymentDate: undefined,
    protectedDate: undefined,
    returnedDate: undefined,
    requestedByEmail: input.requestedByEmail?.trim() ?? "",
    paymentInstructions: "",
    notes: "",
    acknowledgedAt: undefined,
    acknowledgedByUserId: undefined,
    acknowledgementIp: undefined,
    acknowledgementUserAgent: undefined,
    paymentConfirmedByTenantAt: undefined,
    paymentConfirmedByReviewerAt: undefined,
    protectionProviderName: "",
    protectionReference: "",
    protectedAmount: toNonNegativeNumber(input.amount),
    documents: [],
    history: [],
  }
}

export function deriveLegacyDepositProtection(record: DepositRecord): DepositProtection {
  const certificateDocumentUploaded = record.documents.some((document) => document.category === "protection_certificate")

  return {
    protectedWithinThirtyDays: record.status === "protected" || record.status === "returned" || record.status === "disputed",
    prescribedInformationIssued: record.status === "protected" || record.status === "returned" || record.status === "disputed",
    certificateUploaded: certificateDocumentUploaded,
    certificateReference: record.protectionReference,
  }
}

export function normalizeDepositRecord(application: TenancyApplicationRecord): DepositRecord {
  const existingRecord = application.depositRecord
  const defaultRecord = createDefaultDepositRecord({
    applicationId: application.id,
    propertyId: application.propertyId,
    landlordId: existingRecord?.landlordId ?? "",
    tenantId: application.applicantId,
    amount: application.tenancyAgreement?.depositAmount ?? 0,
    requestedByEmail: existingRecord?.requestedByEmail,
  })

  return {
    ...defaultRecord,
    ...existingRecord,
    tenancyId: application.id,
    propertyId: application.propertyId,
    tenantId: application.applicantId,
    amount: toNonNegativeNumber(existingRecord?.amount ?? application.tenancyAgreement?.depositAmount ?? defaultRecord.amount),
    protectedAmount: toNonNegativeNumber(existingRecord?.protectedAmount ?? existingRecord?.amount ?? application.tenancyAgreement?.depositAmount ?? defaultRecord.amount),
    currency: typeof existingRecord?.currency === "string" && existingRecord.currency.trim() ? existingRecord.currency.trim() : "GBP",
    status: normalizeDepositStatus(existingRecord?.status),
    paymentDueDate: typeof existingRecord?.paymentDueDate === "string" ? existingRecord.paymentDueDate.trim() : "",
    requestedByEmail: typeof existingRecord?.requestedByEmail === "string" ? existingRecord.requestedByEmail.trim() : "",
    paymentInstructions: typeof existingRecord?.paymentInstructions === "string" ? existingRecord.paymentInstructions.trim() : "",
    notes: typeof existingRecord?.notes === "string" ? existingRecord.notes.trim() : "",
    protectionProviderName:
      typeof existingRecord?.protectionProviderName === "string" ? existingRecord.protectionProviderName.trim() : "",
    protectionReference: typeof existingRecord?.protectionReference === "string" ? existingRecord.protectionReference.trim() : "",
    documents: Array.isArray(existingRecord?.documents) ? existingRecord.documents.map((document) => normalizeDepositDocument(document)) : [],
    history: Array.isArray(existingRecord?.history) ? existingRecord.history.map((entry) => normalizeDepositHistoryEntry(entry)) : [],
  }
}

export function createDefaultPostMoveInManagement(): PostMoveInManagement {
  return {
    firstInspectionDate: "",
    maintenanceLogNotes: "",
    communicationLogNotes: "",
    communicationEntries: [],
  }
}

export function createLegacyCommunicationEntry(summary: string): TenantCommunicationEntry {
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

export function normalizeCommunicationEntry(entry: Partial<TenantCommunicationEntry> | undefined): TenantCommunicationEntry | null {
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

export function normalizeCommunicationNotification(
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

export function normalizeCommunicationEntries(entries: Partial<TenantCommunicationEntry>[] | undefined) {
  if (!Array.isArray(entries)) {
    return [] as TenantCommunicationEntry[]
  }

  return entries
    .map((entry) => normalizeCommunicationEntry(entry))
    .filter((entry): entry is TenantCommunicationEntry => Boolean(entry))
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
}

export function mergeCommunicationEntries(...groups: Array<Partial<TenantCommunicationEntry>[] | undefined>) {
  const merged = new Map<string, TenantCommunicationEntry>()

  groups.forEach((group) => {
    normalizeCommunicationEntries(group).forEach((entry) => {
      merged.set(entry.id, entry)
    })
  })

  return normalizeCommunicationEntries([...merged.values()])
}

export function hydratePostMoveInManagement(
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

export function sortApplications(applications: TenancyApplicationRecord[]) {
  return [...applications].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
}

export function getAuditMetadata(application: TenancyApplicationRecord, user: AuthUser) {
  return {
    applicantId: application.applicantId,
    propertyId: application.propertyId,
    performedByRole: getUserRole(user),
  }
}

export function getValueAtPath(record: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((value, segment) => {
    if (!value || typeof value !== "object") {
      return undefined
    }

    return (value as Record<string, unknown>)[segment]
  }, record)
}

export function areAuditValuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

export function buildApplicationAuditEvents(
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

export function buildCommunicationAuditEvents(
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

export function mergeTenancyDocumentTracking(
  existingDocument: TenancyDocumentTracking,
  inputDocument: Partial<TenancyDocumentTracking> | undefined,
) {
  return {
    ...existingDocument,
    ...(inputDocument ?? {}),
  }
}

export function syncDocumentAuditTrail(
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

export function hydrateStoredApplication(application: TenancyApplicationRecord): TenancyApplicationRecord {
  const defaultTenancyAgreement = createDefaultTenancyAgreement(application.monthlyRent)
  const defaultReferencingInstruction = createDefaultReferencingInstruction()
  const defaultReferencingReport = createDefaultReferencingReport()
  const defaultCreditReportRequest = defaultReferencingReport.creditReportRequest ?? {
    requested: false,
    status: "not_requested" as const,
  }
  const defaultApprovalDecision = createDefaultApprovalDecision()
  const defaultPreMoveInCompliance = createDefaultPreMoveInCompliance()
  const normalizedDepositRecord = normalizeDepositRecord(application)

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
        alternativeSuggestedAt:
          typeof application.preMoveInCompliance?.siteVisit?.alternativeSuggestedAt === "string"
            ? application.preMoveInCompliance.siteVisit.alternativeSuggestedAt
            : undefined,
        inviteStatus:
          application.preMoveInCompliance?.siteVisit?.inviteStatus === "sent" ||
          application.preMoveInCompliance?.siteVisit?.inviteStatus === "confirmed" ||
          application.preMoveInCompliance?.siteVisit?.inviteStatus === "declined" ||
          application.preMoveInCompliance?.siteVisit?.inviteStatus === "expired" ||
          application.preMoveInCompliance?.siteVisit?.inviteStatus === "failed"
            ? application.preMoveInCompliance.siteVisit.inviteStatus
            : "not_sent",
        inviteRequestId:
          typeof application.preMoveInCompliance?.siteVisit?.inviteRequestId === "string"
            ? application.preMoveInCompliance.siteVisit.inviteRequestId
            : undefined,
        inviteRequestedAt:
          typeof application.preMoveInCompliance?.siteVisit?.inviteRequestedAt === "string"
            ? application.preMoveInCompliance.siteVisit.inviteRequestedAt
            : undefined,
        inviteSentAt:
          typeof application.preMoveInCompliance?.siteVisit?.inviteSentAt === "string"
            ? application.preMoveInCompliance.siteVisit.inviteSentAt
            : undefined,
        inviteRespondedAt:
          typeof application.preMoveInCompliance?.siteVisit?.inviteRespondedAt === "string"
            ? application.preMoveInCompliance.siteVisit.inviteRespondedAt
            : undefined,
        inviteLastError:
          typeof application.preMoveInCompliance?.siteVisit?.inviteLastError === "string"
            ? application.preMoveInCompliance.siteVisit.inviteLastError
            : undefined,
      },
    },
    depositRecord: normalizedDepositRecord,
    depositProtection: {
      ...createDefaultDepositProtection(),
      ...application.depositProtection,
      ...deriveLegacyDepositProtection(normalizedDepositRecord),
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

export async function listStoredCommunicationRecordsByApplicationIds(applicationIds: string[]) {
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

export async function listStoredCommunicationEntriesByApplicationId(applicationIds: string[]) {
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

export async function hydrateApplicationsWithCommunications(applications: TenancyApplicationRecord[]) {
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

export async function hydrateApplicationWithCommunications(application: TenancyApplicationRecord | null) {
  if (!application) {
    return null
  }

  const [hydratedApplication] = await hydrateApplicationsWithCommunications([application])
  return hydratedApplication ?? null
}

export function stripStoredCommunicationEntries(application: TenancyApplicationRecord): TenancyApplicationRecord {
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

export function isNotFoundError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 404
}

export async function syncStoredCommunicationEntries(application: TenancyApplicationRecord, entries: TenantCommunicationEntry[]) {
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

export async function persistApplicationWithAudit(
  existingApplication: TenancyApplicationRecord,
  nextApplication: TenancyApplicationRecord,
  user: AuthUser,
  extraAuditEvents: Array<Parameters<typeof writeAuditEvents>[0][number]> = [],
) {
  const container = await getApplicationsContainer()
  nextApplication.postMoveInManagement.communicationEntries = await syncStoredCommunicationEntries(
    nextApplication,
    nextApplication.postMoveInManagement.communicationEntries,
  )
  await container.item(nextApplication.id, nextApplication.applicantId).replace(stripStoredCommunicationEntries(nextApplication))

  const auditEvents = [
    ...buildApplicationAuditEvents(existingApplication, nextApplication, user),
    ...buildCommunicationAuditEvents(
      existingApplication.postMoveInManagement.communicationEntries,
      nextApplication.postMoveInManagement.communicationEntries,
      nextApplication,
      user,
    ),
    ...extraAuditEvents,
  ]

  if (auditEvents.length > 0) {
    await writeAuditEvents(auditEvents)
  }

  return nextApplication
}

export function appendDepositHistory(
  record: DepositRecord,
  input: {
    action: DepositHistoryAction
    status: DepositStatus
    performedBy: string
    timestamp: string
    notes?: string
  },
) {
  const entry: DepositHistoryEntry = {
    id: randomUUID(),
    action: input.action,
    status: input.status,
    performedBy: input.performedBy,
    timestamp: input.timestamp,
    notes: input.notes?.trim() ?? "",
  }

  return {
    ...record,
    status: input.status,
    history: [entry, ...(record.history ?? [])],
  }
}

export function createDepositCommunicationEntry(input: {
  occurredAt: string
  subject: string
  summary: string
  recordedByName: string
  target?: string
  deliveryStatus: TenantCommunicationNotification["status"]
  deliveryDetail: string
  deliveryAttemptedAt?: string
  deliverySentAt?: string
}) {
  return {
    id: randomUUID(),
    occurredAt: input.occurredAt,
    channel: "portal",
    direction: "outbound",
    subject: input.subject,
    summary: input.summary,
    recordedByName: input.recordedByName,
    notification: {
      channel: input.target ? "email" : undefined,
      target: input.target,
      status: input.deliveryStatus,
      attemptedAt: input.deliveryAttemptedAt ?? input.occurredAt,
      sentAt: input.deliverySentAt,
      detail: input.deliveryDetail,
    },
  } satisfies TenantCommunicationEntry
}

export function mergeDepositRecord(application: TenancyApplicationRecord, record: DepositRecord): TenancyApplicationRecord {
  return {
    ...application,
    depositRecord: record,
    depositProtection: deriveLegacyDepositProtection(record),
  }
}

export function canAccessApplicationForApplicantOrTenant(user: AuthUser, application: TenancyApplicationRecord) {
  const role = getUserRole(user)

  if (role === "applicant") {
    return application.applicantId === user.id
  }

  if (role === "tenant") {
    return application.status === "active_tenant" && (application.applicantId === user.id || application.applicantEmail === user.email)
  }

  return false
}

export async function getApplicationById(id: string) {
  const container = await getApplicationsContainer()
  const { resources } = await container.items
    .query<TenancyApplicationRecord>({
      query: "SELECT * FROM c WHERE c.id = @id",
      parameters: [{ name: "@id", value: id }],
    })
    .fetchAll()

  return hydrateApplicationWithCommunications(resources[0] ?? null)
}

export async function canAccessApplicationForReviewer(user: AuthUser, application: TenancyApplicationRecord) {
  const role = getUserRole(user)

  if (role === "admin") {
    return true
  }

  const accessibleProperties = await listPropertiesForUser(user)
  return accessibleProperties.some((property) => property.id === application.propertyId)
}

export function getRefereeRequestExpiry(requestedAtIso: string) {
  const requestedAt = new Date(requestedAtIso)
  requestedAt.setDate(requestedAt.getDate() + 7)
  return requestedAt.toISOString()
}

export function getSiteVisitInviteExpiry(requestedAtIso: string) {
  const requestedAt = new Date(requestedAtIso)
  requestedAt.setDate(requestedAt.getDate() + 7)
  return requestedAt.toISOString()
}

export function hasActiveReferenceRequest(requests: TenancyReferenceRequest[], refereeId: string) {
  return requests.some(
    (request) =>
      request.refereeId === refereeId &&
      request.status !== "declined" &&
      request.status !== "failed" &&
      request.status !== "not_requested",
  )
}

export function hasActiveEmailReferenceRequest(requests: TenancyReferenceRequest[], refereeId: string) {
  return requests.some(
    (request) =>
      request.refereeId === refereeId &&
      request.channel === "email" &&
      request.status !== "declined" &&
      request.status !== "failed" &&
      request.status !== "not_requested",
  )
}
