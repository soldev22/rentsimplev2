export interface PropertyBulkUploadRow {
  address: string
  city: string
  postcode: string
  propertyType: PropertyBulkUploadPropertyType
  status?: string
  bedrooms: number
  bathrooms: number
  monthlyRent: number
  shortDescription?: string
  longDescription?: string
  imageFiles?: string // comma-separated filenames
}

export interface PropertyBulkUploadRowWithIndex extends PropertyBulkUploadRow {
  rowIndex: number
}

export interface BulkUploadValidationError {
  rowIndex: number
  field: string
  error: string
}

export interface BulkUploadImageInfo {
  filename: string
  buffer: Buffer
  mimeType: string
}

export interface BulkUploadPreviewProperty extends PropertyBulkUploadRow {
  rowIndex: number
  images: {
    filename: string
    url?: string // data URL for preview
  }[]
}

export interface BulkUploadPreviewResult {
  properties: BulkUploadPreviewProperty[]
  errors: BulkUploadValidationError[]
  totalPropertiesCount: number
  imageCount: number
}

export interface BulkUploadConfirmRequest {
  previewHash: string // hash of preview to prevent tampering
  landlordEmail: string
  landlordId?: string // optional, for agent/admin acting on behalf
  acknowledgedLegalResponsibility: boolean
}

export interface BulkUploadResult {
  success: boolean
  batchId: string
  propertiesCreated: number
  propertiesSkipped: number
  errors?: BulkUploadValidationError[]
  message: string
}

export const PROPERTY_TYPE_OPTIONS = [
  "Detached house",
  "Semi-detached house",
  "Terraced house",
  "Bungalow",
  "Flat",
  "Maisonette",
  "Studio",
  "Duplex",
  "Penthouse",
  "Cottage",
  "Converted property",
  "other",
] as const

export type PropertyBulkUploadPropertyType = (typeof PROPERTY_TYPE_OPTIONS)[number]

export const PROPERTY_STATUS_OPTIONS = ["draft", "available", "vacant"] as const

export const BULK_UPLOAD_CSV_HEADERS = [
  "address",
  "city",
  "postcode",
  "propertyType",
  "status",
  "bedrooms",
  "bathrooms",
  "monthlyRent",
  "shortDescription",
  "longDescription",
  "imageFiles",
] as const

export const BULK_UPLOAD_REQUIRED_FIELDS = [
  "address",
  "city",
  "postcode",
  "propertyType",
  "bedrooms",
  "bathrooms",
  "monthlyRent",
] as const

export const BULK_UPLOAD_MAX_PROPERTIES = 500
export const BULK_UPLOAD_MAX_IMAGES_PER_PROPERTY = 10
export const BULK_UPLOAD_MAX_FILE_SIZE_MB = 100 // total zip size
export const BULK_UPLOAD_MAX_IMAGE_FILE_SIZE_MB = 5 // per image
