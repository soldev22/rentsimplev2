import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import type { AuthUser } from "@/lib/types/user"
import type { MeetingRequest } from "@/lib/meeting-requests"

const mocks = vi.hoisted(() => ({
  create: vi.fn(), read: vi.fn(), replace: vi.fn(), query: vi.fn(), audit: vi.fn(), delete: vi.fn(),
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/server/cosmos", () => ({
  getMeetingRequestsContainer: async () => ({
    items: { create: mocks.create, query: mocks.query },
    item: () => ({ read: mocks.read, replace: mocks.replace, delete: mocks.delete }),
  }),
}))
vi.mock("@/lib/server/audit", () => ({ writeAuditEvent: mocks.audit }))

import { canManageMeetingRequests, createMeetingRequest, deleteMeetingRequest, listMeetingRequests, updateMeetingRequest } from "@/lib/server/meeting-requests"

const admin: AuthUser = {
  id: "admin-1", email: "admin@example.com", first_name: "Admin", last_name: "User",
  role: "admin", approval_status: "approved", mobile: "07739870670", createdAt: "", updatedAt: "",
}
const input = {
  firstName: "Taylor", lastName: "Landlord", phone: "07739870670", email: "taylor@example.com",
  numberOfProperties: 2, town: "Glasgow", preferredDays: ["Mon"] as const, preferredTime: "morning" as const, meetingType: "phone" as const, notes: "",
}
let stored: MeetingRequest

describe("meeting request storage and access", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    stored = { ...input, preferredDays: ["Mon"], id: "request-1", type: "meeting_request", status: "new", createdAt: "2026-10-11T09:00:00.000Z", updatedAt: "2026-10-11T09:00:00.000Z", adminNotes: [], auditEvents: [] }
    mocks.read.mockResolvedValue({ resource: { ...stored, _etag: "version-1" } })
    mocks.query.mockReturnValue({ fetchAll: async () => ({ resources: [] }) })
  })
  afterEach(() => vi.restoreAllMocks())
  it("persists the complete record shape with generated ID, new status and identical timestamps", async () => {
    const result = await createMeetingRequest({ ...input, preferredDays: ["Mon"] })
    expect(result).toEqual({
      ...input, id: expect.stringMatching(/^[0-9a-f-]{36}$/), type: "meeting_request", status: "new",
      createdAt: expect.any(String), updatedAt: expect.any(String), adminNotes: [], auditEvents: [],
      emailReplyToken: expect.stringMatching(/^[0-9a-f]{24}$/), emailMessages: [],
    })
    expect(result.createdAt).toBe(result.updatedAt)
    expect(mocks.create).toHaveBeenCalledWith(result)
  })
  it.each(["landlord", "tenant", "applicant", "agent", "builder", "unallocated"] as const)("denies %s at the storage layer", async (role) => {
    const user = { ...admin, role }
    expect(canManageMeetingRequests(user)).toBe(false)
    await expect(listMeetingRequests(user)).rejects.toThrow("Forbidden")
    await expect(deleteMeetingRequest(user, stored.id, stored.updatedAt)).rejects.toThrow("Forbidden")
    await expect(updateMeetingRequest(user, stored.id, { status: "done", note: "", expectedUpdatedAt: stored.updatedAt })).rejects.toThrow("Forbidden")
    expect(mocks.read).not.toHaveBeenCalled()
    expect(mocks.query).not.toHaveBeenCalled()
  })
  it("denies unapproved admins and anonymous access", () => {
    expect(canManageMeetingRequests(null)).toBe(false)
    expect(canManageMeetingRequests({ ...admin, approval_status: "pending_verification" })).toBe(false)
    expect(canManageMeetingRequests({ ...admin, approval_status: "pending_approval" })).toBe(false)
  })
  it("lists newest first with bounded pagination", async () => {
    mocks.query.mockReturnValueOnce({ fetchAll: async () => ({ resources: [stored] }) }).mockReturnValueOnce({ fetchAll: async () => ({ resources: [51] }) })
    const result = await listMeetingRequests(admin, 2)
    expect(result).toEqual({ requests: [stored], totalPages: 2 })
    expect(mocks.query).toHaveBeenCalledWith(expect.objectContaining({ query: expect.stringContaining("ORDER BY c.createdAt DESC OFFSET 50 LIMIT 50") }))
  })
  it("saves status, note and durable audit entry in one conditional write", async () => {
    const result = await updateMeetingRequest(admin, stored.id, { status: "confirmed", note: "Call agreed", expectedUpdatedAt: stored.updatedAt })
    expect(result.kind).toBe("updated")
    if (result.kind !== "updated") throw new Error("Update failed")
    expect(result.request.status).toBe("confirmed")
    expect(result.request.adminNotes).toEqual([{ text: "Call agreed", performedBy: admin.email, createdAt: result.request.updatedAt }])
    expect(result.request.auditEvents).toEqual([expect.objectContaining({ oldValue: "new", newValue: "confirmed", performedBy: admin.email, action: "status_changed", timestamp: result.request.updatedAt })])
    expect(mocks.replace).toHaveBeenCalledWith(result.request, { accessCondition: { type: "IfMatch", condition: "version-1" } })
    expect(mocks.audit).toHaveBeenCalledWith(result.request.auditEvents[0])
    expect(mocks.replace.mock.invocationCallOrder[0]).toBeLessThan(mocks.audit.mock.invocationCallOrder[0])
  })
  it("keeps audit history when the platform audit mirror fails", async () => {
    mocks.audit.mockRejectedValue(new Error("audit unavailable"))
    vi.spyOn(console, "error").mockImplementation(() => {})
    const result = await updateMeetingRequest(admin, stored.id, { status: "done", note: "", expectedUpdatedAt: stored.updatedAt })
    expect(result.kind).toBe("updated")
    if (result.kind === "updated") {
      expect(result.warning).toContain("audit entry on the request")
      expect(result.request.auditEvents).toHaveLength(1)
    }
  })
  it("adds a note without a spurious status change audit", async () => {
    await updateMeetingRequest(admin, stored.id, { status: "new", note: "Called prospect", expectedUpdatedAt: stored.updatedAt })
    expect(mocks.replace).toHaveBeenCalledWith(expect.objectContaining({ status: "new", auditEvents: [], adminNotes: [expect.objectContaining({ text: "Called prospect" })] }), expect.anything())
    expect(mocks.audit).not.toHaveBeenCalled()
  })
  it("does not overwrite stale edits or no-op submissions", async () => {
    expect(await updateMeetingRequest(admin, stored.id, { status: "done", note: "", expectedUpdatedAt: "old" })).toEqual({ kind: "conflict" })
    expect(await updateMeetingRequest(admin, stored.id, { status: "new", note: "", expectedUpdatedAt: stored.updatedAt })).toEqual({ kind: "unchanged" })
    expect(mocks.replace).not.toHaveBeenCalled()
  })
  it("does not write a platform audit entry when the conditional save fails", async () => {
    mocks.replace.mockRejectedValue({ code: 412 })
    await expect(updateMeetingRequest(admin, stored.id, { status: "done", note: "", expectedUpdatedAt: stored.updatedAt })).rejects.toEqual({ code: 412 })
    expect(mocks.audit).not.toHaveBeenCalled()
  })
  it("deletes with the current ETag only after checking the loaded version", async () => {
    expect(await deleteMeetingRequest(admin, stored.id, "old")).toEqual({ kind: "conflict" })
    expect(mocks.delete).not.toHaveBeenCalled()
    expect(await deleteMeetingRequest(admin, stored.id, stored.updatedAt)).toEqual({ kind: "deleted" })
    expect(mocks.delete).toHaveBeenCalledWith({ accessCondition: { type: "IfMatch", condition: "version-1" } })
  })
  it("does not delete missing or unrelated records and propagates concurrent deletion failures", async () => {
    mocks.read.mockResolvedValueOnce({ resource: null }).mockResolvedValueOnce({ resource: { ...stored, type: "other" } })
    expect(await deleteMeetingRequest(admin, stored.id, stored.updatedAt)).toEqual({ kind: "not_found" })
    expect(await deleteMeetingRequest(admin, stored.id, stored.updatedAt)).toEqual({ kind: "not_found" })
    expect(mocks.delete).not.toHaveBeenCalled()
    mocks.delete.mockRejectedValue({ code: 412 })
    await expect(deleteMeetingRequest(admin, stored.id, stored.updatedAt)).rejects.toEqual({ code: 412 })
  })
})
