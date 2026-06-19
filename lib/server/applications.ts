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
  type PreScreeningQuestionnaire,
  type PreScreeningSummary,
  type ReferencingInstruction,
  type ReferencingReport,
  type TenancyAgreementPreparation,
  type TenancyApplicationRecord,
  type TenancyApplicationStage,
  type TenancyApplicationStatus,
} from "@/lib/auth"
import { getApplicationsContainer } from "@/lib/server/cosmos"
import { DEFAULT_AFFORDABILITY_MULTIPLE, getPublicAvailableProperty } from "@/lib/server/properties"
import { setUserRoleForWorkflow } from "@/lib/server/users"

type CreateTenancyApplicationInput = PreScreeningQuestionnaire & {
  propertyId: string
}

type ApplicantUpdateInput = Partial<PreScreeningQuestionnaire> &
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

function canApplicantEditApplication(application: TenancyApplicationRecord) {
  return application.approvalDecision.outcome === "pending"
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

function buildPreScreeningSummary(
  questionnaire: CreateTenancyApplicationInput,
  monthlyRent: number,
  affordabilityMultiple: number,
): PreScreeningSummary {
  const affordabilityTarget = monthlyRent * 12 * affordabilityMultiple
  const affordabilityRatio = affordabilityTarget > 0 ? questionnaire.annualIncome / affordabilityTarget : 0
  const reasons: string[] = []

  if (questionnaire.annualIncome < affordabilityTarget) {
    reasons.push(
      `Income below the ${affordabilityMultiple.toFixed(1)}x affordability threshold (£${Math.round(affordabilityTarget).toLocaleString()} annually).`,
    )
  }

  if (questionnaire.hasAdverseCredit) {
    reasons.push("Applicant disclosed CCJs or other adverse credit that requires manual review.")
  }

  if (!questionnaire.moveInDate) {
    reasons.push("Move-in date is missing.")
  }

  return {
    outcome: reasons.length > 0 ? "fail" : "pass",
    affordabilityTarget,
    affordabilityRatio,
    reasons,
    assessedAt: new Date().toISOString(),
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

function createDefaultTenancyAgreement(rentAmount: number): TenancyAgreementPreparation {
  return {
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
  }
}

function sortApplications(applications: TenancyApplicationRecord[]) {
  return [...applications].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
}

function hydrateStoredApplication(application: TenancyApplicationRecord): TenancyApplicationRecord {
  const defaultTenancyAgreement = createDefaultTenancyAgreement(application.monthlyRent)

  return {
    ...application,
    affordabilityMultiple: toNonNegativeNumber(application.affordabilityMultiple) || DEFAULT_AFFORDABILITY_MULTIPLE,
    tenancyAgreement: {
      ...defaultTenancyAgreement,
      ...application.tenancyAgreement,
    },
    applicantChecklist: {
      ...createDefaultApplicantChecklist(),
      ...application.applicantChecklist,
      signedFullName:
        typeof application.applicantChecklist?.signedFullName === "string"
          ? application.applicantChecklist.signedFullName.trim()
          : "",
    },
    preScreening: normalizeQuestionnaire({
      propertyId: application.propertyId,
      employmentStatus: application.preScreening?.employmentStatus ?? "other",
      annualIncome: application.preScreening?.annualIncome ?? 0,
      moveInDate: application.preScreening?.moveInDate ?? "",
      preferredContactMethods: application.preScreening?.preferredContactMethods ?? [],
      hasPets: application.preScreening?.hasPets ?? false,
      petDetails: application.preScreening?.petDetails ?? "",
      smokes: application.preScreening?.smokes ?? false,
      occupantCount: application.preScreening?.occupantCount ?? 1,
      hasAdverseCredit: application.preScreening?.hasAdverseCredit ?? false,
      adverseCreditDetails: application.preScreening?.adverseCreditDetails ?? "",
      creditCheckConsentGiven: application.preScreening?.creditCheckConsentGiven ?? false,
      creditCheckConsentGivenAt: application.preScreening?.creditCheckConsentGivenAt ?? "",
      creditCheckConsentVersion: application.preScreening?.creditCheckConsentVersion ?? "tenant-credit-check-consent-v1",
    }),
  }
}

async function getApplicationById(id: string) {
  const container = await getApplicationsContainer()
  const { resources } = await container.items
    .query<TenancyApplicationRecord>({
      query: "SELECT * FROM c WHERE c.id = @id",
      parameters: [{ name: "@id", value: id }],
    })
    .fetchAll()

  return resources[0] ? hydrateStoredApplication(resources[0]) : null
}

export async function listApplicationsForApplicant(user: AuthUser) {
  assertApplicant(user)

  const container = await getApplicationsContainer()
  const { resources } = await container.items
    .query<TenancyApplicationRecord>({
      query: "SELECT * FROM c WHERE c.applicantId = @applicantId",
      parameters: [{ name: "@applicantId", value: user.id }],
    })
    .fetchAll()

  return sortApplications(resources.map(hydrateStoredApplication))
}

export async function getApplicationForApplicant(user: AuthUser, applicationId: string) {
  assertApplicant(user)

  const application = await getApplicationById(applicationId)

  if (!application || application.applicantId !== user.id) {
    return null
  }

  return application
}

export async function listApplicationsForReview(user: AuthUser) {
  assertReviewer(user)

  const container = await getApplicationsContainer()
  const { resources } = await container.items
    .query<TenancyApplicationRecord>({
      query: "SELECT * FROM c",
    })
    .fetchAll()

  return sortApplications(resources.map(hydrateStoredApplication))
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

  if (existingApplications.some((application) => application.status !== "declined")) {
    throw new Error("ApplicationAlreadyExists")
  }

  const preScreeningSummary = buildPreScreeningSummary(
    questionnaire,
    property.monthlyRent,
    property.affordabilityMultiple || DEFAULT_AFFORDABILITY_MULTIPLE,
  )
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
    currentStage: preScreeningSummary.outcome === "pass" ? "referencing_instruction" : "pre_screening",
    status: preScreeningSummary.outcome === "pass" ? "pre_screen_passed" : "pre_screen_failed",
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
    preScreening: questionnaire,
    preScreeningSummary,
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

  await container.items.create(application)
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
      },
    }

    const container = await getApplicationsContainer()
    await container.item(nextApplication.id, nextApplication.applicantId).replace(nextApplication)
    return nextApplication
  }

  if (!canApplicantEditApplication(existingApplication)) {
    throw new Error("ApplicantEditLocked")
  }

  const questionnaire = normalizeQuestionnaire({
    propertyId: existingApplication.propertyId,
    ...existingApplication.preScreening,
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

  const preScreeningSummary = buildPreScreeningSummary(
    questionnaire,
    existingApplication.monthlyRent,
    existingApplication.affordabilityMultiple || DEFAULT_AFFORDABILITY_MULTIPLE,
  )
  const nextApplication: TenancyApplicationRecord = {
    ...existingApplication,
    updatedAt: new Date().toISOString(),
    preScreening: questionnaire,
    preScreeningSummary,
  }

  if (preScreeningSummary.outcome === "fail") {
    nextApplication.currentStage = "pre_screening"
    nextApplication.status = "pre_screen_failed"
  } else if (existingApplication.currentStage === "pre_screening") {
    nextApplication.currentStage = "referencing_instruction"
    nextApplication.status = "pre_screen_passed"
  }

  const container = await getApplicationsContainer()
  await container.item(nextApplication.id, nextApplication.applicantId).replace(nextApplication)
  return nextApplication
}

export async function updateApplicationForReviewer(user: AuthUser, applicationId: string, input: ReviewerUpdateInput) {
  assertReviewer(user)

  const existingApplication = await getApplicationById(applicationId)

  if (!existingApplication) {
    return null
  }

  const nextApplication: TenancyApplicationRecord = {
    ...existingApplication,
    currentStage: input.currentStage ?? existingApplication.currentStage,
    status: input.status ?? existingApplication.status,
    updatedAt: new Date().toISOString(),
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
      ...existingApplication.postMoveInManagement,
      ...input.postMoveInManagement,
    },
  }

  if (nextApplication.tenancyAgreement.agreementSentForSignature && !existingApplication.tenancyAgreement.agreementSentForSignature) {
    nextApplication.tenancyAgreement.agreementSentAt = new Date().toISOString()
  }

  if (!nextApplication.tenancyAgreement.agreementSentForSignature) {
    nextApplication.tenancyAgreement.agreementSentAt = undefined
  }

  if (nextApplication.tenancyAgreement.agreementSigned && !existingApplication.tenancyAgreement.agreementSigned) {
    nextApplication.tenancyAgreement.agreementSignedAt = new Date().toISOString()
  }

  if (!nextApplication.tenancyAgreement.agreementSigned) {
    nextApplication.tenancyAgreement.agreementSignedAt = undefined
  }

  if (nextApplication.approvalDecision.outcome === "approved") {
    nextApplication.status = "approved"
    nextApplication.currentStage = input.currentStage ?? "agreement"
    nextApplication.approvalDecision.certificateIssuedAt = nextApplication.approvalDecision.certificateIssuedAt || new Date().toISOString()
  }

  if (nextApplication.approvalDecision.outcome === "approved_with_guarantor") {
    nextApplication.status = "approved_with_guarantor"
    nextApplication.currentStage = input.currentStage ?? "agreement"
    nextApplication.approvalDecision.certificateIssuedAt = nextApplication.approvalDecision.certificateIssuedAt || new Date().toISOString()
  }

  if (nextApplication.approvalDecision.outcome === "declined") {
    nextApplication.status = "declined"
    nextApplication.currentStage = input.currentStage ?? "decision"
    nextApplication.approvalDecision.certificateIssuedAt = nextApplication.approvalDecision.certificateIssuedAt || new Date().toISOString()
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
  await container.item(nextApplication.id, nextApplication.applicantId).replace(nextApplication)
  return nextApplication
}