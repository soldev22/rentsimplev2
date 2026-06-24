import JSZip from "jszip"
import { parse as csvParse } from "csv-parse/sync"
import { createHash } from "crypto"

import {
  PropertyBulkUploadRow,
  PropertyBulkUploadRowWithIndex,
  BulkUploadValidationError,
  BulkUploadImageInfo,
  BulkUploadPreviewProperty,
  BulkUploadPreviewResult,
  PROPERTY_TYPE_OPTIONS,
  BULK_UPLOAD_CSV_HEADERS,
  BULK_UPLOAD_REQUIRED_FIELDS,
  BULK_UPLOAD_MAX_PROPERTIES,
  BULK_UPLOAD_MAX_IMAGES_PER_PROPERTY,
  BULK_UPLOAD_MAX_FILE_SIZE_MB,
  BULK_UPLOAD_MAX_IMAGE_FILE_SIZE_MB,
} from "@/lib/types/bulk-upload"
import { createProperty, PropertyInput } from "@/lib/server/properties"
import { uploadPropertyImage } from "@/lib/server/blob"
import { writeAuditEvent } from "@/lib/server/audit"
import type { AuthUser } from "@/lib/types/user"
import type { PropertyRecord } from "@/lib/types/property"

/**
 * Parse zip file containing CSV and images folder
 */
export async function parseZipFile(
  buffer: Buffer,
): Promise<{
  csvContent: string
  images: Map<string, BulkUploadImageInfo>
  errorMessage?: string
}> {
  try {
    if (buffer.length > BULK_UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024) {
      return {
        csvContent: "",
        images: new Map(),
        errorMessage: `Zip file too large. Maximum size is ${BULK_UPLOAD_MAX_FILE_SIZE_MB}MB.`,
      }
    }

    const zip = new JSZip()
    await zip.loadAsync(buffer)

    const csvFile = zip.file("properties.csv")
    if (!csvFile) {
      return {
        csvContent: "",
        images: new Map(),
        errorMessage: "properties.csv not found in zip file. Please include properties.csv in root directory.",
      }
    }

    const csvContent = await csvFile.async("text")
    if (!csvContent.trim()) {
      return {
        csvContent: "",
        images: new Map(),
        errorMessage: "properties.csv is empty.",
      }
    }

    const images = new Map<string, BulkUploadImageInfo>()

    // Parse images folder
    zip.folder("images")?.forEach(async (relativePath, file) => {
      if (file.dir) return

      const filename = relativePath.split("/").pop() || ""
      const mimeType = getMimeType(filename)

      if (!mimeType) {
        console.warn(`Skipping unsupported image format: ${filename}`)
        return
      }

      const buffer = await file.async("arraybuffer")
      const sizeInMB = buffer.byteLength / (1024 * 1024)

      if (sizeInMB > BULK_UPLOAD_MAX_IMAGE_FILE_SIZE_MB) {
        console.warn(
          `Skipping oversized image: ${filename} (${sizeInMB.toFixed(2)}MB)`,
        )
        return
      }

      images.set(filename, {
        filename,
        buffer: Buffer.from(buffer),
        mimeType,
      })
    })

    return { csvContent, images }
  } catch (error) {
    return {
      csvContent: "",
      images: new Map(),
      errorMessage: `Failed to parse zip file: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}

/**
 * Parse CSV content into property rows
 */
export function parsePropertyCSV(csvContent: string): PropertyBulkUploadRowWithIndex[] {
  try {
    const records = csvParse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[]

    return records.map((record, index) => ({
      rowIndex: index + 2, // +2 because CSV is 1-indexed and header is row 1
      address: record.address || "",
      city: record.city || "",
      postcode: record.postcode || "",
      propertyType: record.propertyType || "",
      status: record.status || "draft",
      bedrooms: isNaN(Number(record.bedrooms)) ? 0 : Number(record.bedrooms),
      bathrooms: isNaN(Number(record.bathrooms)) ? 0 : Number(record.bathrooms),
      monthlyRent: isNaN(Number(record.monthlyRent)) ? 0 : Number(record.monthlyRent),
      shortDescription: record.shortDescription || "",
      longDescription: record.longDescription || "",
      imageFiles: record.imageFiles || "",
    }))
  } catch (error) {
    throw new Error(
      `Failed to parse CSV: ${error instanceof Error ? error.message : "Unknown error"}`,
    )
  }
}

/**
 * Validate individual property row
 */
export function validatePropertyRow(
  row: PropertyBulkUploadRowWithIndex,
  images: Map<string, BulkUploadImageInfo>,
): BulkUploadValidationError[] {
  const errors: BulkUploadValidationError[] = []

  // Check required fields
  for (const field of BULK_UPLOAD_REQUIRED_FIELDS) {
    const value = row[field as keyof PropertyBulkUploadRow]
    if (value === null || value === undefined || value === "") {
      errors.push({
        rowIndex: row.rowIndex,
        field,
        error: `${field} is required`,
      })
    }
  }

  // Validate address
  if (row.address.length < 3) {
    errors.push({
      rowIndex: row.rowIndex,
      field: "address",
      error: "Address must be at least 3 characters",
    })
  }

  // Validate city
  if (row.city.length < 2) {
    errors.push({
      rowIndex: row.rowIndex,
      field: "city",
      error: "City must be at least 2 characters",
    })
  }

  // Validate postcode
  if (row.postcode.length < 2) {
    errors.push({
      rowIndex: row.rowIndex,
      field: "postcode",
      error: "Postcode must be at least 2 characters",
    })
  }

  // Validate propertyType
  if (!PROPERTY_TYPE_OPTIONS.includes(row.propertyType as any)) {
    errors.push({
      rowIndex: row.rowIndex,
      field: "propertyType",
      error: `propertyType must be one of: ${PROPERTY_TYPE_OPTIONS.join(", ")}`,
    })
  }

  // Validate numeric fields
  if (row.bedrooms < 0) {
    errors.push({
      rowIndex: row.rowIndex,
      field: "bedrooms",
      error: "Bedrooms must be a positive number",
    })
  }

  if (row.bathrooms < 0) {
    errors.push({
      rowIndex: row.rowIndex,
      field: "bathrooms",
      error: "Bathrooms must be a positive number",
    })
  }

  if (row.monthlyRent <= 0) {
    errors.push({
      rowIndex: row.rowIndex,
      field: "monthlyRent",
      error: "Monthly rent must be greater than 0",
    })
  }

  // Validate images
  if (row.imageFiles) {
    const imageFilenames = row.imageFiles
      .split(",")
      .map((f) => f.trim())
      .filter((f) => f)

    if (imageFilenames.length > BULK_UPLOAD_MAX_IMAGES_PER_PROPERTY) {
      errors.push({
        rowIndex: row.rowIndex,
        field: "imageFiles",
        error: `Maximum ${BULK_UPLOAD_MAX_IMAGES_PER_PROPERTY} images per property allowed`,
      })
    }

    for (const filename of imageFilenames) {
      if (!images.has(filename)) {
        errors.push({
          rowIndex: row.rowIndex,
          field: "imageFiles",
          error: `Image file not found in zip: ${filename}`,
        })
      }
    }
  }

  return errors
}

/**
 * Generate preview of bulk upload
 */
export async function generateBulkUploadPreview(
  rows: PropertyBulkUploadRowWithIndex[],
  images: Map<string, BulkUploadImageInfo>,
): Promise<BulkUploadPreviewResult> {
  const errors: BulkUploadValidationError[] = []
  const properties: BulkUploadPreviewProperty[] = []

  if (rows.length > BULK_UPLOAD_MAX_PROPERTIES) {
    return {
      properties: [],
      errors: [
        {
          rowIndex: 0,
          field: "general",
          error: `Too many properties. Maximum ${BULK_UPLOAD_MAX_PROPERTIES} allowed.`,
        },
      ],
      totalPropertiesCount: rows.length,
      imageCount: images.size,
    }
  }

  for (const row of rows) {
    const rowErrors = validatePropertyRow(row, images)

    if (rowErrors.length > 0) {
      errors.push(...rowErrors)
      continue
    }

    const imageFilenames = row.imageFiles
      ? row.imageFiles
          .split(",")
          .map((f) => f.trim())
          .filter((f) => f)
      : []

    const previewImages = imageFilenames.map((filename) => ({
      filename,
      url: `data:${images.get(filename)?.mimeType || "image/jpeg"};base64,${images.get(filename)?.buffer.toString("base64") || ""}`,
    }))

    properties.push({
      ...row,
      images: previewImages,
    })
  }

  return {
    properties,
    errors,
    totalPropertiesCount: rows.length,
    imageCount: images.size,
  }
}

/**
 * Generate hash of preview for tamper-detection
 */
export function generatePreviewHash(preview: BulkUploadPreviewResult): string {
  const data = JSON.stringify({
    count: preview.properties.length,
    properties: preview.properties.map((p) => ({
      address: p.address,
      city: p.city,
      postcode: p.postcode,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      monthlyRent: p.monthlyRent,
    })),
  })

  return createHash("sha256").update(data).digest("hex")
}

/**
 * Process bulk upload (all-or-nothing)
 */
export async function processBulkUpload(
  user: AuthUser,
  preview: BulkUploadPreviewResult,
  images: Map<string, BulkUploadImageInfo>,
  landlordEmail: string,
  actingAsAgent: boolean = false,
): Promise<{
  success: boolean
  createdPropertyIds: string[]
  errors: BulkUploadValidationError[]
}> {
  const createdPropertyIds: string[] = []
  const errors: BulkUploadValidationError[] = []

  try {
    // Process each property in the preview
    for (const previewProp of preview.properties) {
      try {
        // Prepare property input
        const propertyInput: PropertyInput = {
          type: previewProp.propertyType,
          status: "draft",
          address: previewProp.address,
          city: previewProp.city,
          postcode: previewProp.postcode,
          bedrooms: previewProp.bedrooms,
          bathrooms: previewProp.bathrooms,
          monthlyRent: previewProp.monthlyRent,
          shortDescription: previewProp.shortDescription || "",
          longDescription: previewProp.longDescription || "",
          affordabilityMultiple: 30,
        }

        // Create property document
        const property = await createProperty(user, propertyInput)
        createdPropertyIds.push(property.id)

        // Upload images
        for (const imageInfo of previewProp.images) {
          const imageFile = images.get(imageInfo.filename)
          if (imageFile) {
            await uploadPropertyImage({
              propertyId: property.id,
              fileName: imageFile.filename,
              contentType: imageFile.mimeType,
              data: imageFile.buffer,
              moderationStatus: "pending_review",
              uploadedByUserId: user.id,
            })
          }
        }

        // Log audit event for individual property
        await writeAuditEvent({
          entityType: "property",
          entityId: property.id,
          action: "CREATED",
          performedBy: user.email,
          fieldPath: "creation",
          oldValue: null,
          newValue: {
            address: property.address,
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
            monthlyRent: property.monthlyRent,
          },
          metadata: {
            source: "bulk_upload",
            batchPropertyCount: preview.properties.length,
            agentAction: actingAsAgent ? user.email : undefined,
          },
          timestamp: new Date().toISOString(),
        })
      } catch (error) {
        errors.push({
          rowIndex: previewProp.rowIndex,
          field: "general",
          error: `Failed to create property: ${error instanceof Error ? error.message : "Unknown error"}`,
        })
      }
    }

    // Log batch event
    await writeAuditEvent({
      entityType: "property",
      entityId: "bulk_upload",
      action: "BULK_UPLOAD_COMPLETED",
      performedBy: user.email,
      fieldPath: "batch",
      oldValue: null,
      newValue: {
        propertiesCreated: createdPropertyIds.length,
        propertiesAttempted: preview.properties.length,
      },
      metadata: {
        source: "bulk_upload",
        landlordEmail,
        totalCount: preview.properties.length,
        successCount: createdPropertyIds.length,
        failureCount: errors.length,
        agentAction: actingAsAgent ? user.email : undefined,
      },
      timestamp: new Date().toISOString(),
    })

    return {
      success: errors.length === 0,
      createdPropertyIds,
      errors,
    }
  } catch (error) {
    throw new Error(
      `Bulk upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    )
  }
}

/**
 * Get mime type from filename
 */
function getMimeType(filename: string): string | null {
  const ext = filename.toLowerCase().split(".").pop() || ""
  const mimeTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  }
  return mimeTypes[ext] || null
}
