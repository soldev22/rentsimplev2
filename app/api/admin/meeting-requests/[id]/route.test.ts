import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import type { AuthUser } from "@/lib/types/user"

const mocks = vi.hoisted(() => ({ session: vi.fn(), update: vi.fn(), delete: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/server/session", () => ({ getSessionUser: mocks.session }))
vi.mock("@/lib/server/cosmos", () => ({}))
vi.mock("@/lib/server/audit", () => ({}))
vi.mock("@/lib/server/meeting-requests", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/server/meeting-requests")>()
  return { ...original, updateMeetingRequest: mocks.update, deleteMeetingRequest: mocks.delete }
})
import { DELETE, PATCH } from "@/app/api/admin/meeting-requests/[id]/route"

const admin: AuthUser = { id: "admin", email: "admin@example.com", first_name: "Admin", last_name: "User", mobile: "", role: "admin", approval_status: "approved", createdAt: "", updatedAt: "" }
const id = "11111111-1111-4111-8111-111111111111"
const context = { params: Promise.resolve({ id }) }
const body = { status: "confirmed", note: " Called ", expectedUpdatedAt: "2026-10-11T09:00:00.000Z" }
const request = (value: unknown = body) => new Request(`http://localhost/api/admin/meeting-requests/${id}`, { method: "PATCH", body: JSON.stringify(value) })

describe("admin meeting request API", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.session.mockResolvedValue(admin)
    mocks.update.mockResolvedValue({ kind: "updated", request: { id, status: "confirmed" } })
    mocks.delete.mockResolvedValue({ kind: "deleted" })
  })
  afterEach(() => vi.restoreAllMocks())
  it("rejects unauthenticated access", async () => {
    mocks.session.mockResolvedValue(null)
    expect((await PATCH(request(), context)).status).toBe(401)
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it.each(["landlord", "tenant", "applicant", "agent", "builder", "unallocated"])("rejects %s access", async (role) => {
    mocks.session.mockResolvedValue({ ...admin, role })
    expect((await PATCH(request(), context)).status).toBe(403)
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it.each(["pending_verification", "pending_approval"])("rejects %s admins", async (approval_status) => {
    mocks.session.mockResolvedValue({ ...admin, approval_status })
    expect((await PATCH(request(), context)).status).toBe(403)
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it("allows approved admins and records their identity server-side", async () => {
    expect((await PATCH(request({ ...body, performedBy: "forged" }), context)).status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith(admin, id, { ...body, note: "Called" })
  })
  it("rejects invalid status, note types and JSON", async () => {
    for (const value of [{ ...body, status: "invalid" }, { ...body, note: [] }, null]) {
      expect((await PATCH(request(value), context)).status).toBe(400)
    }
    expect((await PATCH(new Request("http://localhost", { method: "PATCH", body: "{" }), context)).status).toBe(400)
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it.each([["conflict", 409], ["not_found", 404], ["unchanged", 400]])("handles %s updates", async (kind, status) => {
    mocks.update.mockResolvedValue({ kind })
    expect((await PATCH(request(), context)).status).toBe(status)
  })
  it("returns a conflict when Cosmos rejects an outdated version", async () => {
    mocks.update.mockRejectedValue({ code: 412 })
    expect((await PATCH(request(), context)).status).toBe(409)
  })
  it.each([null, { ...admin, role: "landlord" }, { ...admin, approval_status: "pending_approval" }])("denies deletion without approved Global admin access", async (user) => {
    mocks.session.mockResolvedValue(user)
    expect((await DELETE(request(), context)).status).toBe(user ? 403 : 401)
    expect(mocks.delete).not.toHaveBeenCalled()
  })
  it("deletes as the authenticated admin and returns explicit confirmation", async () => {
    const response = await DELETE(request(), context)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ deleted: true })
    expect(mocks.delete).toHaveBeenCalledWith(admin, id, body.expectedUpdatedAt)
  })
  it("rejects malformed deletion bodies and cross-origin requests", async () => {
    for (const value of [null, {}, { expectedUpdatedAt: 123 }]) {
      expect((await DELETE(request(value), context)).status).toBe(400)
    }
    const foreign = new Request(`http://localhost/api/admin/meeting-requests/${id}`, { method: "DELETE", headers: { Origin: "https://example.com" }, body: JSON.stringify(body) })
    expect((await DELETE(foreign, context)).status).toBe(403)
    expect(mocks.delete).not.toHaveBeenCalled()
  })
  it.each([["conflict", 409], ["not_found", 404]])("reports %s deletion", async (kind, status) => {
    mocks.delete.mockResolvedValue({ kind })
    expect((await DELETE(request(), context)).status).toBe(status)
  })
  it("reports a concurrent delete conflict", async () => {
    mocks.delete.mockRejectedValue({ code: 412 })
    expect((await DELETE(request(), context)).status).toBe(409)
  })
})
