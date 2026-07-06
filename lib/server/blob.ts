import "server-only"

import { randomUUID } from "node:crypto"
import { Readable } from "node:stream"

import sharp from "sharp"
import { BlobServiceClient } from "@azure/storage-blob"
import { DefaultAzureCredential } from "@azure/identity"

import type { PropertyImageRecord } from "@/lib/auth"

const storageConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING?.trim() ?? ""
const storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME?.trim() ?? ""
const propertyImagesContainerName = process.env.PROPERTY_IMAGES_CONTAINER?.trim() || "property-images"

function getBlobServiceClient() {
  if (storageConnectionString) {
    return BlobServiceClient.fromConnectionString(storageConnectionString)
  }

  if (!storageAccountName) {
    throw new Error("Azure Blob Storage is not configured. Set AZURE_STORAGE_CONNECTION_STRING or AZURE_STORAGE_ACCOUNT_NAME.")
  }

  return new BlobServiceClient(
    `https://${storageAccountName}.blob.core.windows.net`,
    new DefaultAzureCredential(),
  )
}

async function getPropertyImagesContainerClient() {
  const serviceClient = getBlobServiceClient()
  const containerClient = serviceClient.getContainerClient(propertyImagesContainerName)
  await containerClient.createIfNotExists()
  return containerClient
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-")
}

async function createThumbnailBuffer(data: Buffer) {
  return sharp(data)
    .rotate()
    .resize({
      width: 320,
      height: 240,
      fit: "cover",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80 })
    .toBuffer()
}

export async function uploadPropertyImage(input: {
  propertyId: string
  fileName: string
  contentType: string
  data: Buffer
  moderationStatus: PropertyImageRecord["moderationStatus"]
  moderationReason?: string
  moderationScores?: PropertyImageRecord["moderationScores"]
  uploadedByUserId?: string
}) {
  const containerClient = await getPropertyImagesContainerClient()
  const imageId = randomUUID()
  const blobName = `properties/${input.propertyId}/${imageId}-${sanitizeFileName(input.fileName)}`
  const thumbnailBlobName = `properties/${input.propertyId}/thumbnails/${imageId}.jpg`
  const blockBlobClient = containerClient.getBlockBlobClient(blobName)
  const thumbnailBlobClient = containerClient.getBlockBlobClient(thumbnailBlobName)
  const uploadedAt = new Date().toISOString()
  const thumbnailBuffer = await createThumbnailBuffer(input.data)

  await Promise.all([
    blockBlobClient.uploadData(input.data, {
      blobHTTPHeaders: {
        blobContentType: input.contentType || "application/octet-stream",
      },
    }),
    thumbnailBlobClient.uploadData(thumbnailBuffer, {
      blobHTTPHeaders: {
        blobContentType: "image/jpeg",
      },
    }),
  ])

  const image: PropertyImageRecord = {
    id: imageId,
    blobName,
    thumbnailBlobName,
    originalFileName: input.fileName,
    url: blockBlobClient.url,
    contentType: input.contentType || "application/octet-stream",
    thumbnailContentType: "image/jpeg",
    moderationStatus: input.moderationStatus,
    moderationReason: input.moderationReason,
    moderationScores: input.moderationScores,
    uploadedByUserId: input.uploadedByUserId,
    size: input.data.byteLength,
    uploadedAt,
  }

  return image
}

export async function deletePropertyImage(blobName: string) {
  const containerClient = await getPropertyImagesContainerClient()
  await containerClient.deleteBlob(blobName, {
    deleteSnapshots: "include",
  })
}

export async function deletePropertyImageAssets(image: Pick<PropertyImageRecord, "blobName" | "thumbnailBlobName">) {
  await Promise.all([
    deletePropertyImage(image.blobName).catch(() => undefined),
    image.thumbnailBlobName ? deletePropertyImage(image.thumbnailBlobName).catch(() => undefined) : undefined,
  ])
}

export async function downloadPropertyImage(blobName: string) {
  const containerClient = await getPropertyImagesContainerClient()
  const blobClient = containerClient.getBlobClient(blobName)
  const download = await blobClient.download()

  if (!download.readableStreamBody) {
    throw new Error("Blob stream unavailable")
  }

  return {
    stream: Readable.toWeb(download.readableStreamBody as Readable) as ReadableStream,
    contentType: download.contentType || "application/octet-stream",
    contentLength: download.contentLength,
    etag: download.etag,
    lastModified: download.lastModified,
  }
}

// ==================== CASE ATTACHMENTS ====================

const caseAttachmentsContainerName = process.env.CASE_ATTACHMENTS_CONTAINER?.trim() || "case-attachments"

async function getCaseAttachmentsContainerClient() {
  const serviceClient = getBlobServiceClient()
  const containerClient = serviceClient.getContainerClient(caseAttachmentsContainerName)
  await containerClient.createIfNotExists()
  return containerClient
}

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function uploadCaseAttachment(input: {
  caseId: string
  fileName: string
  fileBuffer: Buffer
  mimeType: string
  uploadedBy: string
}) {
  // Validate file size
  if (input.fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum of 10MB`)
  }

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(input.mimeType)) {
    throw new Error(`File type not allowed: ${input.mimeType}`)
  }

  const containerClient = await getCaseAttachmentsContainerClient()

  // Create unique blob name: caseId/timestamp-uuid-filename
  const timestamp = Date.now()
  const uuid = randomUUID().slice(0, 8)
  const sanitized = sanitizeFileName(input.fileName)
  const blobName = `${input.caseId}/${timestamp}-${uuid}-${sanitized}`

  const blobClient = containerClient.getBlockBlobClient(blobName)

  await blobClient.uploadData(input.fileBuffer, {
    blobHTTPHeaders: {
      blobContentType: input.mimeType,
    },
  })

  return {
    blobName,
    url: blobClient.url,
    size: input.fileBuffer.length,
  }
}

export async function downloadCaseAttachment(blobName: string) {
  const containerClient = await getCaseAttachmentsContainerClient()
  const blobClient = containerClient.getBlobClient(blobName)
  const download = await blobClient.download()

  if (!download.readableStreamBody) {
    throw new Error("Blob stream unavailable")
  }

  return {
    stream: Readable.toWeb(download.readableStreamBody as Readable) as ReadableStream,
    contentType: download.contentType || "application/octet-stream",
    contentLength: download.contentLength,
    fileName: blobName.split("/").pop() || blobName,
  }
}

export async function deleteCaseAttachment(blobName: string) {
  const containerClient = await getCaseAttachmentsContainerClient()
  const blobClient = containerClient.getBlobClient(blobName)
  await blobClient.delete()
}

