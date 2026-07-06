export type PropertyImageModerationStatus = "pending_review" | "approved"

export type PropertyImageModerationScores = {
  hate: number
  selfHarm: number
  sexual: number
  violence: number
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

export type PropertyInsurance = {
  isInsured: boolean
  insurerName?: string
  policyNumber?: string
  renewalDate?: string
  notes?: string
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
  insurance?: PropertyInsurance
  createdAt: string
  updatedAt: string
}