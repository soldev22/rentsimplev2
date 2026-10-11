import { beforeEach, describe, expect, it, vi } from "vitest"
import { canAccessMaintenance, canManageProperties, canReviewTenancyApplications, getDefaultDashboardPath, type AuthUser } from "@/lib/auth"

vi.mock("server-only", () => ({}))
const mocks = vi.hoisted(() => ({
  records: new Map<string, AuthUser & { emailVerifiedAt?: string; landlordApplicationNotifiedAt?: string }>(),
  version: 0,
  consume: vi.fn(),
  notify: vi.fn(),
}))
vi.mock("@/lib/server/auth-security", () => ({ consumeAuthChallenge: mocks.consume, createAuthChallenge: vi.fn() }))
vi.mock("@/lib/server/landlord-application-notifications", () => ({ sendLandlordApplicationNotifications: mocks.notify }))
vi.mock("@/lib/server/cosmos", () => ({
  getUsersContainer: async () => ({
    items: {
      query: ({ query, parameters }: { query: string; parameters?: { value: string }[] }) => ({
        fetchAll: async () => {
          let users = [...mocks.records.values()]
          if (parameters) return { resources: users.filter((user) => user.email === parameters[0].value).map((user) => ({ ...user })) }
          if (query.includes("WHERE")) {
            const isApplication = (user: AuthUser) => user.requestedRole === "landlord" && user.role === "unallocated" && user.approval_status !== "approved"
            users = users.filter((user) => query.includes("NOT IS_DEFINED") ? !isApplication(user) : isApplication(user))
          }
          if (query.includes("COUNT(1)")) return { resources: [users.length] }
          users.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
          const range = query.match(/OFFSET (\d+) LIMIT (\d+)/)!
          return { resources: users.slice(Number(range[1]), Number(range[1]) + Number(range[2])) }
        },
      }),
      upsert: async (user: AuthUser) => { mocks.records.set(user.id, { ...user }); mocks.version++; return { resource: user } },
    },
    item: (id: string) => ({
      read: async () => ({ resource: mocks.records.has(id) ? { ...mocks.records.get(id) } : undefined, etag: String(mocks.version) }),
      replace: async (user: AuthUser, options: { accessCondition: { condition: string } }) => {
        if (options.accessCondition.condition !== String(mocks.version)) throw Object.assign(new Error("Conflict"), { code: 412 })
        mocks.records.set(id, { ...user }); mocks.version++
        return { resource: user }
      },
    }),
  }),
}))

import { createUser, listUsersForAdminPage, updateUserForAdmin, verifyUserEmail } from "./users"

const input = { firstName: "Test", lastName: "Landlord", mobile: "07700000000", email: "landlord@example.com", password: "Password123!", requestedRole: "landlord" as const }

function expectNoAccess(user: AuthUser) {
  expect(user.role).toBe("unallocated")
  expect(canManageProperties(user)).toBe(false)
  expect(canReviewTenancyApplications(user)).toBe(false)
  expect(canAccessMaintenance(user)).toBe(false)
  expect(getDefaultDashboardPath(user)).toBe("/waiting")
}

describe("Landlord registration and verification", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.records.clear()
    mocks.version = 0
    mocks.consume.mockResolvedValue({ email: input.email, error: null })
    mocks.notify.mockResolvedValue(undefined)
  })

  it("stores a requested role without granting access, then grants access only on admin approval", async () => {
    const registered = await createUser(input)
    expect(registered.user).toMatchObject({ requestedRole: "landlord", approval_status: "pending_verification" })
    expectNoAccess(registered.user!)
    expect(mocks.records.get(registered.user!.id)).toMatchObject({ role: "unallocated", requestedRole: "landlord" })
    const verified = await verifyUserEmail("token")
    expect(verified.user?.approval_status).toBe("pending_approval")
    expectNoAccess(verified.user!)
    expect(mocks.notify).toHaveBeenCalledOnce()
    const admin: AuthUser = { ...registered.user!, id: "admin", role: "admin", approval_status: "approved" }
    const approved = await updateUserForAdmin(admin, registered.user!.id, { role: "landlord", approval_status: "approved" })
    expect(approved?.role).toBe("landlord")
    expect(canManageProperties(approved)).toBe(true)
  })

  it("notifies once during concurrent verification and does not downgrade approval on another click", async () => {
    const registered = await createUser(input)
    await Promise.all([verifyUserEmail("one"), verifyUserEmail("two")])
    expect(mocks.notify).toHaveBeenCalledOnce()
    const stored = mocks.records.get(registered.user!.id)!
    mocks.records.set(stored.id, { ...stored, role: "landlord", approval_status: "approved" })
    const repeated = await verifyUserEmail("three")
    expect(repeated.user?.approval_status).toBe("approved")
    expect(mocks.notify).toHaveBeenCalledOnce()
  })

  it("keeps verification saved when notifications throw and does not resend automatically", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.notify.mockRejectedValue(new Error("Delivery unavailable"))
    const registered = await createUser(input)
    expect((await verifyUserEmail("token")).error).toBeNull()
    expect(mocks.records.get(registered.user!.id)).toMatchObject({ role: "unallocated", approval_status: "pending_approval", landlordApplicationNotifiedAt: expect.any(String) })
    await verifyUserEmail("again")
    expect(mocks.notify).toHaveBeenCalledOnce()
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it("keeps repeat registrations unallocated and prevents public Global admin selection", async () => {
    await createUser(input)
    expectNoAccess((await createUser(input)).user!)
    // @ts-expect-error Runtime callers must also be checked against the role whitelist.
    const invalid = await createUser({ ...input, requestedRole: "admin" })
    expect(invalid.user).toBeNull()
    expect(invalid.error).toContain("valid registration type")
  })

  it("retains Applicant auto-approval and skips Landlord alerts for other registration types", async () => {
    await createUser({ ...input, requestedRole: "applicant" })
    const verified = await verifyUserEmail("token")
    expect(verified.user).toMatchObject({ role: "applicant", approval_status: "approved" })
    expect(mocks.notify).not.toHaveBeenCalled()
  })

  it("prioritises Landlord applications across page boundaries, preserving all older records without requestedRole", async () => {
    const registered = (await createUser(input)).user!
    const admin: AuthUser = { ...registered, id: "admin", role: "admin", approval_status: "approved" }
    mocks.records.clear()
    const records: AuthUser[] = [
      { ...registered, id: "old-application", createdAt: "2026-01-01" },
      { ...registered, id: "new-application", createdAt: "2026-02-01" },
      { ...registered, id: "newer-other", requestedRole: undefined, createdAt: "2026-04-01" },
      { ...registered, id: "older-other", requestedRole: undefined, createdAt: "2026-03-01" },
    ]
    records.forEach((user) => mocks.records.set(user.id, user))
    const first = await listUsersForAdminPage(admin, { page: 1, pageSize: 3 })
    const second = await listUsersForAdminPage(admin, { page: 2, pageSize: 3 })
    expect(first.items.map((user) => user.id)).toEqual(["new-application", "old-application", "newer-other"])
    expect(second.items.map((user) => user.id)).toEqual(["older-other"])
    expect(first.totalCount).toBe(4)
    await expect(listUsersForAdminPage(registered)).rejects.toThrow("Forbidden")
  })
})
