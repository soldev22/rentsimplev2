import "server-only"

import { createHash, randomUUID } from "node:crypto"
import { canManagePlatform } from "@/lib/auth"
import type { AuthUser } from "@/lib/types/user"
import {
  buildCrmContacts,
  normalizeCrmEmail,
  type CrmAccountFact,
  type CrmAuditEvent,
  type CrmContactInput,
  type CrmContactRecord,
  type CrmContactUpdate,
  type CrmMeetingFact,
} from "@/lib/crm"
import { getCrmContactsContainer, getMeetingRequestsContainer, getUsersContainer } from "@/lib/server/cosmos"
import { writeAuditEvent } from "@/lib/server/audit"

const ACCOUNT_EMAIL_CHUNK = 100

/** CRM access reuses the platform capability: approved Global admin or approved User only. */
export function canManageCrm(user: AuthUser | null): user is AuthUser {
  return canManagePlatform(user) && user?.approval_status === "approved"
}

function requireCrm(user: AuthUser | null): asserts user is AuthUser {
  if (!canManageCrm(user)) throw new Error("Forbidden")
}

/** Stable contact identity: a UUID-shaped SHA-256 of the normalized email, so duplicates collide on create. */
export function crmContactId(email: string) {
  const hex = createHash("sha256").update(`crm_contact:${normalizeCrmEmail(email)}`).digest("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

function cosmosCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error ? (error as { code: unknown }).code : undefined
}

async function listManualContacts() {
  const { resources } = await (await getCrmContactsContainer()).items.query<Omit<CrmContactRecord, "auditEvents">>({
    query: "SELECT c.id, c.type, c.email, c.firstName, c.lastName, c.phone, c.company, c.town, c.note, c.source, c.createdAt, c.createdBy, c.updatedAt, c.updatedBy FROM c WHERE c.type = @type",
    parameters: [{ name: "@type", value: "crm_contact" }],
  }).fetchAll()
  return resources
}

async function listMeetingFacts() {
  // Projection only: no notes, email threads, reply tokens or appointment details.
  const { resources } = await (await getMeetingRequestsContainer()).items.query<CrmMeetingFact>({
    query: "SELECT c.id, c.firstName, c.lastName, c.email, c.phone, c.town, c.status, c.createdAt, ARRAY(SELECT VALUE e.timestamp FROM e IN c.auditEvents WHERE e.fieldPath = @field AND e.newValue = @done) AS doneAt FROM c WHERE c.type = @type",
    parameters: [{ name: "@type", value: "meeting_request" }, { name: "@field", value: "status" }, { name: "@done", value: "done" }],
  }).fetchAll()
  return resources.map((meeting) => ({ ...meeting, doneAt: Array.isArray(meeting.doneAt) ? meeting.doneAt : [] }))
}

/** Exact normalized-email account matching with a narrow projection; never reads password or credential fields. */
async function listAccountFacts(emails: string[]) {
  const unique = [...new Set(emails.map(normalizeCrmEmail).filter(Boolean))]
  if (!unique.length) return []
  const container = await getUsersContainer()
  const accounts: CrmAccountFact[] = []
  for (let index = 0; index < unique.length; index += ACCOUNT_EMAIL_CHUNK) {
    const { resources } = await container.items.query<CrmAccountFact>({
      query: "SELECT c.id, c.email, c.role, c.approval_status, c.createdAt FROM c WHERE ARRAY_CONTAINS(@emails, c.email)",
      parameters: [{ name: "@emails", value: unique.slice(index, index + ACCOUNT_EMAIL_CHUNK) }],
    }).fetchAll()
    accounts.push(...resources.filter((account) => typeof account.email === "string" && unique.includes(normalizeCrmEmail(account.email))))
  }
  return accounts
}

export async function listCrmContacts(user: AuthUser | null) {
  requireCrm(user)
  const [contacts, meetings] = await Promise.all([listManualContacts(), listMeetingFacts()])
  const accounts = await listAccountFacts([...contacts.map((contact) => contact.email), ...meetings.map((meeting) => meeting.email)])
  return buildCrmContacts({ contacts, meetings, accounts })
}

async function readContact(id: string) {
  try {
    const { resource } = await (await getCrmContactsContainer()).item(id, id).read<CrmContactRecord & { _etag?: string }>()
    return resource?.type === "crm_contact" ? resource : null
  } catch (error) {
    if (cosmosCode(error) === 404) return null
    throw error
  }
}

async function mirrorAudit(events: CrmAuditEvent[], id: string) {
  try {
    await Promise.all(events.map((event) => writeAuditEvent(event)))
    return undefined
  } catch (error) {
    console.error("CRM contact audit mirror failed.", { contactId: id, errorName: error instanceof Error ? error.name : "UnknownError" })
    return "Saved with an audit entry on the contact, but the platform audit log could not be updated."
  }
}

export async function createCrmContact(user: AuthUser | null, input: CrmContactInput) {
  requireCrm(user)
  const email = normalizeCrmEmail(input.email)
  const id = crmContactId(email)
  const existing = await readContact(id)
  if (existing) return { kind: "duplicate" as const, id }
  const now = new Date().toISOString()
  const event: CrmAuditEvent = {
    id: randomUUID(), entityType: "crm_contact", entityId: id, entityKey: `crm_contact:${id}`,
    action: "created", performedBy: user.email, timestamp: now,
  }
  const record: CrmContactRecord = {
    id, type: "crm_contact", email, firstName: input.firstName, lastName: input.lastName, phone: input.phone,
    company: input.company, town: input.town, note: input.note, source: "manual",
    createdAt: now, createdBy: user.email, updatedAt: now, updatedBy: user.email, auditEvents: [event],
  }
  try {
    await (await getCrmContactsContainer()).items.create(record)
  } catch (error) {
    if (cosmosCode(error) === 409) return { kind: "duplicate" as const, id }
    throw error
  }
  return { kind: "created" as const, contact: record, warning: await mirrorAudit([event], id) }
}

const EDITABLE_FIELDS = ["firstName", "lastName", "phone", "company", "town", "note"] as const

export async function updateCrmContact(user: AuthUser | null, id: string, input: CrmContactUpdate) {
  requireCrm(user)
  const current = await readContact(id)
  if (!current) return { kind: "not_found" as const }
  if (current.updatedAt !== input.expectedUpdatedAt) return { kind: "conflict" as const }
  const changed = EDITABLE_FIELDS.filter((field) => (current[field] ?? "") !== input[field])
  if (!changed.length) return { kind: "unchanged" as const, contact: current }
  const now = new Date(Math.max(Date.now(), Date.parse(current.updatedAt) + 1)).toISOString()
  const events: CrmAuditEvent[] = changed.map((field) => ({
    id: randomUUID(), entityType: "crm_contact", entityId: id, entityKey: `crm_contact:${id}`,
    action: "field_changed", fieldPath: field, oldValue: current[field] ?? "", newValue: input[field],
    performedBy: user.email, timestamp: now,
  }))
  const { _etag: etag, ...stored } = current
  const record: CrmContactRecord = {
    ...stored,
    firstName: input.firstName, lastName: input.lastName, phone: input.phone, company: input.company,
    town: input.town, note: input.note, updatedAt: now, updatedBy: user.email,
    auditEvents: [...(current.auditEvents ?? []), ...events],
  }
  if (!etag) throw new Error("CRM contact version is missing.")
  try {
    await (await getCrmContactsContainer()).item(id, id).replace(record, { accessCondition: { type: "IfMatch", condition: etag } })
  } catch (error) {
    if (cosmosCode(error) === 412) return { kind: "conflict" as const }
    throw error
  }
  return { kind: "updated" as const, contact: record, warning: await mirrorAudit(events, id) }
}
