export type UserRole = "unallocated" | "admin" | "agent" | "landlord" | "tenant" | "applicant" | "builder"
export type ApprovalStatus = "pending_approval" | "approved"
export type PropertyImageModerationStatus = "pending_review" | "approved"

export type PropertyImageModerationScores = {
  hate: number
  selfHarm: number
  sexual: number
  violence: number
}

export type AuthUser = {
  id: string
  email: string
  first_name: string
  last_name: string
  mobile: string
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
  images: PropertyImageRecord[]
  createdAt: string
  updatedAt: string
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
      return "/dashboard/tenants"
    case "applicant":
      return "/dashboard/applicant"
    case "builder":
      return "/dashboard/builder"
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
