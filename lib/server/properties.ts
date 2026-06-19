import "server-only"

import { randomUUID } from "node:crypto"

import {
  MAX_PROPERTY_IMAGES,
  getUserRole,
  canManageProperties,
  type AuthUser,
  type PendingPropertyImageReview,
  type PropertyImageRecord,
  type PropertyRecord,
} from "@/lib/auth"
import { getPropertiesContainer } from "@/lib/server/cosmos"
import { deletePropertyImageAssets } from "@/lib/server/blob"

export const DEFAULT_AFFORDABILITY_MULTIPLE = 2.5

const seedProperties: PropertyRecord[] = [
  {
    id: randomUUID(),
    ownerId: "demo-admin",
    address: "10 High Street",
    addressLine1: "10 High Street",
    addressLine2: "",
    city: "Manchester",
    postcode: "M1 1AA",
    type: "House",
    status: "Occupied",
    shortDescription: "Seeded development property in Manchester.",
    longDescription: "A seeded property for development.",
    description: "A seeded property for development.",
    bedrooms: 3,
    bathrooms: 2,
    monthlyRent: 1800,
    affordabilityMultiple: DEFAULT_AFFORDABILITY_MULTIPLE,
    images: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: randomUUID(),
    ownerId: "demo-admin",
    address: "Flat 2, City Road",
    addressLine1: "Flat 2, City Road",
    addressLine2: "",
    city: "Leeds",
    postcode: "LS1 4AB",
    type: "Flat",
    status: "Available",
    shortDescription: "Seeded city flat in Leeds.",
    longDescription: "A seeded city flat for development.",
    description: "A seeded city flat for development.",
    bedrooms: 2,
    bathrooms: 1,
    monthlyRent: 1450,
    affordabilityMultiple: DEFAULT_AFFORDABILITY_MULTIPLE,
    images: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

const publicRentalStatuses = ["available", "vacant"] as const

export type PropertyInput = {
  address?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  postcode?: string
  type: string
  status: string
  shortDescription?: string
  longDescription?: string
  description?: string
  bedrooms?: number
  bathrooms?: number
  monthlyRent?: number
  affordabilityMultiple?: number
}

function assertRequiredPropertyFields(property: Pick<PropertyRecord, "addressLine1" | "city" | "postcode" | "type" | "status">) {
  if (!property.addressLine1 || !property.city || !property.postcode || !property.type || !property.status) {
    throw new Error("PropertyValidationError")
  }
}

function deriveShortDescription(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim()

  if (!normalized) {
    return ""
  }

  const sentence = normalized.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim()
  const candidate = sentence || normalized

  return candidate.length <= 160 ? candidate : `${candidate.slice(0, 157).trimEnd()}...`
}

function composeAddress(parts: {
  addressLine1: string
  addressLine2?: string
  city?: string
  postcode?: string
}) {
  return [parts.addressLine1, parts.addressLine2?.trim() ?? "", parts.city?.trim() ?? "", parts.postcode?.trim() ?? ""]
    .filter(Boolean)
    .join(", ")
}

function toNonNegativeNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

function normalizePropertyImageRecord(image: PropertyImageRecord): PropertyImageRecord {
  return {
    ...image,
    originalFileName: typeof image.originalFileName === "string" ? image.originalFileName : undefined,
    thumbnailBlobName: typeof image.thumbnailBlobName === "string" ? image.thumbnailBlobName : undefined,
    thumbnailContentType: typeof image.thumbnailContentType === "string" ? image.thumbnailContentType : undefined,
    moderationStatus: image.moderationStatus === "pending_review" ? "pending_review" : "approved",
    moderationReason: typeof image.moderationReason === "string" ? image.moderationReason : undefined,
    moderationReviewedAt: typeof image.moderationReviewedAt === "string" ? image.moderationReviewedAt : undefined,
    uploadedByUserId: typeof image.uploadedByUserId === "string" ? image.uploadedByUserId : undefined,
    moderationScores:
      image.moderationScores && typeof image.moderationScores === "object"
        ? {
            hate: toNonNegativeNumber(image.moderationScores.hate),
            selfHarm: toNonNegativeNumber(image.moderationScores.selfHarm),
            sexual: toNonNegativeNumber(image.moderationScores.sexual),
            violence: toNonNegativeNumber(image.moderationScores.violence),
          }
        : undefined,
  }
}

function normalizePropertyRecord(property: PropertyRecord) {
  const addressLine1 = typeof property.addressLine1 === "string" && property.addressLine1.trim()
    ? property.addressLine1.trim()
    : property.address.trim()
  const addressLine2 = typeof property.addressLine2 === "string" ? property.addressLine2.trim() : ""
  const city = typeof property.city === "string" ? property.city.trim() : ""
  const postcode = typeof property.postcode === "string" ? property.postcode.trim().toUpperCase() : ""
  const longDescription =
    typeof property.longDescription === "string"
      ? property.longDescription.trim()
      : typeof property.description === "string"
        ? property.description.trim()
        : ""
  const shortDescription =
    typeof property.shortDescription === "string" && property.shortDescription.trim()
      ? property.shortDescription.trim()
      : deriveShortDescription(longDescription)

  return {
    ...property,
    addressLine1,
    addressLine2,
    city,
    postcode,
    address: composeAddress({ addressLine1, addressLine2, city, postcode }) || property.address,
    shortDescription,
    longDescription,
    description: longDescription,
    bedrooms: toNonNegativeNumber(property.bedrooms),
    bathrooms: toNonNegativeNumber(property.bathrooms),
    monthlyRent: toNonNegativeNumber(property.monthlyRent),
    affordabilityMultiple: toNonNegativeNumber(property.affordabilityMultiple) || DEFAULT_AFFORDABILITY_MULTIPLE,
    images: Array.isArray(property.images) ? property.images.map(normalizePropertyImageRecord) : [],
  }
}

function normalizePropertyInput(input: PropertyInput) {
  const addressLine1 = input.addressLine1?.trim() || input.address?.trim() || ""
  const addressLine2 = input.addressLine2?.trim() || ""
  const city = input.city?.trim() || ""
  const postcode = input.postcode?.trim().toUpperCase() || ""

  return {
    addressLine1,
    addressLine2,
    city,
    postcode,
    address: composeAddress({ addressLine1, addressLine2, city, postcode }),
    type: input.type.trim(),
    status: input.status.trim(),
    shortDescription: input.shortDescription?.trim() || deriveShortDescription(input.longDescription?.trim() || input.description?.trim() || ""),
    longDescription: input.longDescription?.trim() || input.description?.trim() || "",
    description: input.longDescription?.trim() || input.description?.trim() || "",
    bedrooms: Number.isFinite(input.bedrooms) ? Math.max(0, Number(input.bedrooms)) : 0,
    bathrooms: Number.isFinite(input.bathrooms) ? Math.max(0, Number(input.bathrooms)) : 0,
    monthlyRent: Number.isFinite(input.monthlyRent) ? Math.max(0, Number(input.monthlyRent)) : 0,
    affordabilityMultiple: Number.isFinite(input.affordabilityMultiple)
      ? Math.max(0, Number(input.affordabilityMultiple))
      : DEFAULT_AFFORDABILITY_MULTIPLE,
  }
}

async function getPropertyById(id: string) {
  const container = await getPropertiesContainer()
  const { resources } = await container.items
    .query<PropertyRecord>({
      query: "SELECT * FROM c WHERE c.id = @id",
      parameters: [{ name: "@id", value: id }],
    })
    .fetchAll()

  return resources[0] ? normalizePropertyRecord(resources[0]) : null
}

function canAccessProperty(user: AuthUser, property: PropertyRecord) {
  const role = getUserRole(user)

  if (role === "admin" || role === "agent") {
    return true
  }

  return property.ownerId === user.id
}

function isPublicRentalStatus(status: string) {
  return publicRentalStatuses.includes(status.trim().toLowerCase() as (typeof publicRentalStatuses)[number])
}

async function seedIfEmpty() {
  const container = await getPropertiesContainer()
  const { resources } = await container.items
    .query<number>({ query: "SELECT VALUE COUNT(1) FROM c" })
    .fetchAll()

  if ((resources[0] ?? 0) > 0) {
    return
  }

  await Promise.all(seedProperties.map((property) => container.items.create(property)))
}

function assertAdmin(user: AuthUser) {
  if (getUserRole(user) !== "admin") {
    throw new Error("Forbidden")
  }
}

export async function listPropertiesForUser(user: AuthUser) {
  await seedIfEmpty()

  const container = await getPropertiesContainer()

  const role = getUserRole(user)
  const querySpec =
    role === "admin" || role === "agent"
      ? {
          query: "SELECT * FROM c ORDER BY c.address",
        }
      : {
          query: "SELECT * FROM c WHERE c.ownerId = @ownerId ORDER BY c.address",
          parameters: [{ name: "@ownerId", value: user.id }],
        }

  const { resources } = await container.items.query<PropertyRecord>(querySpec).fetchAll()

  return resources.map(normalizePropertyRecord)
}

export async function getPropertyForUser(user: AuthUser, propertyId: string) {
  await seedIfEmpty()

  const property = await getPropertyById(propertyId)

  if (!property || !canAccessProperty(user, property)) {
    return null
  }

  return property
}

export async function listPublicAvailableProperties(locationQuery?: string) {
  await seedIfEmpty()

  const container = await getPropertiesContainer()
  const normalizedLocationQuery = locationQuery?.trim().toLowerCase() ?? ""
  const { resources } = await container.items
    .query<PropertyRecord>({
      query: normalizedLocationQuery
        ? `SELECT * FROM c
           WHERE (LOWER(c.status) = @available OR LOWER(c.status) = @vacant)
             AND (
               CONTAINS(LOWER(c.address), @query)
               OR CONTAINS(LOWER(c.city), @query)
               OR CONTAINS(LOWER(c.postcode), @query)
               OR CONTAINS(LOWER(c.addressLine1), @query)
             )`
        : `SELECT * FROM c
           WHERE LOWER(c.status) = @available OR LOWER(c.status) = @vacant`,
      parameters: [
        { name: "@available", value: "available" },
        { name: "@vacant", value: "vacant" },
        ...(normalizedLocationQuery ? [{ name: "@query", value: normalizedLocationQuery }] : []),
      ],
    })
    .fetchAll()

  return resources
    .map(normalizePropertyRecord)
    .sort((left, right) => {
      const leftCity = left.city.toLowerCase()
      const rightCity = right.city.toLowerCase()

      if (leftCity !== rightCity) {
        return leftCity.localeCompare(rightCity)
      }

      return left.address.localeCompare(right.address)
    })
}

export async function getPublicAvailableProperty(propertyId: string) {
  await seedIfEmpty()

  const property = await getPropertyById(propertyId)

  if (!property || !isPublicRentalStatus(property.status)) {
    return null
  }

  return property
}

export async function listPendingPropertyImagesForAdmin(user: AuthUser) {
  assertAdmin(user)
  await seedIfEmpty()

  const container = await getPropertiesContainer()
  const { resources } = await container.items
    .query<PropertyRecord>({
      query: "SELECT * FROM c WHERE ARRAY_LENGTH(c.images) > 0",
    })
    .fetchAll()

  return resources
    .map(normalizePropertyRecord)
    .flatMap<PendingPropertyImageReview>((property) =>
      property.images
        .filter((image) => image.moderationStatus === "pending_review")
        .map((image) => ({
          propertyId: property.id,
          propertyAddress: property.address,
          ownerId: property.ownerId,
          image,
        })),
    )
    .sort((left, right) => Date.parse(right.image.uploadedAt) - Date.parse(left.image.uploadedAt))
}

export async function createProperty(user: AuthUser, input: PropertyInput) {
  if (!canManageProperties(user)) {
    throw new Error("Forbidden")
  }

  const normalized = normalizePropertyInput(input)
  assertRequiredPropertyFields(normalized)
  const now = new Date().toISOString()
  const property: PropertyRecord = {
    id: randomUUID(),
    ownerId: user.id,
    address: normalized.address,
    addressLine1: normalized.addressLine1,
    addressLine2: normalized.addressLine2,
    city: normalized.city,
    postcode: normalized.postcode,
    type: normalized.type,
    status: normalized.status,
    shortDescription: normalized.shortDescription,
    longDescription: normalized.longDescription,
    description: normalized.description,
    bedrooms: normalized.bedrooms,
    bathrooms: normalized.bathrooms,
    monthlyRent: normalized.monthlyRent,
    affordabilityMultiple: normalized.affordabilityMultiple,
    images: [],
    createdAt: now,
    updatedAt: now,
  }

  const container = await getPropertiesContainer()
  await container.items.create(property)
  return property
}

export async function updateProperty(user: AuthUser, propertyId: string, input: Partial<PropertyInput>) {
  const property = await getPropertyById(propertyId)

  if (!property) {
    return null
  }

  if (!canAccessProperty(user, property) || !canManageProperties(user)) {
    throw new Error("Forbidden")
  }

  const nextProperty: PropertyRecord = {
    ...property,
    ...(typeof input.addressLine1 === "string" ? { addressLine1: input.addressLine1.trim() } : null),
    ...(typeof input.addressLine2 === "string" ? { addressLine2: input.addressLine2.trim() } : null),
    ...(typeof input.city === "string" ? { city: input.city.trim() } : null),
    ...(typeof input.postcode === "string" ? { postcode: input.postcode.trim().toUpperCase() } : null),
    ...(typeof input.address === "string" ? { addressLine1: input.address.trim() } : null),
    ...(typeof input.type === "string" ? { type: input.type.trim() } : null),
    ...(typeof input.status === "string" ? { status: input.status.trim() } : null),
    ...(typeof input.shortDescription === "string" ? { shortDescription: input.shortDescription.trim() } : null),
    ...(typeof input.longDescription === "string"
      ? { longDescription: input.longDescription.trim(), description: input.longDescription.trim() }
      : typeof input.description === "string"
        ? { longDescription: input.description.trim(), description: input.description.trim() }
        : null),
    ...(typeof input.description === "string" ? { description: input.description.trim() } : null),
    ...(typeof input.bedrooms === "number" ? { bedrooms: Math.max(0, input.bedrooms) } : null),
    ...(typeof input.bathrooms === "number" ? { bathrooms: Math.max(0, input.bathrooms) } : null),
    ...(typeof input.monthlyRent === "number" ? { monthlyRent: Math.max(0, input.monthlyRent) } : null),
    ...(typeof input.affordabilityMultiple === "number"
      ? { affordabilityMultiple: Math.max(0, input.affordabilityMultiple) || DEFAULT_AFFORDABILITY_MULTIPLE }
      : null),
    updatedAt: new Date().toISOString(),
  }

  nextProperty.address = composeAddress(nextProperty)
  if (!nextProperty.shortDescription.trim()) {
    nextProperty.shortDescription = deriveShortDescription(nextProperty.longDescription || nextProperty.description)
  }
  nextProperty.longDescription = nextProperty.longDescription || nextProperty.description
  nextProperty.description = nextProperty.longDescription
  assertRequiredPropertyFields(nextProperty)

  const container = await getPropertiesContainer()
  await container.item(nextProperty.id, nextProperty.ownerId).replace(nextProperty)
  return nextProperty
}

export async function deletePropertyForUser(user: AuthUser, propertyId: string) {
  const property = await getPropertyById(propertyId)

  if (!property) {
    return false
  }

  if (!canAccessProperty(user, property) || !canManageProperties(user)) {
    throw new Error("Forbidden")
  }

  await Promise.all(property.images.map((image) => deletePropertyImageAssets(image)))

  const container = await getPropertiesContainer()
  await container.item(property.id, property.ownerId).delete()
  return true
}

export async function addPropertyImage(user: AuthUser, propertyId: string, image: PropertyRecord["images"][number]) {
  const property = await getPropertyById(propertyId)

  if (!property) {
    return null
  }

  if (!canAccessProperty(user, property) || !canManageProperties(user)) {
    throw new Error("Forbidden")
  }

  if (property.images.length >= MAX_PROPERTY_IMAGES) {
    throw new Error("PropertyImageLimitExceeded")
  }

  const nextProperty: PropertyRecord = {
    ...property,
    images: [...property.images, image],
    updatedAt: new Date().toISOString(),
  }

  const container = await getPropertiesContainer()
  await container.item(nextProperty.id, nextProperty.ownerId).replace(nextProperty)
  return image
}

export async function removePropertyImage(user: AuthUser, propertyId: string, blobName: string) {
  const property = await getPropertyById(propertyId)

  if (!property) {
    return null
  }

  if (!canAccessProperty(user, property) || !canManageProperties(user)) {
    throw new Error("Forbidden")
  }

  const imageToRemove = property.images.find((image) => image.blobName === blobName)

  if (!imageToRemove) {
    return null
  }

  const nextImages = property.images.filter((image) => image.blobName !== blobName)

  await deletePropertyImageAssets(imageToRemove)

  const nextProperty: PropertyRecord = {
    ...property,
    images: nextImages,
    updatedAt: new Date().toISOString(),
  }

  const container = await getPropertiesContainer()
  await container.item(nextProperty.id, nextProperty.ownerId).replace(nextProperty)
  return nextProperty
}

export async function reviewPropertyImageForAdmin(
  user: AuthUser,
  propertyId: string,
  imageId: string,
  action: "approve" | "reject",
) {
  assertAdmin(user)

  const property = await getPropertyById(propertyId)

  if (!property) {
    return null
  }

  const image = property.images.find((candidate) => candidate.id === imageId)

  if (!image) {
    return null
  }

  const container = await getPropertiesContainer()

  if (action === "approve") {
    const nextProperty: PropertyRecord = {
      ...property,
      images: property.images.map((candidate) =>
        candidate.id === imageId
          ? {
              ...candidate,
              moderationStatus: "approved",
              moderationReason: "Approved by admin.",
              moderationReviewedAt: new Date().toISOString(),
            }
          : candidate,
      ),
      updatedAt: new Date().toISOString(),
    }

    await container.item(nextProperty.id, nextProperty.ownerId).replace(nextProperty)
    return normalizePropertyRecord(nextProperty)
  }

  const nextProperty: PropertyRecord = {
    ...property,
    images: property.images.filter((candidate) => candidate.id !== imageId),
    updatedAt: new Date().toISOString(),
  }

  await container.item(nextProperty.id, nextProperty.ownerId).replace(nextProperty)
  await deletePropertyImageAssets(image)
  return normalizePropertyRecord(nextProperty)
}