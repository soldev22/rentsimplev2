import type { AuthUser } from "./types/user"
import type { PropertyImageRecord } from "./types/property"

export type {
  ApplicantScreeningScoreConfig,
  ApplicantProfileDefaults,
  ApprovalStatus,
  AuthUser,
  BuilderProfileDefaults,
  BuilderTrade,
  EmploymentStatus,
  NotificationProfileDefaults,
  LandlordProfile,
  PreferredContactMethod,
  UserRole,
} from "./types/user"
export type {
  PendingPropertyImageReview,
  PropertyFinancials,
  PropertyIncludedItem,
  PropertyLettingPreferences,
  PropertyImageModerationScores,
  PropertyImageModerationStatus,
  PropertyImageRecord,
  PropertyInsurance,
  PropertyRecord,
  ComplianceType,
  ComplianceDocument,
  PropertyCompliance,
} from "./types/property"
export type {
  ApplicationQuestionnaire,
  ApplicantChecklistSignOff,
  ApprovalDecision,
  DepositProtection,
  DepositStatus,
  DepositDocumentCategory,
  DepositDocumentRecord,
  DepositHistoryAction,
  DepositHistoryEntry,
  DepositRecord,
  FullReferencingChecks,
  MoveInChecklist,
  PostMoveInManagement,
  PreMoveInCompliance,
  ReferencingInstruction,
  ReferencingOutcome,
  ReferencingReport,
  TenantCommunicationChannel,
  TenantCommunicationDirection,
  TenantCommunicationEntry,
  TenantCommunicationNotification,
  TenantCommunicationNotificationChannel,
  TenantCommunicationNotificationStatus,
  TenancyCreditReportRequest,
  TenantDecisionOutcome,
  SiteVisitInviteStatus,
  TenancyAgreementPreparation,
  TenancyApplicationRecord,
  TenancyApplicationStage,
  TenancyApplicationStatus,
  TenancyVerificationDocument,
  TenancyVerificationDocumentCategory,
  TenancyRefereeContact,
  TenancyReferenceRequest,
  TenancyReferenceRequestStatus,
  RefereeRequestChannel,
  TenancyDocumentTracking,
} from "./types/application"
export type {
  BuilderBidStatus,
  MaintenanceAccreditationChecklist,
  MaintenanceBuilderBid,
  MaintenanceIssueCategory,
  MaintenanceIssueRecord,
  MaintenanceIssueUpdate,
  MaintenanceIssueStatus,
  MaintenancePriority,
} from "./types/maintenance"
export type {
  CaseType,
  CaseStatus,
  StageStatus,
  EscalationLevel,
  CaseMessageSenderRole,
  LegalTimerRequirement,
  LegalTimerConfiguration,
  EscalationEvent,
  CaseStage,
  CaseAttachment,
  CaseMessage,
  CaseMessageRead,
  PropertyCase,
  ContractorInviteRole,
  ContractorInvite,
  ThreadSummary,
  CaseAnalytics,
  AnalyticsMetrics,
  ContractorPerformanceMetric,
  TimeSeriesDataPoint,
  AdvisoryNotification,
  WebhookEventType,
  WebhookDeliveryAttempt,
  WebhookEvent,
} from "./types/case"

export const MAX_PROPERTY_IMAGES = 30

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function getUserRole(user: Pick<AuthUser, "role"> | null | undefined) {
  return user?.role ?? "unallocated"
}

export function canManagePlatform(user: (Pick<AuthUser, "role"> & Partial<Pick<AuthUser, "approval_status">>) | null | undefined) {
  return user?.role === "admin" || (user?.role === "user" && user.approval_status === "approved")
}

export function canManageAccountRoles(user: Pick<AuthUser, "role"> | null | undefined) {
  return user?.role === "admin"
}

// Resource-specific authorization still applies; Users never receive deletion rights.
export function canDelete(user: Pick<AuthUser, "role"> | null | undefined) {
  return Boolean(user) && user?.role !== "user"
}

export function assertCanDelete(user: Pick<AuthUser, "role"> | null | undefined) {
  if (!canDelete(user)) throw new Error("Forbidden")
}

export function assertPreservesRecords<T>(
  user: Pick<AuthUser, "role">,
  current: readonly T[],
  next: readonly T[],
  key: (record: T) => string,
) {
  if (!canDelete(user) && current.some((record) => !next.some((candidate) => key(candidate) === key(record)))) {
    throw new Error("Forbidden")
  }
}

export function canManageProperties(user: Pick<AuthUser, "role"> | null | undefined) {
  const role = getUserRole(user)
  return canManagePlatform(user) || role === "agent" || role === "landlord"
}

export function canReviewTenancyApplications(user: Pick<AuthUser, "role"> | null | undefined) {
  const role = getUserRole(user)
  return canManagePlatform(user) || role === "agent" || role === "landlord"
}

export function canAccessMaintenance(user: Pick<AuthUser, "role"> | null | undefined) {
  const role = getUserRole(user)
  return canManagePlatform(user) || role === "agent" || role === "landlord" || role === "tenant" || role === "builder"
}

export function isPendingApproval(user: Pick<AuthUser, "role" | "approval_status"> | null | undefined) {
  return user?.approval_status === "pending_approval" || getUserRole(user) === "unallocated"
}

export function isPendingVerification(user: Pick<AuthUser, "approval_status"> | null | undefined) {
  return user?.approval_status === "pending_verification"
}

export function getDefaultDashboardPath(user: Pick<AuthUser, "role" | "approval_status"> | null | undefined) {
  if (isPendingVerification(user) || isPendingApproval(user)) {
    return "/waiting"
  }

  switch (getUserRole(user)) {
    case "admin":
    case "user":
      return "/dashboard/platform"
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
