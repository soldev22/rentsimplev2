import type { ApplicantProfileDefaults } from "./user"

export type TenancyApplicationStage =
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
  | "referencing_in_progress"
  | "referencing_complete"
  | "approved"
  | "approved_with_guarantor"
  | "declined"
  | "withdrawn"
  | "agreement_in_progress"
  | "pre_move_in_ready"
  | "move_in_ready"
  | "deposit_protected"
  | "active_tenant"

export type ReferencingOutcome = "pending" | "pass" | "fail" | "guarantor_required"

export type TenantDecisionOutcome = "pending" | "approved" | "approved_with_guarantor" | "declined"

export type ApplicationQuestionnaire = ApplicantProfileDefaults & {
  creditCheckConsentGiven: boolean
  creditCheckConsentGivenAt: string
  creditCheckConsentVersion: string
}

export type TenancyVerificationDocumentCategory =
  | "noIdRequired"
  | "photoIdReceived"
  | "proofOfAddressReceived"
  | "creditReferenceCheckReceived"
  | "previousLandlordReferenceReceived"
  | "incomeEvidenceReceived"

export type TenancyVerificationDocument = {
  id: string
  category: TenancyVerificationDocumentCategory
  fileName: string
  blobName: string
  url: string
  contentType: string
  size: number
  uploadedAt: string
  uploadedByEmail: string
}

export type TenancyVerificationNotRequiredFlags = Record<TenancyVerificationDocumentCategory, boolean>

export type RefereeRequestChannel = "email" | "phone" | "sms" | "postal" | "manual"

export type TenancyRefereeContact = {
  id: string
  fullName: string
  relationship: string
  relationshipToApplicantConfirmed: boolean
  idDocumentCheckComplete: boolean
  proofOfAddressCheckComplete: boolean
  email?: string
  phone?: string
  preferredChannel: RefereeRequestChannel
  postalAddress?: string
  notes?: string
}

export type TenancyReferenceRequestStatus =
  | "not_requested"
  | "pending_delivery"
  | "sent"
  | "pending_manual"
  | "received_manual"
  | "completed"
  | "declined"
  | "failed"

export type TenancyReferenceRequest = {
  id: string
  refereeId: string
  channel: RefereeRequestChannel
  status: TenancyReferenceRequestStatus
  requestedAt: string
  requestedByEmail: string
  sentAt?: string
  respondedAt?: string
  expiresAt?: string
  lastError?: string
}

export type ReferencingInstruction = {
  noIdRequired: boolean
  photoIdReceived: boolean
  proofOfAddressReceived: boolean
  creditReferenceCheckReceived: boolean
  previousLandlordReferenceReceived: boolean
  incomeEvidenceReceived: boolean
  verificationNotRequired: TenancyVerificationNotRequiredFlags
  verificationDocuments: TenancyVerificationDocument[]
  referees: TenancyRefereeContact[]
  referenceRequests: TenancyReferenceRequest[]
  employerContactDetails: string
  previousLandlordContactDetails: string
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
  creditReportRequest?: TenancyCreditReportRequest
}

export type TenancyCreditReportRequest = {
  requested: boolean
  requestedAt?: string
  requestedByEmail?: string
  status: "not_requested" | "requested"
}

export type ApprovalDecision = {
  outcome: TenantDecisionOutcome
  rationale: string
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
  legalFramework: "england_wales" | "scotland" | ""
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
  applicantProfile: ApplicationQuestionnaire
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