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
