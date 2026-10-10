import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const EXISTING_USER_ID = "3f2b8c1e-4d5a-4e6f-8a7b-9c0d1e2f3a4b"
const mockUsers: Record<string, unknown> = {}

const { canAdminEditUser } = await import("@/components/forms/AdminUserManager")
const mockUpsert = vi.fn(async (user: { id: string }) => {
  mockUsers[user.id] = user
  return user
})

vi.mock("@/lib/server/cosmos", () => ({
  getUsersContainer: vi.fn(async () => ({
    item: (id: string) => ({
      read: async () => ({ resource: mockUsers[id] ?? null }),
    }),
    items: {
      upsert: mockUpsert,
    },
  })),
}))

describe("updateUserForAdmin", () => {
  beforeEach(() => {
    mockUpsert.mockClear()
    Object.keys(mockUsers).forEach((key) => delete mockUsers[key])

    mockUsers[EXISTING_USER_ID] = {
      id: EXISTING_USER_ID,
      email: "existing.user@example.com",
      first_name: "Existing",
      last_name: "User",
      mobile: "07111111111",
      role: "applicant",
      approval_status: "pending_approval",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  })

  it("updates editable user profile fields for admin edits", async () => {
    const { updateUserForAdmin } = await import("./users")
    type UpdateUserForAdminArgs = Parameters<typeof updateUserForAdmin>

    const adminUser = {
      id: "00000000-0000-4000-8000-000000000001",
      email: "admin@example.com",
      first_name: "Admin",
      last_name: "User",
      mobile: "07000000000",
      role: "admin",
      approval_status: "approved",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const updated = await updateUserForAdmin(adminUser as UpdateUserForAdminArgs[0], EXISTING_USER_ID, {
      first_name: "Updated",
      last_name: "Profile",
      mobile: "07777777777",
      role: "tenant",
      approval_status: "approved",
    } as UpdateUserForAdminArgs[2])

    expect(updated).not.toBeNull()
    expect(updated?.first_name).toBe("Updated")
    expect(updated?.last_name).toBe("Profile")
    expect(updated?.mobile).toBe("07777777777")
    expect(updated?.role).toBe("tenant")
    expect(updated?.approval_status).toBe("approved")
  })

  it("allows the named super admin to edit their own profile details", () => {
    expect(canAdminEditUser("mike@solutionsdeveloped.co.uk", "mike@solutionsdeveloped.co.uk")).toBe(true)
    expect(canAdminEditUser("mike@solutionsdeveloped.co.uk", "other.admin@example.com")).toBe(true)
    expect(canAdminEditUser("other.admin@example.com", "other.admin@example.com")).toBe(false)
  })
})
