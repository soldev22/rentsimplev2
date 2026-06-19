export type UserRole = "unallocated" | "admin" | "agent" | "landlord" | "tenant" | "applicant" | "builder"
export type ApprovalStatus = "pending_approval" | "approved"
export type PropertyImageModerationStatus = "pending_review" | "approved"

export type PropertyImageModerationScores = {
  hate: number
  selfHarm: number
  sexual: number
  violence: number
}

export type EmploymentStatus =
  | "employed_full_time"
  | "employed_part_time"
  | "self_employed"
  | "contractor"
  | "student"
  | "retired"
  | "unemployed"
  | "other"

export type PreferredContactMethod = "email" | "phone" | "sms" | "whatsapp"
export type BuilderTrade = "general_builder" | "plumber" | "electrician" | "heating_engineer" | "roofer" | "multi_trade" | "other"

export type ApplicantProfileDefaults = {
  employmentStatus: EmploymentStatus
  annualIncome: number
  moveInDate: string
  preferredContactMethods: PreferredContactMethod[]
  hasPets: boolean
  petDetails: string
  smokes: boolean
  occupantCount: number
  hasAdverseCredit: boolean
  adverseCreditDetails: string
}

export type BuilderProfileDefaults = {
  companyName: string
  primaryTrade: BuilderTrade
  serviceAreas: string
  preferredContactMethods: PreferredContactMethod[]
  emergencyCalloutAvailable: boolean
  hourlyRateGuidance: number
  availabilityNotes: string
  insuranceExpiryDate: string
  gasSafeRegistered: boolean
  gasSafeNumber: string
  electricalCertified: boolean
  electricalCertificationScheme: string
  dbsChecked: boolean
  dbsExpiryDate: string
  accreditationNotes: string
}

export type NotificationProfileDefaults = {
  outboundEmail: string
  copyLandlordOnTenantEmails: boolean
}

export type AuthUser = {
  id: string
  email: string
  first_name: string
  last_name: string
  mobile: string
  applicantProfile?: ApplicantProfileDefaults
  builderProfile?: BuilderProfileDefaults
  notificationProfile?: NotificationProfileDefaults
  managedByAgentId?: string
  role: UserRole
  approval_status: ApprovalStatus
  createdAt: string
  updatedAt: string
}

export type PropertyImageRecord = {
  id: string
  blobName: string
  thumbnailBlobName?: string
  originalFileName?: string
  url: string
  contentType: string
  thumbnailContentType?: string
  moderationStatus: PropertyImageModerationStatus
  moderationReason?: string
  moderationScores?: PropertyImageModerationScores
  moderationReviewedAt?: string
  uploadedByUserId?: string
  size: number
  uploadedAt: string
}

export type PendingPropertyImageReview = {
  propertyId: string
  propertyAddress: string
  ownerId: string
  image: PropertyImageRecord
}

export type PropertyRecord = {
  id: string
  ownerId: string
  address: string
  addressLine1: string
  addressLine2: string
  city: string
  postcode: string
  type: string
  status: string
  shortDescription: string
  longDescription: string
  description: string
  bedrooms: number
  bathrooms: number
  monthlyRent: number
  affordabilityMultiple: number
  images: PropertyImageRecord[]
  createdAt: string
  updatedAt: string
}

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

export type MaintenancePriority = "low" | "medium" | "high" | "urgent"
export type MaintenanceIssueStatus =
  | "reported"
  | "triaged"
  | "bidding_open"
  | "builder_selected"
  | "accreditation_pending"
  | "ready_to_start"
  | "in_progress"
  | "awaiting_signoff"
  | "completed"
  | "closed"

export type MaintenanceIssueCategory =
  | "plumbing"
  | "electrical"
  | "heating"
  | "security"
  | "appliances"
  | "damp_mould"
  | "general"

export type BuilderBidStatus = "submitted" | "shortlisted" | "accepted" | "declined"

export type MaintenanceBuilderBid = {
  id: string
  builderId: string
  builderEmail: string
  builderName: string
  amount: number
  availabilityDate: string
  estimatedDurationDays: number
  notes: string
  status: BuilderBidStatus
  createdAt: string
  updatedAt: string
}

export type MaintenanceAccreditationChecklist = {
  insuranceChecked: boolean
  insuranceCheckedAt?: string
  gasSafeChecked: boolean
  gasSafeCheckedAt?: string
  electricalCertificationChecked: boolean
  electricalCertificationCheckedAt?: string
  dbsChecked: boolean
  dbsCheckedAt?: string
  methodStatementReceived: boolean
  methodStatementReceivedAt?: string
  targetStartDate: string
  targetCompletionDate: string
  checkedByName: string
  checkedAt?: string
  notes: string
}

export type MaintenanceIssueRecord = {
  id: string
  propertyId: string
  propertyAddress: string
  tenantId: string
  tenantEmail: string
  tenantName: string
  title: string
  description: string
  category: MaintenanceIssueCategory
  priority: MaintenancePriority
  status: MaintenanceIssueStatus
  reportedAt: string
  responseDueAt?: string
  resolutionDueAt?: string
  biddingClosesAt?: string
  selectedBuilderId?: string
  selectedBuilderName?: string
  selectedBuilderEmail?: string
  accreditationChecklist: MaintenanceAccreditationChecklist
  bids: MaintenanceBuilderBid[]
  createdAt: string
  updatedAt: string
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

export const MAX_PROPERTY_IMAGES = 30

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function getUserRole(user: Pick<AuthUser, "role"> | null | undefined) {
  return user?.role ?? "unallocated"
}

export function canManageProperties(user: Pick<AuthUser, "role"> | null | undefined) {
  const role = getUserRole(user)
  return role === "admin" || role === "agent" || role === "landlord"
}

export function canReviewTenancyApplications(user: Pick<AuthUser, "role"> | null | undefined) {
  const role = getUserRole(user)
  return role === "admin" || role === "agent" || role === "landlord"
}

export function canAccessMaintenance(user: Pick<AuthUser, "role"> | null | undefined) {
  const role = getUserRole(user)
  return role === "admin" || role === "agent" || role === "landlord" || role === "tenant" || role === "builder"
}

export function isPendingApproval(user: Pick<AuthUser, "role" | "approval_status"> | null | undefined) {
  return getUserRole(user) === "unallocated"
}

export function getDefaultDashboardPath(user: Pick<AuthUser, "role" | "approval_status"> | null | undefined) {
  if (isPendingApproval(user)) {
    return "/waiting"
  }

  switch (getUserRole(user)) {
    case "admin":
      return "/dashboard/properties"
    case "agent":
      return "/dashboard/agent"
    case "landlord":
      return "/dashboard/landlord"
    case "tenant":
      return "/dashboard/maintenance"
    case "applicant":
      return "/dashboard/applicant"
    case "builder":
      return "/dashboard/maintenance"
    default:
      return "/waiting"
  }
}

export function getDisplayName(user: Pick<AuthUser, "first_name" | "last_name"> | null | undefined) {
  const fullName = [user?.first_name?.trim() ?? "", user?.last_name?.trim() ?? ""]
    .filter(Boolean)
    .join(" ")

  return fullName || "User"
}

export function getPropertyImagePath(
  propertyId: string,
  imageId: string,
  variant: "original" | "thumbnail" = "original",
) {
  const query = variant === "thumbnail" ? "?variant=thumbnail" : ""
  return `/api/properties/${propertyId}/images/${imageId}${query}`
}

export function getPropertyImageLabel(image: Pick<PropertyImageRecord, "blobName" | "originalFileName">) {
  if (image.originalFileName?.trim()) {
    return image.originalFileName.trim()
  }

  const blobTail = image.blobName.split("/").pop() ?? image.blobName
  return blobTail.replace(/^[0-9a-fA-F-]{36}-/, "")
}
