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
import { deliverTenantCommunicationNotification } from "@/lib/server/notifications"
import { DEFAULT_AFFORDABILITY_MULTIPLE, getPublicAvailableProperty, listPropertiesForUser } from "@/lib/server/properties"
import { setUserRoleForWorkflow } from "@/lib/server/users"

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
    providerStatus: "pending",
    photoIdReceived: false,
    proofOfAddressReceived: false,
    incomeEvidenceReceived: false,
    employerContactDetails: "",
    previousLandlordContactDetails: "",
    sharePointFileStatus: "pending",
    notes: "",
  }
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
  }
}

function createDefaultApprovalDecision(): ApprovalDecision {
  return {
    outcome: "pending",
    rationale: "",
    affordabilityCalculation: "",
    exceptionNotes: "",
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

  return {
    ...application,
    affordabilityMultiple: toNonNegativeNumber(application.affordabilityMultiple) || DEFAULT_AFFORDABILITY_MULTIPLE,
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