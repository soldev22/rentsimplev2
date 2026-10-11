import "server-only"

import { randomBytes, randomUUID } from "node:crypto"
import type { AuthUser } from "@/lib/types/user"
import type { AuditEventRecord } from "@/lib/types/audit"
import type { MeetingRequestInput, MeetingRequest, MeetingRequestUpdate } from "@/lib/meeting-requests"
import { getMeetingRequestsContainer } from "@/lib/server/cosmos"
import { writeAuditEvent } from "@/lib/server/audit"

export function canManageMeetingRequests(user: AuthUser | null): user is AuthUser {
  return user?.role === "admin" && user.approval_status === "approved"
}

function requireAdmin(user: AuthUser) {
  if (!canManageMeetingRequests(user)) throw new Error("Forbidden")
}

export async function createMeetingRequest(input: MeetingRequestInput) {
  const now = new Date().toISOString()
  const record: MeetingRequest = {
    ...input, id: randomUUID(), type: "meeting_request", status: "new",
    createdAt: now, updatedAt: now, adminNotes: [], auditEvents: [],
    emailReplyToken: randomBytes(12).toString("hex"), emailMessages: [],
  }
  await (await getMeetingRequestsContainer()).items.create(record)
  return record
}

export async function listMeetingRequests(user: AuthUser, page = 1) {
  requireAdmin(user)
  const container = await getMeetingRequestsContainer()
  const pageSize = 50
  const offset = (Math.max(1, Math.floor(page)) - 1) * pageSize
  const parameters = [{ name: "@type", value: "meeting_request" }]
  const [{ resources: requests }, { resources: counts }] = await Promise.all([
    container.items.query<MeetingRequest>({
      query: `SELECT * FROM c WHERE c.type = @type ORDER BY c.createdAt DESC OFFSET ${offset} LIMIT ${pageSize}`,
      parameters,
    }).fetchAll(),
    container.items.query<number>({
      query: "SELECT VALUE COUNT(1) FROM c WHERE c.type = @type", parameters,
    }).fetchAll(),
  ])
  return { requests, totalPages: Math.max(1, Math.ceil((counts[0] ?? 0) / pageSize)) }
}

export async function updateMeetingRequest(user: AuthUser, id: string, input: MeetingRequestUpdate) {
  requireAdmin(user)
  const container = await getMeetingRequestsContainer()
  const item = container.item(id, id)
  const { resource: current } = await item.read<MeetingRequest>()
  if (!current || current.type !== "meeting_request") return { kind: "not_found" as const }
  if (current.updatedAt !== input.expectedUpdatedAt) return { kind: "conflict" as const }
  const statusChanged = current.status !== input.status
  if (!statusChanged && !input.note) return { kind: "unchanged" as const }
  const now = new Date(Math.max(Date.now(), Date.parse(current.updatedAt) + 1)).toISOString()
  const event: AuditEventRecord | undefined = statusChanged ? {
    id: randomUUID(), entityType: "meeting_request", entityId: id, entityKey: `meeting_request:${id}`,
    action: "status_changed", fieldPath: "status", oldValue: current.status, newValue: input.status,
    performedBy: user.email, timestamp: now,
  } : undefined
  const record: MeetingRequest = {
    ...current, status: input.status, updatedAt: now,
    adminNotes: input.note ? [...current.adminNotes, { text: input.note, performedBy: user.email, createdAt: now }] : current.adminNotes,
    // The audit and status are saved together, even if the platform audit mirror is unavailable.
    auditEvents: event ? [...current.auditEvents, event] : current.auditEvents,
  }
  if (!current._etag) throw new Error("Meeting request version is missing.")
  await item.replace(record, { accessCondition: { type: "IfMatch", condition: current._etag } })
  let warning: string | undefined
  if (event) {
    try {
      await writeAuditEvent(event)
    } catch (error) {
      console.error("Meeting request audit mirror failed.", { requestId: id, errorName: error instanceof Error ? error.name : "UnknownError" })
      warning = "Saved with an audit entry on the request, but the platform audit log could not be updated."
    }
  }
  return { kind: "updated" as const, request: record, warning }
}

export async function deleteMeetingRequest(user: AuthUser, id: string, expectedUpdatedAt: string) {
  requireAdmin(user)
  const item = (await getMeetingRequestsContainer()).item(id, id)
  const { resource: current } = await item.read<MeetingRequest>()
  if (!current || current.type !== "meeting_request") return { kind: "not_found" as const }
  if (current.updatedAt !== expectedUpdatedAt) return { kind: "conflict" as const }
  if (!current._etag) throw new Error("Meeting request version is missing.")
  await item.delete({ accessCondition: { type: "IfMatch", condition: current._etag } })
  return { kind: "deleted" as const }
}
