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

export type MaintenanceIssueUpdate = {
  id: string
  authorId: string
  authorName: string
  note: string
  photos: Array<{ id: string; url: string; uploadedAt: string }>
  createdAt: string
}

export type MaintenanceIssueRecord = {
  id: string
  propertyId: string
  propertyAddress: string
  tenantId: string
  tenantEmail: string
  tenantName: string
  reportedById?: string
  reportedByEmail?: string
  reportedByName?: string
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
  photoIds?: string[]
  photoUrls?: Array<{ id: string; url: string; uploadedAt: string }>
  updates?: MaintenanceIssueUpdate[]
  createdAt: string
  updatedAt: string
}

export const MAX_MAINTENANCE_UPDATE_PHOTOS = 5
export const MAX_MAINTENANCE_UPDATE_NOTE_LENGTH = 2000
export const MAX_MAINTENANCE_UPDATE_PHOTO_SIZE = 10 * 1024 * 1024