import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AuthUser } from "@/lib/types/user"

const mocks = vi.hoisted(() => ({
  crmQuery: vi.fn(), crmCreate: vi.fn(), crmRead: vi.fn(), crmReplace: vi.fn(),
  meetingQuery: vi.fn(), userQuery: vi.fn(), usersContainer: vi.fn(), meetingsContainer: vi.fn(), crmContainer: vi.fn(), audit: vi.fn(),
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/server/audit", () => ({ writeAuditEvent: mocks.audit }))
vi.mock("@/lib/server/cosmos", () => ({
  getCrmContactsContainer: mocks.crmContainer,
  getMeetingRequestsContainer: mocks.meetingsContainer,
  getUsersContainer: mocks.usersContainer,
}))
import { canManageCrm, createCrmContact, crmContactId, listCrmContacts, updateCrmContact } from "@/lib/server/crm"

const admin: AuthUser = { id: "admin", email: "admin@example.com", first_name: "Admin", last_name: "User", mobile: "", role: "admin", approval_status: "approved", createdAt: "", updatedAt: "" }
const input = { firstName: "Sam", lastName: "Shaw", email: "sam@example.com", phone: "", company: "", town: "", note: "" }
const stored = {
  id: crmContactId("sam@example.com"), type: "crm_contact", ...input, source: "manual", createdAt: "2026-01-01T00:00:00.000Z", createdBy: "admin@example.com",
  updatedAt: "2026-01-01T00:00:00.000Z", updatedBy: "admin@example.com", auditEvents: [], _etag: "etag-1",
}
const fetched = (resources: unknown[]) => ({ fetchAll: () => Promise.resolve({ resources }) })

describe("CRM storage", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.crmContainer.mockResolvedValue({ items: { query: mocks.crmQuery, create: mocks.crmCreate }, item: () => ({ read: mocks.crmRead, replace: mocks.crmReplace }) })
    mocks.meetingsContainer.mockResolvedValue({ items: { query: mocks.meetingQuery } })
    mocks.usersContainer.mockResolvedValue({ items: { query: mocks.userQuery } })
    mocks.crmQuery.mockReturnValue(fetched([{ ...stored, _etag: undefined }]))
    mocks.meetingQuery.mockReturnValue(fetched([
      { id: "m1", firstName: "Sam", lastName: "Shaw", email: "SAM@example.com", phone: "", town: "", status: "new", createdAt: "2026-02-01T00:00:00.000Z", doneAt: ["2026-01-20T00:00:00.000Z"] },
    ]))
    mocks.userQuery.mockReturnValue(fetched([{ id: "u1", email: "sam@example.com", role: "landlord", approval_status: "pending_approval" }]))
    mocks.crmRead.mockResolvedValue({ resource: stored })
    mocks.crmReplace.mockResolvedValue({})
    mocks.crmCreate.mockResolvedValue({})
    mocks.audit.mockResolvedValue(undefined)
  })

  it("allows only approved Global admins and Users", () => {
    expect(canManageCrm(admin)).toBe(true)
    expect(canManageCrm({ ...admin, role: "user" })).toBe(true)
    expect(canManageCrm({ ...admin, role: "user", approval_status: "pending_approval" })).toBe(false)
    expect(canManageCrm({ ...admin, approval_status: "pending_verification" })).toBe(false)
    for (const role of ["landlord", "tenant", "applicant", "agent", "builder"] as const) expect(canManageCrm({ ...admin, role })).toBe(false)
    expect(canManageCrm(null)).toBe(false)
  })

  it.each([
    ["landlord", { ...admin, role: "landlord" as const }],
    ["pending User", { ...admin, role: "user" as const, approval_status: "pending_approval" as const }],
    ["signed-out", null],
  ])("rejects %s access before touching storage", async (_label, user) => {
    await expect(listCrmContacts(user)).rejects.toThrow("Forbidden")
    await expect(createCrmContact(user, input)).rejects.toThrow("Forbidden")
    await expect(updateCrmContact(user, stored.id, { ...input, expectedUpdatedAt: stored.updatedAt })).rejects.toThrow("Forbidden")
    expect(mocks.crmContainer).not.toHaveBeenCalled()
    expect(mocks.meetingsContainer).not.toHaveBeenCalled()
    expect(mocks.usersContainer).not.toHaveBeenCalled()
  })

  it("lists merged contacts using account projections only", async () => {
    const contacts = await listCrmContacts({ ...admin, role: "user" })
    expect(contacts).toHaveLength(1)
    expect(contacts[0]).toMatchObject({ email: "sam@example.com", stage: "Allocated", accounts: [{ id: "u1", approval_status: "pending_approval" }] })
    expect(contacts[0].meetings[0]).toMatchObject({ id: "m1", done: true })
    const userQuery = mocks.userQuery.mock.calls[0][0]
    expect(userQuery.query).toBe("SELECT c.id, c.email, c.role, c.approval_status, c.createdAt FROM c WHERE ARRAY_CONTAINS(@emails, c.email)")
    expect(userQuery.query).not.toMatch(/\*|password|hash|token/i)
    expect(userQuery.parameters).toEqual([{ name: "@emails", value: ["sam@example.com"] }])
    expect(mocks.meetingQuery.mock.calls[0][0].query).not.toContain("SELECT *")
  })

  it("creates a manual contact with a stable email-derived ID and never writes accounts or meetings", async () => {
    mocks.crmRead.mockRejectedValue(Object.assign(new Error("missing"), { code: 404 }))
    const result = await createCrmContact(admin, { ...input, email: "sam@example.com" })
    expect(result.kind).toBe("created")
    expect(crmContactId(" SAM@example.com ")).toBe(stored.id)
    expect(stored.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    const record = mocks.crmCreate.mock.calls[0][0]
    expect(record).toMatchObject({ id: stored.id, type: "crm_contact", email: "sam@example.com", source: "manual", createdBy: "admin@example.com" })
    expect(record).not.toHaveProperty("stage")
    expect(record.auditEvents).toHaveLength(1)
    expect(mocks.audit).toHaveBeenCalledOnce()
    expect(mocks.usersContainer).not.toHaveBeenCalled()
    expect(mocks.meetingsContainer).not.toHaveBeenCalled()
  })

  it("reports duplicates by email", async () => {
    expect(await createCrmContact(admin, input)).toEqual({ kind: "duplicate", id: stored.id })
    expect(mocks.crmCreate).not.toHaveBeenCalled()
    mocks.crmRead.mockResolvedValue({ resource: undefined })
    mocks.crmCreate.mockRejectedValue(Object.assign(new Error("conflict"), { code: 409 }))
    expect(await createCrmContact(admin, input)).toEqual({ kind: "duplicate", id: stored.id })
  })

  it("updates with optimistic concurrency and audit events", async () => {
    const result = await updateCrmContact(admin, stored.id, { ...input, note: "Follow up", expectedUpdatedAt: stored.updatedAt })
    expect(result.kind).toBe("updated")
    const [record, options] = mocks.crmReplace.mock.calls[0]
    expect(options).toEqual({ accessCondition: { type: "IfMatch", condition: "etag-1" } })
    expect(record).not.toHaveProperty("_etag")
    expect(record.email).toBe("sam@example.com")
    expect(record.auditEvents).toEqual([expect.objectContaining({ fieldPath: "note", oldValue: "", newValue: "Follow up" })])
    expect(mocks.usersContainer).not.toHaveBeenCalled()
  })

  it("returns conflicts, missing contacts and unchanged results", async () => {
    expect((await updateCrmContact(admin, stored.id, { ...input, note: "x", expectedUpdatedAt: "2025-01-01T00:00:00.000Z" })).kind).toBe("conflict")
    expect((await updateCrmContact(admin, stored.id, { ...input, expectedUpdatedAt: stored.updatedAt })).kind).toBe("unchanged")
    mocks.crmReplace.mockRejectedValue(Object.assign(new Error("precondition"), { code: 412 }))
    expect((await updateCrmContact(admin, stored.id, { ...input, note: "x", expectedUpdatedAt: stored.updatedAt })).kind).toBe("conflict")
    mocks.crmRead.mockRejectedValue(Object.assign(new Error("missing"), { code: 404 }))
    expect((await updateCrmContact(admin, stored.id, { ...input, note: "x", expectedUpdatedAt: stored.updatedAt })).kind).toBe("not_found")
  })

  it("returns a warning when the platform audit mirror fails", async () => {
    mocks.audit.mockRejectedValue(new Error("down"))
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    const result = await updateCrmContact(admin, stored.id, { ...input, note: "x", expectedUpdatedAt: stored.updatedAt })
    expect(result.kind === "updated" && result.warning).toContain("audit log could not be updated")
  })
})
