import "server-only"

import { randomUUID } from "node:crypto"

import type { AuditEventRecord, AuditValue } from "@/lib/types/audit"
import { getAuditEventsContainer } from "@/lib/server/cosmos"

type WriteAuditEventInput = {
  entityType: string
  entityId: string
  action: string
  performedBy: string
  fieldPath?: string
  oldValue?: unknown
  newValue?: unknown
  metadata?: Record<string, unknown>
  timestamp?: string
}

function normalizeAuditValue(value: unknown): AuditValue | undefined {
  if (value === undefined) {
    return undefined
  }

  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value
  }

  return JSON.parse(JSON.stringify(value)) as AuditValue
}

export async function writeAuditEvent(input: WriteAuditEventInput) {
  const timestamp = input.timestamp ?? new Date().toISOString()
  const event: AuditEventRecord = {
    id: randomUUID(),
    entityType: input.entityType,
    entityId: input.entityId,
    entityKey: `${input.entityType}:${input.entityId}`,
    action: input.action,
    fieldPath: input.fieldPath,
    oldValue: normalizeAuditValue(input.oldValue),
    newValue: normalizeAuditValue(input.newValue),
    performedBy: input.performedBy,
    timestamp,
    metadata: input.metadata,
  }

  const container = await getAuditEventsContainer()
  await container.items.create(event)
  return event
}

export async function writeAuditEvents(inputs: WriteAuditEventInput[]) {
  return Promise.all(inputs.map((input) => writeAuditEvent(input)))
}

export async function listAuditEventsForEntity(entityType: string, entityId: string) {
  const container = await getAuditEventsContainer()
  const entityKey = `${entityType}:${entityId}`
  const { resources } = await container.items
    .query<AuditEventRecord>({
      query: "SELECT * FROM c WHERE c.entityKey = @entityKey ORDER BY c.timestamp DESC",
      parameters: [{ name: "@entityKey", value: entityKey }],
    })
    .fetchAll()

  return resources
}

export async function listAuditEventsForEntities(entityType: string, entityIds: string[]) {
  if (entityIds.length === 0) {
    return new Map<string, AuditEventRecord[]>()
  }

  const container = await getAuditEventsContainer()
  const entityKeys = entityIds.map((entityId) => `${entityType}:${entityId}`)
  const { resources } = await container.items
    .query<AuditEventRecord>({
      query: "SELECT * FROM c WHERE ARRAY_CONTAINS(@entityKeys, c.entityKey) ORDER BY c.timestamp DESC",
      parameters: [{ name: "@entityKeys", value: entityKeys }],
    })
    .fetchAll()

  return resources.reduce((groups, event) => {
    const current = groups.get(event.entityId) ?? []
    current.push(event)
    groups.set(event.entityId, current)
    return groups
  }, new Map<string, AuditEventRecord[]>())
}

export async function listRecentAuditEvents(options?: { limit?: number; entityType?: string }) {
  const container = await getAuditEventsContainer()
  const limit = Math.max(1, Math.min(options?.limit ?? 200, 500))
  const entityType = typeof options?.entityType === "string" ? options.entityType.trim() : ""
  const { resources } = entityType
    ? await container.items
        .query<AuditEventRecord>({
          query: "SELECT TOP @limit * FROM c WHERE c.entityType = @entityType ORDER BY c.timestamp DESC",
          parameters: [
            { name: "@limit", value: limit },
            { name: "@entityType", value: entityType },
          ],
        })
        .fetchAll()
    : await container.items
        .query<AuditEventRecord>({
          query: "SELECT TOP @limit * FROM c ORDER BY c.timestamp DESC",
          parameters: [{ name: "@limit", value: limit }],
        })
        .fetchAll()

  return resources
}

export type AuditEventFilters = {
  entityType?: string
  action?: string
  performedBy?: string
}

function normalizeAuditFilterValue(value: string | undefined) {
  if (typeof value !== "string") {
    return ""
  }

  return value.trim()
}

function buildFilteredAuditQuery(filters: AuditEventFilters) {
  const clauses: string[] = []
  const parameters: Array<{ name: string; value: string }> = []

  const entityType = normalizeAuditFilterValue(filters.entityType)
  const action = normalizeAuditFilterValue(filters.action)
  const performedBy = normalizeAuditFilterValue(filters.performedBy).toLowerCase()

  if (entityType) {
    clauses.push("c.entityType = @entityType")
    parameters.push({ name: "@entityType", value: entityType })
  }

  if (action) {
    clauses.push("c.action = @action")
    parameters.push({ name: "@action", value: action })
  }

  if (performedBy) {
    clauses.push("LOWER(c.performedBy) = @performedBy")
    parameters.push({ name: "@performedBy", value: performedBy })
  }

  const whereClause = clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : ""
  return { whereClause, parameters }
}

export async function listAuditEventsPage(options?: {
  page?: number
  pageSize?: number
  filters?: AuditEventFilters
}) {
  const container = await getAuditEventsContainer()
  const pageSize = Math.max(10, Math.min(options?.pageSize ?? 50, 100))
  const page = Math.max(1, Math.floor(options?.page ?? 1))
  const offset = (page - 1) * pageSize
  const { whereClause, parameters } = buildFilteredAuditQuery(options?.filters ?? {})
  const countQuery = `SELECT VALUE COUNT(1) FROM c${whereClause}`
  const pageQuery = `SELECT * FROM c${whereClause} ORDER BY c.timestamp DESC OFFSET ${offset} LIMIT ${pageSize}`

  const [{ resources: countRows }, { resources: events }] = await Promise.all([
    container.items.query<number>({ query: countQuery, parameters }).fetchAll(),
    container.items.query<AuditEventRecord>({ query: pageQuery, parameters }).fetchAll(),
  ])

  const totalCount = typeof countRows[0] === "number" ? countRows[0] : 0
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  return {
    events,
    page,
    pageSize,
    totalCount,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  }
}

export async function listAuditFilterSuggestions(options?: { sampleSize?: number; maxPerGroup?: number }) {
  const sampleSize = Math.max(100, Math.min(options?.sampleSize ?? 1000, 5000))
  const maxPerGroup = Math.max(5, Math.min(options?.maxPerGroup ?? 30, 200))
  const recentEvents = await listRecentAuditEvents({ limit: sampleSize })

  const entityTypes = [...new Set(recentEvents.map((event) => event.entityType).filter(Boolean))].slice(0, maxPerGroup)
  const actions = [...new Set(recentEvents.map((event) => event.action).filter(Boolean))].slice(0, maxPerGroup)
  const performedBy = [...new Set(recentEvents.map((event) => event.performedBy).filter(Boolean))].slice(0, maxPerGroup)

  return {
    entityTypes,
    actions,
    performedBy,
  }
}