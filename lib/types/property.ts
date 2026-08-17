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
  isCoverImage?: boolean
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

export type PropertyFinancials = {
  propertyValue: number
  annualAppreciationRate: number
  estimatedAnnualCosts: number
  purchaseCost?: number
  mortgageLender?: string
  mortgageBalance?: number
  mortgageInterestRate?: number
  mortgageMonthlyPayment?: number
  mortgageRenewalDate?: string
  depositAmount?: number
  depositProtectionScheme?: string
  depositReference?: string
  paymentFrequency?: "weekly" | "monthly" | "quarterly"
  paymentDueDay?: number
  latePaymentPolicy?: string
}

export type PropertyIncludedItem = {
  id: string
  name: string
  isElectrical: boolean
}

export type PropertyLettingPreferences = {
  petsAllowed: boolean
  smokingAllowed: boolean
  studentsAccepted: boolean
  universalCreditConsidered: boolean
  guarantorRequired: boolean
  maximumOccupants?: number
  minimumTenancyLengthMonths?: number
}

export type ComplianceType =
  | "electrical"
  | "gas"
  | "fire_alarm"
  | "smoke_alarm"
  | "legionella"
  | "epc"
  | "damp_survey"
  | "asbestos_survey"
  | "pest_control"
  | "boiler_service"
  | "pat_testing"

export type PropertyCompliance = {
  id: string
  type: ComplianceType
  patItemId?: string
  lastCheckedDate: string
  expirationDate: string
  certificateNumber?: string
  epcRating?: "A" | "B" | "C" | "D" | "E" | "F" | "G"
  provider?: string
  documentUrl?: string
  documents?: ComplianceDocument[]
  notApplicable?: boolean
  notes?: string
}

export type ComplianceDocument = {
  url: string
  blobName?: string
  fileName: string
  uploadedAt: string
}

export type PropertyRecord = {
  id: string
  uid?: string
  ownerId: string
  address: string
  addressLine1: string
  addressLine2: string
  city: string
  postcode: string
  nickname?: string
  type: string
  status: string
  shortDescription: string
  longDescription: string
  description: string
  bedrooms: number
  bathrooms: number
  monthlyRent: number
  affordabilityMultiple: number
  parking?: string
  heating?: string
  councilTaxBand?: string
  broadbandAvailable?: boolean
  images: PropertyImageRecord[]
  insurance?: PropertyInsurance
  financials?: PropertyFinancials
  lettingPreferences?: PropertyLettingPreferences
  includedItems?: PropertyIncludedItem[]
  compliance?: PropertyCompliance[]
  createdAt: string
  updatedAt: string
}