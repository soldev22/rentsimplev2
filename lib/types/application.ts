import type { ApplicantProfileDefaults } from "./user"

export type TenancyApplicationStage =
  | "pre_screening"
  | "referencing_instruction"
  | "full_referencing"
  | "decision"
  | "agreement"
  | "pre_move_in"
  | "move_in"
  | "deposit_protection"
  | "post_move_in"

export type TenancyApplicationStatus =
  | "submitted"
  | "pre_screen_failed"
  | "pre_screen_passed"
  | "referencing_in_progress"
  | "referencing_complete"
  | "approved"
  | "approved_with_guarantor"
  | "declined"
  | "agreement_in_progress"
  | "pre_move_in_ready"
  | "move_in_ready"
  | "deposit_protected"
  | "active_tenant"

export type PreScreeningOutcome = "pass" | "fail"

export type ReferencingOutcome = "pending" | "pass" | "fail" | "guarantor_required"

export type TenantDecisionOutcome = "pending" | "approved" | "approved_with_guarantor" | "declined"

export type PreScreeningQuestionnaire = ApplicantProfileDefaults & {
  creditCheckConsentGiven: boolean
  creditCheckConsentGivenAt: string
  creditCheckConsentVersion: string
}

export type PreScreeningSummary = {
  outcome: PreScreeningOutcome
  affordabilityTarget: number
  affordabilityRatio: number
  reasons: string[]
  assessedAt: string
}

export type ReferencingInstruction = {
  providerStatus: "pending" | "sent" | "documents_received"
  photoIdReceived: boolean
  proofOfAddressReceived: boolean
  incomeEvidenceReceived: boolean
  employerContactDetails: string
  previousLandlordContactDetails: string
  sharePointFileStatus: "pending" | "created"
  notes: string
}

export type FullReferencingChecks = {
  identityDocumentVerified: boolean
  addressVerified: boolean
  fraudMarkersClear: boolean
  creditFileReviewed: boolean
  creditIssuesClear: boolean
  linkedAddressesReviewed: boolean
  creditScore: string
  affordabilityVerified: boolean
  employmentReferenceVerified: boolean
  previousLandlordReferenceVerified: boolean
  guarantorRequired: boolean
  guarantorVerified: boolean
  guarantorAnnualIncome: number
  notes: string
}

export type ReferencingReport = {
  outcome: ReferencingOutcome
  completedAt?: string
  summary: string
  checks: FullReferencingChecks
}

export type ApprovalDecision = {
  outcome: TenantDecisionOutcome
  rationale: string
  affordabilityCalculation: string
  exceptionNotes: string
  certificateIssuedAt?: string
}

export type TenancyDocumentTracking = {
  reference: string
  url: string
  sent: boolean
  sentAt?: string
  signedCopyReceived: boolean
  signedCopyReceivedAt?: string
}

export type TenancyAgreementPreparation = {
  tenancyType: "AST" | "PRT" | ""
  rentAmount: number
  rentDueDate: string
  depositAmount: number
  termLengthMonths: number
  guarantorDeedRequired: boolean
  agreementProvider: string
  agreementReference: string
  agreementSigningUrl: string
  agreementSentForSignature: boolean
  agreementSentAt?: string
  agreementSigned: boolean
  agreementSignedAt?: string
  offerLetter: TenancyDocumentTracking
  leaseDocument: TenancyDocumentTracking
  supportingLegalDocuments: TenancyDocumentTracking & {
    summary: string
  }
}

export type ApplicantChecklistSignOff = {
  applicationInformationConfirmed: boolean
  moveInFundsConfirmed: boolean
  agreementTermsAccepted: boolean
  documentsReadyConfirmed: boolean
  signedFullName: string
  signedAt?: string
}

export type PreMoveInCompliance = {
  epcIssued: boolean
  gasSafetyIssued: boolean
  eicrIssued: boolean
  howToRentIssued: boolean
  depositLeafletIssued: boolean
  checkInScheduled: boolean
  inventoryPrepared: boolean
}

export type MoveInChecklist = {
  inspectionCompleted: boolean
  inventoryCompletedWithPhotos: boolean
  meterReadingsRecorded: boolean
  smokeAlarmsTested: boolean
  keysIssued: boolean
  keyNumbers: string
  tenantContactConfirmed: boolean
}

export type DepositProtection = {
  protectedWithinThirtyDays: boolean
  prescribedInformationIssued: boolean
  certificateUploaded: boolean
  certificateReference: string
}

export type TenantCommunicationChannel = "email" | "phone" | "sms" | "whatsapp" | "portal" | "letter" | "in_person" | "other"

export type TenantCommunicationDirection = "outbound" | "inbound"

export type TenantCommunicationNotificationChannel = "email" | "sms"

export type TenantCommunicationNotificationStatus = "not_applicable" | "pending" | "sent" | "skipped" | "failed"

export type TenantCommunicationNotification = {
  channel?: TenantCommunicationNotificationChannel
  target?: string
  status: TenantCommunicationNotificationStatus
  attemptedAt?: string
  sentAt?: string
  fromAddress?: string
  replyTo?: string
  copiedTo?: string[]
  detail: string
}

export type TenantCommunicationEntry = {
  id: string
  occurredAt: string
  channel: TenantCommunicationChannel
  direction: TenantCommunicationDirection
  subject: string
  summary: string
  recordedByName: string
  notification?: TenantCommunicationNotification
}

export type PostMoveInManagement = {
  firstInspectionDate: string
  maintenanceLogNotes: string
  communicationLogNotes: string
  communicationEntries: TenantCommunicationEntry[]
}

export type TenancyApplicationRecord = {
  id: string
  propertyId: string
  propertyAddress: string
  propertyCity: string
  monthlyRent: number
  affordabilityMultiple: number
  applicantId: string
  applicantEmail: string
  applicantName: string
  currentStage: TenancyApplicationStage
  status: TenancyApplicationStatus
  submittedAt: string
  createdAt: string
  updatedAt: string
  preScreening: PreScreeningQuestionnaire
  preScreeningSummary: PreScreeningSummary
  referencingInstruction: ReferencingInstruction
  referencingReport: ReferencingReport
  approvalDecision: ApprovalDecision
  tenancyAgreement: TenancyAgreementPreparation
  applicantChecklist: ApplicantChecklistSignOff
  preMoveInCompliance: PreMoveInCompliance
  moveInChecklist: MoveInChecklist
  depositProtection: DepositProtection
  postMoveInManagement: PostMoveInManagement
}