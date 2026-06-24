import "server-only"

import { randomUUID } from "node:crypto"

import {
  canAccessMaintenance,
  getDisplayName,
  getUserRole,
  type AuthUser,
  type MaintenanceAccreditationChecklist,
  type MaintenanceBuilderBid,
  type MaintenanceIssueCategory,
  type MaintenanceIssueRecord,
  type MaintenanceIssueStatus,
  type MaintenancePriority,
  type PropertyRecord,
} from "@/lib/auth"
import { getApplicationsContainer, getMaintenanceContainer, getPropertiesContainer } from "@/lib/server/cosmos"
import {
  buildPaginatedResult,
  fetchQueryPageWithContinuation,
  normalizePageOptions,
  type PageOptions,
} from "@/lib/server/pagination"
import { listPropertiesForUser } from "@/lib/server/properties"

type CreateMaintenanceIssueInput = {
  propertyId: string
  title: string
  description: string
  category: MaintenanceIssueCategory
  priority: MaintenancePriority
  responseDueAt?: string
  resolutionDueAt?: string
}

type UpdateMaintenanceIssueInput = Partial<{
  priority: MaintenancePriority
  status: MaintenanceIssueStatus
  responseDueAt: string
  resolutionDueAt: string
  biddingClosesAt: string
  selectedBuilderId: string
  selectedBuilderName: string
  selectedBuilderEmail: string
  accreditationChecklist: Partial<MaintenanceAccreditationChecklist>
}>

type CreateMaintenanceBidInput = {
  amount: number
  availabilityDate: string
  estimatedDurationDays: number
  notes: string
}

function assertMaintenanceUser(user: AuthUser) {
  if (!canAccessMaintenance(user)) {
    throw new Error("Forbidden")
  }
}

function createDefaultAccreditationChecklist(): MaintenanceAccreditationChecklist {
  return {
    insuranceChecked: false,
    insuranceCheckedAt: undefined,
    gasSafeChecked: false,
    gasSafeCheckedAt: undefined,
    electricalCertificationChecked: false,
    electricalCertificationCheckedAt: undefined,
    dbsChecked: false,
    dbsCheckedAt: undefined,
    methodStatementReceived: false,
    methodStatementReceivedAt: undefined,
    targetStartDate: "",
    targetCompletionDate: "",
    checkedByName: "",
    checkedAt: undefined,
    notes: "",
  }
}

function normalizeText(value: string | undefined) {
  return typeof value === "string" ? value.trim() : ""
}

function toNonNegativeNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

function normalizeIssueInput(input: CreateMaintenanceIssueInput) {
  return {
    propertyId: normalizeText(input.propertyId),
    title: normalizeText(input.title),
    description: normalizeText(input.description),
    category: input.category,
    priority: input.priority,
    responseDueAt: normalizeText(input.responseDueAt),
    resolutionDueAt: normalizeText(input.resolutionDueAt),
  }
}

async function getIssueById(id: string) {
  const container = await getMaintenanceContainer()
  const { resources } = await container.items
    .query<MaintenanceIssueRecord>({
      query: "SELECT * FROM c WHERE c.id = @id",
      parameters: [{ name: "@id", value: id }],
    })
    .fetchAll()

  return resources[0] ?? null
}

async function listActiveTenantPropertyIds(user: AuthUser) {
  const container = await getApplicationsContainer()
  const { resources } = await container.items
    .query<{ propertyId: string }>({
      query: "SELECT c.propertyId FROM c WHERE c.applicantId = @applicantId AND c.status = @status",
      parameters: [
        { name: "@applicantId", value: user.id },
        { name: "@status", value: "active_tenant" },
      ],
    })
    .fetchAll()

  return new Set(resources.map((resource) => resource.propertyId))
}

async function listPropertiesByIds(propertyIds: Set<string>) {
  if (propertyIds.size === 0) {
    return [] as PropertyRecord[]
  }

  const container = await getPropertiesContainer()
  const parameters = [...propertyIds].map((propertyId, index) => ({ name: `@id${index}`, value: propertyId }))
  const inClause = parameters.map((parameter) => parameter.name).join(", ")
  const { resources } = await container.items
    .query<PropertyRecord>({
      query: `SELECT * FROM c WHERE c.id IN (${inClause})`,
      parameters,
    })
    .fetchAll()

  return resources
}

async function getAccessiblePropertyIds(user: AuthUser) {
  const role = getUserRole(user)

  if (role === "tenant") {
    return listActiveTenantPropertyIds(user)
  }

  if (role === "builder") {
    return null
  }

  const properties = await listPropertiesForUser(user)
  return new Set(properties.map((property) => property.id))
}

function syncChecklistTimestamp(
  existingChecklist: MaintenanceAccreditationChecklist,
  nextChecklist: MaintenanceAccreditationChecklist,
  key:
    | "insuranceChecked"
    | "gasSafeChecked"
    | "electricalCertificationChecked"
    | "dbsChecked"
    | "methodStatementReceived",
  timestampKey:
    | "insuranceCheckedAt"
    | "gasSafeCheckedAt"
    | "electricalCertificationCheckedAt"
    | "dbsCheckedAt"
    | "methodStatementReceivedAt",
  now: string,
) {
  const nextValue = Boolean(nextChecklist[key])
  const existingValue = Boolean(existingChecklist[key])

  if (nextValue && !existingValue) {
    nextChecklist[timestampKey] = nextChecklist[timestampKey] || now
  }

  if (!nextValue) {
    nextChecklist[timestampKey] = undefined
  }
}

function syncAccreditationChecklist(
  existingChecklist: MaintenanceAccreditationChecklist,
  inputChecklist: Partial<MaintenanceAccreditationChecklist> | undefined,
  checkerName: string,
  now: string,
) {
  const nextChecklist: MaintenanceAccreditationChecklist = {
    ...existingChecklist,
    ...(inputChecklist ?? {}),
    targetStartDate: normalizeText(inputChecklist?.targetStartDate ?? existingChecklist.targetStartDate),
    targetCompletionDate: normalizeText(inputChecklist?.targetCompletionDate ?? existingChecklist.targetCompletionDate),
    checkedByName: normalizeText(inputChecklist?.checkedByName ?? existingChecklist.checkedByName) || checkerName,
    notes: normalizeText(inputChecklist?.notes ?? existingChecklist.notes),
  }

  syncChecklistTimestamp(existingChecklist, nextChecklist, "insuranceChecked", "insuranceCheckedAt", now)
  syncChecklistTimestamp(existingChecklist, nextChecklist, "gasSafeChecked", "gasSafeCheckedAt", now)
  syncChecklistTimestamp(existingChecklist, nextChecklist, "electricalCertificationChecked", "electricalCertificationCheckedAt", now)
  syncChecklistTimestamp(existingChecklist, nextChecklist, "dbsChecked", "dbsCheckedAt", now)
  syncChecklistTimestamp(existingChecklist, nextChecklist, "methodStatementReceived", "methodStatementReceivedAt", now)

  if (inputChecklist) {
    nextChecklist.checkedAt = now
  }

  return nextChecklist
}

export async function listMaintenanceIssuesForUser(user: AuthUser) {
  const paged = await listMaintenanceIssuesForUserPage(user, { page: 1, pageSize: 1000 })
  return paged.items
}

export async function listMaintenanceIssuesForUserPage(user: AuthUser, options?: PageOptions) {
  assertMaintenanceUser(user)

  const role = getUserRole(user)
  const container = await getMaintenanceContainer()
  const { page, pageSize, offset } = normalizePageOptions(options, { defaultPageSize: 25, maxPageSize: 100 })

  const runPagedQuery = async (whereClause: string, parameters: Array<{ name: string; value: string }>) => {
    const countQuery = `SELECT VALUE COUNT(1) FROM c${whereClause}`
    const dataQuery = `SELECT * FROM c${whereClause} ORDER BY c.reportedAt DESC OFFSET ${offset} LIMIT ${pageSize}`
    const [{ resources: countRows }, { resources }] = await Promise.all([
      container.items.query<number>({ query: countQuery, parameters }).fetchAll(),
      container.items.query<MaintenanceIssueRecord>({ query: dataQuery, parameters }).fetchAll(),
    ])

    const items = resources.sort((left, right) => Date.parse(right.reportedAt) - Date.parse(left.reportedAt))
    return buildPaginatedResult(items, countRows[0] ?? 0, page, pageSize)
  }

  if (role === "builder") {
    return runPagedQuery(
      " WHERE c.status = @biddingOpen OR c.selectedBuilderId = @builderId OR ARRAY_CONTAINS(c.bids, {\"builderId\": @builderId}, true)",
      [
        { name: "@biddingOpen", value: "bidding_open" },
        { name: "@builderId", value: user.id },
      ],
    )
  }

  if (role === "tenant") {
    const accessiblePropertyIds = await listActiveTenantPropertyIds(user)

    if (accessiblePropertyIds.size === 0) {
      return buildPaginatedResult([] as MaintenanceIssueRecord[], 0, page, pageSize)
    }

    const parameters = [...accessiblePropertyIds].map((propertyId, index) => ({ name: `@propertyId${index}`, value: propertyId }))
    const inClause = parameters.map((parameter) => parameter.name).join(", ")
    return runPagedQuery(` WHERE c.tenantId = @tenantId AND c.propertyId IN (${inClause})`, [
      { name: "@tenantId", value: user.id },
      ...parameters,
    ])
  }

  const accessiblePropertyIds = await getAccessiblePropertyIds(user)

  if (!accessiblePropertyIds) {
    return buildPaginatedResult([] as MaintenanceIssueRecord[], 0, page, pageSize)
  }

  const propertyIds = [...accessiblePropertyIds]

  if (propertyIds.length === 0) {
    return buildPaginatedResult([] as MaintenanceIssueRecord[], 0, page, pageSize)
  }

  const parameters = propertyIds.map((propertyId, index) => ({ name: `@propertyId${index}`, value: propertyId }))
  const inClause = parameters.map((parameter) => parameter.name).join(", ")
  return runPagedQuery(` WHERE c.propertyId IN (${inClause})`, parameters)
}

export async function listMaintenanceIssuesForUserByContinuation(
  user: AuthUser,
  options?: {
    continuationToken?: string
    maxItemCount?: number
  },
) {
  assertMaintenanceUser(user)

  const role = getUserRole(user)
  const container = await getMaintenanceContainer()
  const maxItemCount = Math.max(1, Math.min(options?.maxItemCount ?? 50, 200))

  const runContinuationQuery = async (whereClause: string, parameters: Array<{ name: string; value: string }>) => {
    const query = `SELECT * FROM c${whereClause} ORDER BY c.reportedAt DESC`
    const page = await fetchQueryPageWithContinuation<MaintenanceIssueRecord>(
      container,
      {
        query,
        parameters,
      },
      {
        continuationToken: options?.continuationToken,
        maxItemCount,
      },
    )

    return {
      items: page.items.sort((left, right) => Date.parse(right.reportedAt) - Date.parse(left.reportedAt)),
      continuationToken: page.continuationToken,
      maxItemCount: page.maxItemCount,
    }
  }

  if (role === "builder") {
    return runContinuationQuery(
      " WHERE c.status = @biddingOpen OR c.selectedBuilderId = @builderId OR ARRAY_CONTAINS(c.bids, {\"builderId\": @builderId}, true)",
      [
        { name: "@biddingOpen", value: "bidding_open" },
        { name: "@builderId", value: user.id },
      ],
    )
  }

  if (role === "tenant") {
    const accessiblePropertyIds = await listActiveTenantPropertyIds(user)

    if (accessiblePropertyIds.size === 0) {
      return {
        items: [] as MaintenanceIssueRecord[],
        continuationToken: undefined,
        maxItemCount,
      }
    }

    const parameters = [...accessiblePropertyIds].map((propertyId, index) => ({ name: `@propertyId${index}`, value: propertyId }))
    const inClause = parameters.map((parameter) => parameter.name).join(", ")
    return runContinuationQuery(` WHERE c.tenantId = @tenantId AND c.propertyId IN (${inClause})`, [
      { name: "@tenantId", value: user.id },
      ...parameters,
    ])
  }

  const accessiblePropertyIds = await getAccessiblePropertyIds(user)

  if (!accessiblePropertyIds) {
    return {
      items: [] as MaintenanceIssueRecord[],
      continuationToken: undefined,
      maxItemCount,
    }
  }

  const propertyIds = [...accessiblePropertyIds]

  if (propertyIds.length === 0) {
    return {
      items: [] as MaintenanceIssueRecord[],
      continuationToken: undefined,
      maxItemCount,
    }
  }

  const parameters = propertyIds.map((propertyId, index) => ({ name: `@propertyId${index}`, value: propertyId }))
  const inClause = parameters.map((parameter) => parameter.name).join(", ")
  return runContinuationQuery(` WHERE c.propertyId IN (${inClause})`, parameters)
}

export async function listReportableTenantProperties(user: AuthUser) {
  if (getUserRole(user) !== "tenant") {
    throw new Error("Forbidden")
  }

  const propertyIds = await listActiveTenantPropertyIds(user)
  const properties = await listPropertiesByIds(propertyIds)
  return properties
    .map((property) => ({ id: property.id, address: property.address }))
    .sort((left, right) => left.address.localeCompare(right.address))
}

export async function createMaintenanceIssue(user: AuthUser, input: CreateMaintenanceIssueInput) {
  if (getUserRole(user) !== "tenant") {
    throw new Error("Forbidden")
  }

  const normalized = normalizeIssueInput(input)

  if (!normalized.propertyId || !normalized.title || !normalized.description) {
    throw new Error("MaintenanceIssueValidationError")
  }

  const accessiblePropertyIds = await listActiveTenantPropertyIds(user)

  if (!accessiblePropertyIds.has(normalized.propertyId)) {
    throw new Error("Forbidden")
  }

  const properties = await listPropertiesByIds(accessiblePropertyIds)
  const property = properties.find((candidate) => candidate.id === normalized.propertyId)

  if (!property) {
    throw new Error("Forbidden")
  }

  const now = new Date().toISOString()
  const issue: MaintenanceIssueRecord = {
    id: randomUUID(),
    propertyId: property.id,
    propertyAddress: property.address,
    tenantId: user.id,
    tenantEmail: user.email,
    tenantName: getDisplayName(user),
    title: normalized.title,
    description: normalized.description,
    category: normalized.category,
    priority: normalized.priority,
    status: "reported",
    reportedAt: now,
    responseDueAt: normalized.responseDueAt || undefined,
    resolutionDueAt: normalized.resolutionDueAt || undefined,
    biddingClosesAt: undefined,
    selectedBuilderId: undefined,
    selectedBuilderName: undefined,
    selectedBuilderEmail: undefined,
    accreditationChecklist: createDefaultAccreditationChecklist(),
    bids: [],
    createdAt: now,
    updatedAt: now,
  }

  const container = await getMaintenanceContainer()
  await container.items.create(issue)
  return issue
}

export async function addMaintenanceBid(user: AuthUser, issueId: string, input: CreateMaintenanceBidInput) {
  if (getUserRole(user) !== "builder") {
    throw new Error("Forbidden")
  }

  const issue = await getIssueById(issueId)

  if (!issue) {
    return null
  }

  if (issue.status !== "bidding_open") {
    throw new Error("BiddingClosed")
  }

  const existingBid = issue.bids.find((bid) => bid.builderId === user.id)
  const now = new Date().toISOString()
  const nextBid: MaintenanceBuilderBid = {
    id: existingBid?.id ?? randomUUID(),
    builderId: user.id,
    builderEmail: user.email,
    builderName: getDisplayName(user),
    amount: toNonNegativeNumber(input.amount),
    availabilityDate: normalizeText(input.availabilityDate),
    estimatedDurationDays: Math.max(1, Math.round(toNonNegativeNumber(input.estimatedDurationDays) || 1)),
    notes: normalizeText(input.notes),
    status: existingBid?.status ?? "submitted",
    createdAt: existingBid?.createdAt ?? now,
    updatedAt: now,
  }

  const nextIssue: MaintenanceIssueRecord = {
    ...issue,
    bids: [...issue.bids.filter((bid) => bid.builderId !== user.id), nextBid],
    updatedAt: now,
  }

  const container = await getMaintenanceContainer()
  await container.item(nextIssue.id, nextIssue.propertyId).replace(nextIssue)
  return nextIssue
}

export async function updateMaintenanceIssue(user: AuthUser, issueId: string, input: UpdateMaintenanceIssueInput) {
  const role = getUserRole(user)

  if (role !== "admin" && role !== "agent" && role !== "landlord") {
    throw new Error("Forbidden")
  }

  const issue = await getIssueById(issueId)

  if (!issue) {
    return null
  }

  const accessiblePropertyIds = await getAccessiblePropertyIds(user)

  if (!accessiblePropertyIds) {
    throw new Error("Forbidden")
  }

  if (!accessiblePropertyIds.has(issue.propertyId)) {
    throw new Error("Forbidden")
  }

  const now = new Date().toISOString()
  const nextIssue: MaintenanceIssueRecord = {
    ...issue,
    priority: input.priority ?? issue.priority,
    status: input.status ?? issue.status,
    responseDueAt: normalizeText(input.responseDueAt ?? issue.responseDueAt) || undefined,
    resolutionDueAt: normalizeText(input.resolutionDueAt ?? issue.resolutionDueAt) || undefined,
    biddingClosesAt: normalizeText(input.biddingClosesAt ?? issue.biddingClosesAt) || undefined,
    selectedBuilderId: normalizeText(input.selectedBuilderId ?? issue.selectedBuilderId) || undefined,
    selectedBuilderName: normalizeText(input.selectedBuilderName ?? issue.selectedBuilderName) || undefined,
    selectedBuilderEmail: normalizeText(input.selectedBuilderEmail ?? issue.selectedBuilderEmail) || undefined,
    accreditationChecklist: syncAccreditationChecklist(issue.accreditationChecklist, input.accreditationChecklist, getDisplayName(user), now),
    bids: issue.bids.map((bid) => {
      if (input.selectedBuilderId && bid.builderId === input.selectedBuilderId) {
        return { ...bid, status: "accepted", updatedAt: now }
      }

      if (input.selectedBuilderId && bid.status === "accepted") {
        return { ...bid, status: "declined", updatedAt: now }
      }

      return bid
    }),
    updatedAt: now,
  }

  const selectedBid = nextIssue.selectedBuilderId
    ? nextIssue.bids.find((bid) => bid.builderId === nextIssue.selectedBuilderId)
    : undefined

  if (selectedBid) {
    nextIssue.selectedBuilderName = selectedBid.builderName
    nextIssue.selectedBuilderEmail = selectedBid.builderEmail
  }

  const container = await getMaintenanceContainer()
  await container.item(nextIssue.id, nextIssue.propertyId).replace(nextIssue)
  return nextIssue
}