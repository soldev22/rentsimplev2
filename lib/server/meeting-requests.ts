import "server-only"

import { randomBytes, randomUUID } from "node:crypto"
import type { AuthUser } from "@/lib/types/user"
import type { AuditEventRecord } from "@/lib/types/audit"
import type { MeetingRequestInput, MeetingRequest, MeetingRequestUpdate } from "@/lib/meeting-requests"
import { getMeetingRequestsContainer } from "@/lib/server/cosmos"
import { writeAuditEvent } from "@/lib/server/audit"
import { diaryRange, type DiaryEntry, type DiaryView } from "@/lib/diary"

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

export async function getMeetingRequest(user: AuthUser, id: string) {
  requireAdmin(user)
  try {
    const { resource } = await (await getMeetingRequestsContainer()).item(id, id).read<MeetingRequest>()
    return resource?.type === "meeting_request" ? resource : null
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 404) return null
    throw error
  }
}

export async function listDiaryEntries(user: AuthUser, date: string, view: DiaryView) {
  requireAdmin(user)
  const { startAt, endAt } = diaryRange(date, view)
  const container = await getMeetingRequestsContainer()
  const [{ resources: entries }, { resources: counts }] = await Promise.all([
    container.items.query<DiaryEntry>({
      query: "SELECT c.id, c.firstName, c.lastName, c.meetingType, c.status, c.appointment FROM c WHERE c.type = @type AND (c.status = @confirmed OR c.status = @done) AND c.appointment.startAt < @end AND c.appointment.endAt > @start ORDER BY c.appointment.startAt ASC",
      parameters: [
        { name: "@type", value: "meeting_request" }, { name: "@confirmed", value: "confirmed" },
        { name: "@done", value: "done" }, { name: "@start", value: startAt }, { name: "@end", value: endAt },
      ],
    }).fetchAll(),
    container.items.query<number>({
      query: "SELECT VALUE COUNT(1) FROM c WHERE c.type = @type AND c.status = @status AND (NOT IS_DEFINED(c.appointment) OR IS_NULL(c.appointment))",
      parameters: [{ name: "@type", value: "meeting_request" }, { name: "@status", value: "confirmed" }],
    }).fetchAll(),
  ])
  return { entries, unscheduledCount: counts[0] ?? 0 }
}

export async function updateMeetingRequest(user: AuthUser, id: string, input: MeetingRequestUpdate) {
  requireAdmin(user)
  const container = await getMeetingRequestsContainer()
  const item = container.item(id, id)
  const { resource: current } = await item.read<MeetingRequest>()
  if (!current || current.type !== "meeting_request") return { kind: "not_found" as const }
  if (current.updatedAt !== input.expectedUpdatedAt) return { kind: "conflict" as const }
  const appointment = input.appointment ?? current.appointment
  if (input.status === "confirmed" && !appointment) {
    return { kind: "invalid" as const, error: "Set a meeting date and start/end times before confirming." }
  }
  const appointmentChanged = Boolean(input.appointment) && JSON.stringify(current.appointment) !== JSON.stringify(appointment)
  const statusChanged = current.status !== input.status
  if (!statusChanged && !input.note && !appointmentChanged) return { kind: "unchanged" as const }
  const now = new Date(Math.max(Date.now(), Date.parse(current.updatedAt) + 1)).toISOString()
  const event: AuditEventRecord | undefined = statusChanged ? {
    id: randomUUID(), entityType: "meeting_request", entityId: id, entityKey: `meeting_request:${id}`,
    action: "status_changed", fieldPath: "status", oldValue: current.status, newValue: input.status,
    performedBy: user.email, timestamp: now,
  } : undefined
  const appointmentEvent: AuditEventRecord | undefined = appointmentChanged ? {
    id: randomUUID(), entityType: "meeting_request", entityId: id, entityKey: `meeting_request:${id}`,
    action: "appointment_changed", fieldPath: "appointment",
    oldValue: current.appointment ? { ...current.appointment } : null,
    newValue: appointment ? { ...appointment } : null,
    performedBy: user.email, timestamp: now,
  } : undefined
  const events = [event, appointmentEvent].filter((value): value is AuditEventRecord => Boolean(value))
  const record: MeetingRequest = {
    ...current, status: input.status, updatedAt: now, ...(appointment ? { appointment } : {}),
    adminNotes: input.note ? [...current.adminNotes, { text: input.note, performedBy: user.email, createdAt: now }] : current.adminNotes,
    // The audit and status are saved together, even if the platform audit mirror is unavailable.
    auditEvents: [...current.auditEvents, ...events],
  }
  if (!current._etag) throw new Error("Meeting request version is missing.")
  await item.replace(record, { accessCondition: { type: "IfMatch", condition: current._etag } })
  let warning: string | undefined
  if (events.length) {
    try {
      await Promise.all(events.map((entry) => writeAuditEvent(entry)))
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
