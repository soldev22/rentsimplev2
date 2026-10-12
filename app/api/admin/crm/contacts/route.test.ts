import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AuthUser } from "@/lib/types/user"

const mocks = vi.hoisted(() => ({ session: vi.fn(), list: vi.fn(), create: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/server/session", () => ({ getSessionUser: mocks.session }))
vi.mock("@/lib/server/cosmos", () => ({}))
vi.mock("@/lib/server/audit", () => ({}))
vi.mock("@/lib/server/crm", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/server/crm")>()
  return { ...original, listCrmContacts: mocks.list, createCrmContact: mocks.create }
})
import { GET, POST } from "@/app/api/admin/crm/contacts/route"

const admin: AuthUser = { id: "admin", email: "admin@example.com", first_name: "Admin", last_name: "User", mobile: "", role: "admin", approval_status: "approved", createdAt: "", updatedAt: "" }
const body = { firstName: "Sam", lastName: "Shaw", email: "Sam@Example.com", phone: "", company: "", town: "", note: "" }
const post = (value: unknown = body, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/admin/crm/contacts", { method: "POST", headers, body: typeof value === "string" ? value : JSON.stringify(value) })

describe("CRM contacts API", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.session.mockResolvedValue(admin)
    mocks.list.mockResolvedValue([])
    mocks.create.mockResolvedValue({ kind: "created", contact: { id: "c1" } })
  })
  afterEach(() => vi.restoreAllMocks())

  it("rejects unauthenticated access", async () => {
    mocks.session.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
    expect((await POST(post())).status).toBe(401)
    expect(mocks.list).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it.each([
    { role: "landlord" }, { role: "tenant" }, { role: "applicant" }, { role: "agent" }, { role: "builder" },
    { role: "user", approval_status: "pending_approval" }, { role: "admin", approval_status: "pending_verification" },
  ])("rejects %o", async (overrides) => {
    mocks.session.mockResolvedValue({ ...admin, ...overrides })
    expect((await GET()).status).toBe(403)
    expect((await POST(post())).status).toBe(403)
    expect(mocks.list).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it("lists contacts for an approved User", async () => {
    mocks.session.mockResolvedValue({ ...admin, role: "user" })
    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ contacts: [] })
  })
  it("rejects cross-origin writes", async () => {
    expect((await POST(post(body, { origin: "https://evil.example" }))).status).toBe(403)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it("rejects invalid JSON, oversized bodies and invalid fields", async () => {
    expect((await POST(post("{"))).status).toBe(400)
    expect((await POST(post({ ...body, note: "x".repeat(6000) }))).status).toBe(413)
    const response = await POST(post({ ...body, email: "nope", stage: "Prospect" }))
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.errors.email).toBeTruthy()
    expect(json.errors.form).toContain("cannot be set directly")
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it("creates a normalized contact", async () => {
    const response = await POST(post(body, { origin: "http://localhost" }))
    expect(response.status).toBe(201)
    expect(mocks.create).toHaveBeenCalledWith(admin, expect.objectContaining({ email: "sam@example.com" }))
  })
  it("returns 409 for duplicate emails", async () => {
    mocks.create.mockResolvedValue({ kind: "duplicate", id: "c1" })
    const response = await POST(post())
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ id: "c1" })
  })
  it("hides storage errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    mocks.list.mockRejectedValue(new Error("secret detail"))
    const response = await GET()
    expect(response.status).toBe(500)
    expect(JSON.stringify(await response.json())).not.toContain("secret")
  })
})
