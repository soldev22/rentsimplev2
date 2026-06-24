export type UserRole = "unallocated" | "admin" | "agent" | "landlord" | "tenant" | "applicant" | "builder"

export type ApprovalStatus = "pending_verification" | "pending_approval" | "approved"

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