import "server-only"

import { randomUUID } from "node:crypto"

import {
  MAX_PROPERTY_IMAGES,
  getUserRole,
  canManageProperties,
  type AuthUser,
  type PendingPropertyImageReview,
  type PropertyFinancials,
  type PropertyImageRecord,
  type PropertyInsurance,
  type PropertyRecord,
  type PropertyCompliance,
  type ComplianceType,
} from "@/lib/auth"
import { AUDIT_ACTION_TYPES } from "@/lib/types/audit"
import { writeAuditEvent, writeAuditEvents } from "@/lib/server/audit"
import { getPropertiesContainer } from "@/lib/server/cosmos"
import { deletePropertyImageAssets } from "@/lib/server/blob"
import {
  buildPaginatedResult,
  fetchQueryPageWithContinuation,
  normalizePageOptions,
  type PageOptions,
} from "@/lib/server/pagination"
import { listLandlordDirectoryForUser, listLandlordTeamUsers } from "@/lib/server/users"

export const DEFAULT_AFFORDABILITY_MULTIPLE = 2.5
const propertySeedEnabled = process.env.PROPERTY_DEMO_SEED_ENABLED?.trim().toLowerCase() === "true"

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

const publicRentalStatuses = ["available"] as const

export type PropertyInput = {
  uid?: string
  nickname?: string
  ownerId?: string
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
  parking?: string
  heating?: string
  councilTaxBand?: string
  broadbandAvailable?: boolean | string
}

async function getAccessibleLandlordIds(user: AuthUser, selectedLandlordId?: string) {
  const role = getUserRole(user)

  if (role === "admin") {
    return selectedLandlordId?.trim() ? new Set([selectedLandlordId.trim().toLowerCase()]) : null
  }

  if (role === "agent") {
    const landlords = await listLandlordDirectoryForUser(user)
    const landlordIds = new Set(landlords.map((landlord) => landlord.id))

    if (selectedLandlordId?.trim()) {
      const normalizedSelectedLandlordId = selectedLandlordId.trim().toLowerCase()
      return landlordIds.has(normalizedSelectedLandlordId) ? new Set([normalizedSelectedLandlordId]) : new Set<string>()
    }

    return landlordIds
  }

  if (role === "landlord") {
    const teamUsers = await listLandlordTeamUsers(user)
    return new Set(teamUsers.map((member) => member.id))
  }

  return new Set<string>()
}

async function canAccessPropertyForUser(user: AuthUser, property: PropertyRecord) {
  const role = getUserRole(user)

  if (role === "admin") {
    return true
  }

  if (role === "agent") {
    const landlordIds = await getAccessibleLandlordIds(user)
    if (!landlordIds) {
      return false
    }
    return landlordIds.has(property.ownerId)
  }

  if (role === "landlord") {
    const landlordIds = await getAccessibleLandlordIds(user)
    return landlordIds?.has(property.ownerId) ?? false
  }

  return property.ownerId === user.id
}

async function resolvePropertyOwnerIdForCreate(user: AuthUser, requestedOwnerId?: string) {
  const role = getUserRole(user)

  if (role === "admin") {
    return requestedOwnerId?.trim().toLowerCase() || user.id
  }

  if (role === "agent") {
    const landlordIds = await getAccessibleLandlordIds(user)
    const normalizedRequestedOwnerId = requestedOwnerId?.trim().toLowerCase()

    if (!landlordIds) {
      return user.id
    }

    if (normalizedRequestedOwnerId && landlordIds.has(normalizedRequestedOwnerId)) {
      return normalizedRequestedOwnerId
    }
  }

  return user.id
}

async function resolvePropertyOwnerIdForUpdate(user: AuthUser, requestedOwnerId: string | undefined, currentOwnerId: string) {
  if (!requestedOwnerId?.trim()) {
    return currentOwnerId
  }

  const role = getUserRole(user)
  const normalizedRequestedOwnerId = requestedOwnerId.trim().toLowerCase()

  if (role === "admin") {
    return normalizedRequestedOwnerId
  }

  if (role === "agent") {
    const landlordIds = await getAccessibleLandlordIds(user)

    if (!landlordIds) {
      return currentOwnerId
    }

    if (landlordIds.has(normalizedRequestedOwnerId)) {
      return normalizedRequestedOwnerId
    }
  }

  return currentOwnerId
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

function normalizePropertyInsurance(insurance: PropertyInsurance | undefined): PropertyInsurance | undefined {
  if (!insurance || typeof insurance !== "object") {
    return undefined
  }

  return {
    isInsured: insurance.isInsured === true,
    insurerName: typeof insurance.insurerName === "string" && insurance.insurerName.trim() ? insurance.insurerName.trim() : undefined,
    policyNumber: typeof insurance.policyNumber === "string" && insurance.policyNumber.trim() ? insurance.policyNumber.trim() : undefined,
    renewalDate: typeof insurance.renewalDate === "string" && insurance.renewalDate.trim() ? insurance.renewalDate.trim() : undefined,
    notes: typeof insurance.notes === "string" && insurance.notes.trim() ? insurance.notes.trim() : undefined,
  }
}

function normalizePropertyFinancials(financials: PropertyFinancials | undefined): PropertyFinancials | undefined {
  if (!financials || typeof financials !== "object") {
    return undefined
  }

  const propertyValue = typeof financials.propertyValue === "number" ? Math.max(0, financials.propertyValue) : 0
  const annualAppreciationRate = typeof financials.annualAppreciationRate === "number" ? Math.max(-100, financials.annualAppreciationRate) : 0
  const estimatedAnnualCosts = typeof financials.estimatedAnnualCosts === "number" ? Math.max(0, financials.estimatedAnnualCosts) : 0

  if (propertyValue === 0) {
    return undefined
  }

  return {
    propertyValue,
    annualAppreciationRate,
    estimatedAnnualCosts,
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
  const broadbandValue = property.broadbandAvailable as unknown
  const broadbandAvailable =
    typeof broadbandValue === "boolean"
      ? broadbandValue
      : typeof broadbandValue === "string"
        ? ["yes", "true", "1"].includes(broadbandValue.trim().toLowerCase())
        : false

  return {
    ...property,
    uid: typeof property.uid === "string" && property.uid.trim() ? property.uid.trim() : property.id,
    nickname: typeof property.nickname === "string" && property.nickname.trim() ? property.nickname.trim() : undefined,
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
    parking: typeof property.parking === "string" ? property.parking.trim() : "",
    heating: typeof property.heating === "string" ? property.heating.trim() : "",
    councilTaxBand: typeof property.councilTaxBand === "string" ? property.councilTaxBand.trim() : "",
    broadbandAvailable,
    images: Array.isArray(property.images) ? property.images.map(normalizePropertyImageRecord) : [],
    insurance: normalizePropertyInsurance(property.insurance),
    financials: normalizePropertyFinancials(property.financials),
    compliance: normalizePropertyComplianceArray(property.compliance),
  }
}

function normalizePropertyInput(input: PropertyInput) {
  const addressLine1 = input.addressLine1?.trim() || input.address?.trim() || ""
  const addressLine2 = input.addressLine2?.trim() || ""
  const city = input.city?.trim() || ""
  const postcode = input.postcode?.trim().toUpperCase() || ""
  const parking = typeof input.parking === "string" ? input.parking.trim() : ""
  const heating = typeof input.heating === "string" ? input.heating.trim() : ""
  const councilTaxBand = typeof input.councilTaxBand === "string" ? input.councilTaxBand.trim() : ""
  const broadbandValue = input.broadbandAvailable as unknown
  const broadbandAvailable =
    typeof broadbandValue === "boolean"
      ? broadbandValue
      : typeof broadbandValue === "string"
        ? ["yes", "true", "1"].includes(broadbandValue.trim().toLowerCase())
        : false

  return {
    uid: typeof input.uid === "string" && input.uid.trim() ? input.uid.trim() : undefined,
    nickname: typeof input.nickname === "string" && input.nickname.trim() ? input.nickname.trim() : undefined,
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
    parking,
    heating,
    councilTaxBand,
    broadbandAvailable,
  }
}

export { normalizePropertyInput }

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

export async function getPropertyByIdForSystem(id: string) {
  await seedIfEmpty()
  return getPropertyById(id)
}

function isPublicRentalStatus(status: string) {
  return publicRentalStatuses.includes(status.trim().toLowerCase() as (typeof publicRentalStatuses)[number])
}

function getPropertyAuditMetadata(property: PropertyRecord, user: AuthUser) {
  return {
    ownerId: property.ownerId,
    propertyStatus: property.status,
    performedByRole: getUserRole(user),
  }
}

function buildPropertyPublishingAuditEvents(
  previousProperty: PropertyRecord,
  nextProperty: PropertyRecord,
  user: AuthUser,
) {
  const events: Array<{
    entityType: string
    entityId: string
    action: string
    performedBy: string
    fieldPath?: string
    oldValue?: unknown
    newValue?: unknown
    metadata?: Record<string, unknown>
    timestamp?: string
  }> = []
  const metadata = {
    ...getPropertyAuditMetadata(nextProperty, user),
    workflow: "publishing",
  }

  if (
    previousProperty.shortDescription !== nextProperty.shortDescription ||
    previousProperty.longDescription !== nextProperty.longDescription
  ) {
    events.push({
      entityType: "property",
      entityId: nextProperty.id,
      action: AUDIT_ACTION_TYPES.APPROVED_BY_LANDLORD,
      fieldPath: "listingDescription",
      oldValue: {
        shortDescription: previousProperty.shortDescription,
        longDescription: previousProperty.longDescription,
      },
      newValue: {
        shortDescription: nextProperty.shortDescription,
        longDescription: nextProperty.longDescription,
      },
      performedBy: user.email,
      metadata: {
        ...metadata,
        approvalSubject: "listing_description",
      },
      timestamp: nextProperty.updatedAt,
    })
  }

  if (!isPublicRentalStatus(previousProperty.status) && isPublicRentalStatus(nextProperty.status)) {
    events.push({
      entityType: "property",
      entityId: nextProperty.id,
      action: AUDIT_ACTION_TYPES.EXECUTED_BY_SYSTEM,
      fieldPath: "status",
      oldValue: previousProperty.status,
      newValue: nextProperty.status,
      performedBy: "system",
      metadata: {
        ...metadata,
        approvedBy: user.email,
        operation: "publish_property_listing",
      },
      timestamp: nextProperty.updatedAt,
    })
  }

  return events
}

async function seedIfEmpty() {
  if (!propertySeedEnabled) {
    return
  }

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

export async function listPropertiesForUser(user: AuthUser, landlordId?: string) {
  await seedIfEmpty()

  const container = await getPropertiesContainer()

  const role = getUserRole(user)
  const accessibleLandlordIds = await getAccessibleLandlordIds(user, landlordId)
  const querySpec =
    role === "admin" || role === "agent" || role === "landlord"
      ? {
          query: "SELECT * FROM c ORDER BY c.address",
        }
      : {
          query: "SELECT * FROM c WHERE c.ownerId = @ownerId ORDER BY c.address",
          parameters: [{ name: "@ownerId", value: user.id }],
        }

  const { resources } = await container.items.query<PropertyRecord>(querySpec).fetchAll()

  const normalizedProperties = resources.map(normalizePropertyRecord)

  if (role === "admin" && accessibleLandlordIds === null) {
    return normalizedProperties
  }

  if (role === "admin" || role === "agent") {
    return normalizedProperties.filter((property) => accessibleLandlordIds?.has(property.ownerId))
  }

  if (role === "landlord") {
    return normalizedProperties.filter((property) => accessibleLandlordIds?.has(property.ownerId))
  }

  return normalizedProperties
}

export async function listPropertiesForUserPage(user: AuthUser, landlordId?: string, options?: PageOptions) {
  await seedIfEmpty()

  const container = await getPropertiesContainer()
  const role = getUserRole(user)
  const { page, pageSize, offset } = normalizePageOptions(options, { defaultPageSize: 25, maxPageSize: 100 })
  const ownerFilter = await buildPropertyOwnerFilter(user, landlordId, role)
  const countQuery = `SELECT VALUE COUNT(1) FROM c${ownerFilter.whereClause}`
  const dataQuery = `SELECT * FROM c${ownerFilter.whereClause} ORDER BY c.address OFFSET ${offset} LIMIT ${pageSize}`

  const [{ resources: countRows }, { resources }] = await Promise.all([
    container.items.query<number>({ query: countQuery, parameters: ownerFilter.parameters }).fetchAll(),
    container.items.query<PropertyRecord>({ query: dataQuery, parameters: ownerFilter.parameters }).fetchAll(),
  ])
  const normalizedProperties = resources.map(normalizePropertyRecord)
  const totalCount = countRows[0] ?? 0

  return buildPaginatedResult(normalizedProperties, totalCount, page, pageSize)
}

async function buildPropertyOwnerFilter(user: AuthUser, landlordId: string | undefined, role: ReturnType<typeof getUserRole>) {
  if (role === "admin" || role === "agent") {
    const accessibleLandlordIds = await getAccessibleLandlordIds(user, landlordId)

    if (role === "admin" && accessibleLandlordIds === null) {
      return {
        whereClause: "",
        parameters: [] as Array<{ name: string; value: string }>,
      }
    }

    const ownerIds = [...(accessibleLandlordIds ?? new Set<string>())]

    if (ownerIds.length === 0) {
      return {
        whereClause: " WHERE 1 = 0",
        parameters: [] as Array<{ name: string; value: string }>,
      }
    }

    const parameters = ownerIds.map((ownerId, index) => ({ name: `@ownerId${index}`, value: ownerId }))
    const inClause = parameters.map((parameter) => parameter.name).join(", ")

    return {
      whereClause: ` WHERE c.ownerId IN (${inClause})`,
      parameters,
    }
  }

  if (role === "landlord") {
    const accessibleLandlordIds = await getAccessibleLandlordIds(user)
    const ownerIds = [...(accessibleLandlordIds ?? new Set<string>())]

    if (ownerIds.length === 0) {
      return {
        whereClause: " WHERE 1 = 0",
        parameters: [] as Array<{ name: string; value: string }>,
      }
    }

    const parameters = ownerIds.map((ownerId, index) => ({ name: `@ownerId${index}`, value: ownerId }))
    const inClause = parameters.map((parameter) => parameter.name).join(", ")

    return {
      whereClause: ` WHERE c.ownerId IN (${inClause})`,
      parameters,
    }
  }

  return {
    whereClause: " WHERE c.ownerId = @ownerId",
    parameters: [{ name: "@ownerId", value: user.id }],
  }
}

export async function listPropertiesForUserByContinuation(
  user: AuthUser,
  landlordId?: string,
  options?: {
    continuationToken?: string
    maxItemCount?: number
  },
) {
  await seedIfEmpty()

  const container = await getPropertiesContainer()
  const role = getUserRole(user)
  const ownerFilter = await buildPropertyOwnerFilter(user, landlordId, role)
  const query = `SELECT * FROM c${ownerFilter.whereClause} ORDER BY c.address`
  const page = await fetchQueryPageWithContinuation<PropertyRecord>(
    container,
    {
      query,
      parameters: ownerFilter.parameters,
    },
    options,
  )

  return {
    items: page.items.map(normalizePropertyRecord),
    continuationToken: page.continuationToken,
    maxItemCount: page.maxItemCount,
  }
}

export async function getPropertyForUser(user: AuthUser, propertyId: string) {
  await seedIfEmpty()

  const property = await getPropertyById(propertyId)

  if (!property || !(await canAccessPropertyForUser(user, property))) {
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
           WHERE LOWER(c.status) = @available
             AND (
               CONTAINS(LOWER(c.address), @query)
               OR CONTAINS(LOWER(c.city), @query)
               OR CONTAINS(LOWER(c.postcode), @query)
               OR CONTAINS(LOWER(c.addressLine1), @query)
             )`
        : `SELECT * FROM c
           WHERE LOWER(c.status) = @available`,
      parameters: [
        { name: "@available", value: "available" },
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
  const ownerId = await resolvePropertyOwnerIdForCreate(user, input.ownerId)
  const property: PropertyRecord = {
    id: randomUUID(),
    uid: input.uid?.trim() || randomUUID(),
    ownerId,
    address: normalized.address,
    addressLine1: normalized.addressLine1,
    addressLine2: normalized.addressLine2,
    nickname: normalized.nickname,
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
    parking: normalized.parking || undefined,
    heating: normalized.heating || undefined,
    councilTaxBand: normalized.councilTaxBand || undefined,
    broadbandAvailable: normalized.broadbandAvailable,
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

  if (!(await canAccessPropertyForUser(user, property)) || !canManageProperties(user)) {
    throw new Error("Forbidden")
  }

  const nextOwnerId = await resolvePropertyOwnerIdForUpdate(user, input.ownerId, property.ownerId)

  const nextProperty: PropertyRecord = {
    ...property,
    uid: typeof input.uid === "string" && input.uid.trim() ? input.uid.trim() : property.uid ?? property.id,
    nickname: typeof input.nickname === "string" ? (input.nickname.trim() || undefined) : property.nickname,
    ownerId: nextOwnerId,
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
    ...(typeof input.parking === "string" ? { parking: input.parking.trim() || undefined } : null),
    ...(typeof input.heating === "string" ? { heating: input.heating.trim() || undefined } : null),
    ...(typeof input.councilTaxBand === "string" ? { councilTaxBand: input.councilTaxBand.trim() || undefined } : null),
    ...(typeof input.broadbandAvailable === "boolean"
      ? { broadbandAvailable: input.broadbandAvailable }
      : typeof input.broadbandAvailable === "string"
        ? { broadbandAvailable: ["yes", "true", "1"].includes(input.broadbandAvailable.trim().toLowerCase()) }
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
  if (nextOwnerId !== property.ownerId) {
    await container.item(property.id, property.ownerId).delete()
    await container.items.create(nextProperty)
  } else {
    await container.item(nextProperty.id, nextProperty.ownerId).replace(nextProperty)
  }

  const auditEvents = buildPropertyPublishingAuditEvents(property, nextProperty, user)

  if (auditEvents.length > 0) {
    await writeAuditEvents(auditEvents)
  }

  return nextProperty
}

export async function deletePropertyForUser(user: AuthUser, propertyId: string) {
  const property = await getPropertyById(propertyId)

  if (!property) {
    return false
  }

  if (!(await canAccessPropertyForUser(user, property)) || !canManageProperties(user)) {
    throw new Error("Forbidden")
  }

  await Promise.all(property.images.map((image) => deletePropertyImageAssets(image)))

  const container = await getPropertiesContainer()
  await container.item(property.id, property.ownerId).delete()
  return true
}

export async function updatePropertyInsurance(
  user: AuthUser,
  propertyId: string,
  insurance: PropertyInsurance,
) {
  const property = await getPropertyById(propertyId)

  if (!property) {
    return null
  }

  if (!(await canAccessPropertyForUser(user, property)) || !canManageProperties(user)) {
    throw new Error("Forbidden")
  }

  const nextProperty: PropertyRecord = {
    ...property,
    insurance: normalizePropertyInsurance(insurance) ?? { isInsured: false },
    updatedAt: new Date().toISOString(),
  }

  const container = await getPropertiesContainer()
  await container.item(nextProperty.id, nextProperty.ownerId).replace(nextProperty)

  await writeAuditEvent({
    entityType: "property",
    entityId: nextProperty.id,
    action: AUDIT_ACTION_TYPES.EXECUTED_BY_SYSTEM,
    fieldPath: "insurance",
    oldValue: property.insurance,
    newValue: nextProperty.insurance,
    performedBy: user.email,
    metadata: {
      ...getPropertyAuditMetadata(nextProperty, user),
      operation: "update_property_insurance",
    },
  })

  return nextProperty
}

export async function updatePropertyFinancials(
  user: AuthUser,
  propertyId: string,
  financials: PropertyFinancials,
) {
  const property = await getPropertyById(propertyId)

  if (!property) {
    return null
  }

  if (!(await canAccessPropertyForUser(user, property)) || !canManageProperties(user)) {
    throw new Error("Forbidden")
  }

  const nextProperty: PropertyRecord = {
    ...property,
    financials: normalizePropertyFinancials(financials),
    updatedAt: new Date().toISOString(),
  }

  const container = await getPropertiesContainer()
  await container.item(nextProperty.id, nextProperty.ownerId).replace(nextProperty)

  await writeAuditEvent({
    entityType: "property",
    entityId: nextProperty.id,
    action: AUDIT_ACTION_TYPES.EXECUTED_BY_SYSTEM,
    fieldPath: "financials",
    oldValue: property.financials,
    newValue: nextProperty.financials,
    performedBy: user.email,
    metadata: {
      ...getPropertyAuditMetadata(nextProperty, user),
      operation: "update_property_financials",
    },
  })

  return nextProperty
}

function normalizePropertyCompliance(compliance: PropertyCompliance | undefined): PropertyCompliance | undefined {
  if (!compliance || typeof compliance !== "object") {
    return undefined
  }

  const type = compliance.type as ComplianceType

  return {
    id: typeof compliance.id === "string" && compliance.id.trim() ? compliance.id : randomUUID(),
    type,
    lastCheckedDate: typeof compliance.lastCheckedDate === "string" && compliance.lastCheckedDate.trim() 
      ? compliance.lastCheckedDate.trim() 
      : new Date().toISOString(),
    expirationDate: typeof compliance.expirationDate === "string" && compliance.expirationDate.trim() 
      ? compliance.expirationDate.trim() 
      : "",
    certificateNumber: typeof compliance.certificateNumber === "string" && compliance.certificateNumber.trim() 
      ? compliance.certificateNumber.trim() 
      : undefined,
    provider: typeof compliance.provider === "string" && compliance.provider.trim() 
      ? compliance.provider.trim() 
      : undefined,
    documentUrl: typeof compliance.documentUrl === "string" && compliance.documentUrl.trim() 
      ? compliance.documentUrl.trim() 
      : undefined,
    notes: typeof compliance.notes === "string" && compliance.notes.trim() 
      ? compliance.notes.trim() 
      : undefined,
  }
}

function normalizePropertyComplianceArray(compliance: PropertyCompliance[] | undefined): PropertyCompliance[] {
  if (!Array.isArray(compliance)) {
    return []
  }

  return compliance
    .map(normalizePropertyCompliance)
    .filter((c): c is PropertyCompliance => c !== undefined)
}

export async function addPropertyCompliance(
  user: AuthUser,
  propertyId: string,
  compliance: PropertyCompliance,
) {
  const property = await getPropertyById(propertyId)

  if (!property) {
    return null
  }

  if (!(await canAccessPropertyForUser(user, property)) || !canManageProperties(user)) {
    throw new Error("Forbidden")
  }

  const normalizedCompliance = normalizePropertyCompliance(compliance)
  if (!normalizedCompliance) {
    return null
  }

  const currentCompliance = normalizePropertyComplianceArray(property.compliance)
  const nextCompliance = [...currentCompliance, normalizedCompliance]

  const nextProperty: PropertyRecord = {
    ...property,
    compliance: nextCompliance,
    updatedAt: new Date().toISOString(),
  }

  const container = await getPropertiesContainer()
  await container.item(nextProperty.id, nextProperty.ownerId).replace(nextProperty)

  await writeAuditEvent({
    entityType: "property",
    entityId: nextProperty.id,
    action: AUDIT_ACTION_TYPES.EXECUTED_BY_SYSTEM,
    fieldPath: "compliance",
    oldValue: property.compliance,
    newValue: nextProperty.compliance,
    performedBy: user.email,
    metadata: {
      ...getPropertyAuditMetadata(nextProperty, user),
      operation: "add_property_compliance",
      complianceType: normalizedCompliance.type,
    },
  })

  return nextProperty
}

export async function updatePropertyCompliance(
  user: AuthUser,
  propertyId: string,
  complianceId: string,
  compliance: PropertyCompliance,
) {
  const property = await getPropertyById(propertyId)

  if (!property) {
    return null
  }

  if (!(await canAccessPropertyForUser(user, property)) || !canManageProperties(user)) {
    throw new Error("Forbidden")
  }

  const normalizedCompliance = normalizePropertyCompliance(compliance)
  if (!normalizedCompliance) {
    return null
  }

  normalizedCompliance.id = complianceId

  const currentCompliance = normalizePropertyComplianceArray(property.compliance)
  const nextCompliance = currentCompliance.map((c) => (c.id === complianceId ? normalizedCompliance : c))

  const nextProperty: PropertyRecord = {
    ...property,
    compliance: nextCompliance,
    updatedAt: new Date().toISOString(),
  }

  const container = await getPropertiesContainer()
  await container.item(nextProperty.id, nextProperty.ownerId).replace(nextProperty)

  await writeAuditEvent({
    entityType: "property",
    entityId: nextProperty.id,
    action: AUDIT_ACTION_TYPES.EXECUTED_BY_SYSTEM,
    fieldPath: "compliance",
    oldValue: property.compliance,
    newValue: nextProperty.compliance,
    performedBy: user.email,
    metadata: {
      ...getPropertyAuditMetadata(nextProperty, user),
      operation: "update_property_compliance",
      complianceType: normalizedCompliance.type,
      complianceId,
    },
  })

  return nextProperty
}

export async function removePropertyCompliance(
  user: AuthUser,
  propertyId: string,
  complianceId: string,
) {
  const property = await getPropertyById(propertyId)

  if (!property) {
    return null
  }

  if (!(await canAccessPropertyForUser(user, property)) || !canManageProperties(user)) {
    throw new Error("Forbidden")
  }

  const currentCompliance = normalizePropertyComplianceArray(property.compliance)
  const removedItem = currentCompliance.find((c) => c.id === complianceId)
  const nextCompliance = currentCompliance.filter((c) => c.id !== complianceId)

  const nextProperty: PropertyRecord = {
    ...property,
    compliance: nextCompliance,
    updatedAt: new Date().toISOString(),
  }

  const container = await getPropertiesContainer()
  await container.item(nextProperty.id, nextProperty.ownerId).replace(nextProperty)

  await writeAuditEvent({
    entityType: "property",
    entityId: nextProperty.id,
    action: AUDIT_ACTION_TYPES.EXECUTED_BY_SYSTEM,
    fieldPath: "compliance",
    oldValue: property.compliance,
    newValue: nextProperty.compliance,
    performedBy: user.email,
    metadata: {
      ...getPropertyAuditMetadata(nextProperty, user),
      operation: "remove_property_compliance",
      complianceType: removedItem?.type,
      complianceId,
    },
  })

  return nextProperty
}

export async function addPropertyImage(user: AuthUser, propertyId: string, image: PropertyRecord["images"][number]) {
  const property = await getPropertyById(propertyId)

  if (!property) {
    return null
  }

  if (!(await canAccessPropertyForUser(user, property)) || !canManageProperties(user)) {
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

  if (!(await canAccessPropertyForUser(user, property)) || !canManageProperties(user)) {
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