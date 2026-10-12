import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AuthUser } from "@/lib/types/user"

const mocks = vi.hoisted(() => ({ session: vi.fn(), update: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/server/session", () => ({ getSessionUser: mocks.session }))
vi.mock("@/lib/server/cosmos", () => ({}))
vi.mock("@/lib/server/audit", () => ({}))
vi.mock("@/lib/server/crm", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/server/crm")>()
  return { ...original, updateCrmContact: mocks.update }
})
import * as route from "@/app/api/admin/crm/contacts/[id]/route"

const { PATCH } = route
const admin: AuthUser = { id: "admin", email: "admin@example.com", first_name: "Admin", last_name: "User", mobile: "", role: "admin", approval_status: "approved", createdAt: "", updatedAt: "" }
const id = "11111111-1111-5111-8111-111111111111"
const context = (value = id) => ({ params: Promise.resolve({ id: value }) })
const body = { firstName: "Sam", lastName: "Shaw", phone: "", company: "", town: "", note: "Call back", expectedUpdatedAt: "2026-01-01T00:00:00.000Z" }
const request = (value: unknown = body, headers: Record<string, string> = {}) =>
  new Request(`http://localhost/api/admin/crm/contacts/${id}`, { method: "PATCH", headers, body: JSON.stringify(value) })

describe("CRM contact update API", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.session.mockResolvedValue(admin)
    mocks.update.mockResolvedValue({ kind: "updated", contact: { id } })
  })
  afterEach(() => vi.restoreAllMocks())

  it("offers no delete handler", () => {
    expect("DELETE" in route).toBe(false)
  })
  it("rejects unauthenticated and unauthorized access", async () => {
    mocks.session.mockResolvedValue(null)
    expect((await PATCH(request(), context())).status).toBe(401)
    for (const overrides of [{ role: "landlord" }, { role: "user", approval_status: "pending_approval" }] as const) {
      mocks.session.mockResolvedValue({ ...admin, ...overrides })
      expect((await PATCH(request(), context())).status).toBe(403)
    }
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it("rejects cross-origin writes, bad IDs and invalid bodies", async () => {
    expect((await PATCH(request(body, { origin: "https://evil.example" }), context())).status).toBe(403)
    expect((await PATCH(request(), context("not-an-id"))).status).toBe(400)
    expect((await PATCH(request({ ...body, email: "new@example.com" }), context())).status).toBe(400)
    expect((await PATCH(request({ ...body, stage: "Allocated" }), context())).status).toBe(400)
    expect((await PATCH(request({ ...body, expectedUpdatedAt: "" }), context())).status).toBe(400)
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it("updates an approved User's contact", async () => {
    mocks.session.mockResolvedValue({ ...admin, role: "user" })
    const response = await PATCH(request(), context())
    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ role: "user" }), id, expect.objectContaining({ note: "Call back" }))
  })
  it.each([
    [{ kind: "not_found" }, 404],
    [{ kind: "conflict" }, 409],
    [{ kind: "unchanged", contact: {} }, 400],
  ])("maps %o to %i", async (result, status) => {
    mocks.update.mockResolvedValue(result)
    expect((await PATCH(request(), context())).status).toBe(status)
  })
  it("maps storage precondition failures to 409", async () => {
    mocks.update.mockRejectedValue(Object.assign(new Error("precondition"), { code: 412 }))
    expect((await PATCH(request(), context())).status).toBe(409)
  })
})
