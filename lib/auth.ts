import type { AuthUser } from "./types/user"
import type { PropertyImageRecord } from "./types/property"

export type {
  ApplicantProfileDefaults,
  ApprovalStatus,
  AuthUser,
  BuilderProfileDefaults,
  BuilderTrade,
  EmploymentStatus,
  NotificationProfileDefaults,
  PreferredContactMethod,
  UserRole,
} from "./types/user"
export type {
  PendingPropertyImageReview,
  PropertyFinancials,
  PropertyImageModerationScores,
  PropertyImageModerationStatus,
  PropertyImageRecord,
  PropertyInsurance,
  PropertyRecord,
  ComplianceType,
  PropertyCompliance,
} from "./types/property"
export type {
  ApplicantChecklistSignOff,
  ApprovalDecision,
  DepositProtection,
  FullReferencingChecks,
  MoveInChecklist,
  PostMoveInManagement,
  PreMoveInCompliance,
  PreScreeningOutcome,
  PreScreeningQuestionnaire,
  PreScreeningSummary,
  ReferencingInstruction,
  ReferencingOutcome,
  ReferencingReport,
  TenantCommunicationChannel,
  TenantCommunicationDirection,
  TenantCommunicationEntry,
  TenantCommunicationNotification,
  TenantCommunicationNotificationChannel,
  TenantCommunicationNotificationStatus,
  TenantDecisionOutcome,
  TenancyAgreementPreparation,
  TenancyApplicationRecord,
  TenancyApplicationStage,
  TenancyApplicationStatus,
  TenancyDocumentTracking,
} from "./types/application"
export type {
  BuilderBidStatus,
  MaintenanceAccreditationChecklist,
  MaintenanceBuilderBid,
  MaintenanceIssueCategory,
  MaintenanceIssueRecord,
  MaintenanceIssueStatus,
  MaintenancePriority,
} from "./types/maintenance"

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
