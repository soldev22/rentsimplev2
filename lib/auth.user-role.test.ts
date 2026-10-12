import { describe, expect, it } from "vitest"
import { canAccessMaintenance, canDelete, canManageAccountRoles, canManagePlatform, canManageProperties, canReviewTenancyApplications, assertPreservesRecords, getDefaultDashboardPath, getUserRole, type AuthUser } from "./auth"
import { isRegistrationRole, REGISTRATION_ROLE_LABELS } from "./registration-roles"

const user = { role: "user", approval_status: "approved" } satisfies Pick<AuthUser, "role" | "approval_status">

describe("internal User capabilities", () => {
  it("routes approved Users to the platform without impersonating Global admin", () => {
    expect(getUserRole(user)).toBe("user")
    expect(getDefaultDashboardPath(user)).toBe("/dashboard/platform")
    expect(canManagePlatform(user)).toBe(true)
    expect(canManageProperties(user)).toBe(true)
    expect(canReviewTenancyApplications(user)).toBe(true)
    expect(canAccessMaintenance(user)).toBe(true)
    expect(canManageAccountRoles(user)).toBe(false)
    expect(canDelete(user)).toBe(false)
  })

  it.each(["pending_verification", "pending_approval"] as const)("does not grant unapproved Users platform access (%s)", (approval_status) => {
    const pending = { ...user, approval_status }
    expect(getDefaultDashboardPath(pending)).toBe("/waiting")
    expect(canManagePlatform(pending)).toBe(false)
    expect(canManageProperties(pending)).toBe(false)
  })

  it("never offers internal roles in public registration", () => {
    expect(Object.keys(REGISTRATION_ROLE_LABELS)).toEqual(["applicant", "landlord", "agent", "tenant", "builder"])
    for (const role of ["user", "admin", "unallocated"]) expect(isRegistrationRole(role)).toBe(false)
  })

  it("retains existing role routing and Global admin privileges", () => {
    expect(canManageAccountRoles({ role: "admin" })).toBe(true)
    expect(canDelete({ role: "admin" })).toBe(true)
    const routes = { admin: "platform", agent: "agent", landlord: "landlord", applicant: "applicant", tenant: "maintenance", builder: "maintenance" } as const
    for (const [role, path] of Object.entries(routes)) {
      expect(getDefaultDashboardPath({ role: role as AuthUser["role"], approval_status: "approved" })).toBe(`/dashboard/${path}`)
    }
  })

  it("allows appending and editing records but rejects indirect removal for Users", () => {
    const original = [{ id: "one", text: "Original" }]
    expect(() => assertPreservesRecords(user, original, [{ id: "one", text: "Edited" }, { id: "two", text: "Added" }], (record) => record.id)).not.toThrow()
    expect(() => assertPreservesRecords(user, original, [], (record) => record.id)).toThrow("Forbidden")
    expect(() => assertPreservesRecords({ role: "admin" }, original, [], (record) => record.id)).not.toThrow()
  })
})
