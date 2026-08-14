import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const mockUsers: Record<string, any> = {}

const { canAdminEditUser } = await import("@/components/forms/AdminUserManager")
const mockUpsert = vi.fn(async (user: any) => {
  mockUsers[user.email] = user
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

    mockUsers["existing.user@example.com"] = {
      id: "existing.user@example.com",
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

    const adminUser = {
      id: "admin@example.com",
      email: "admin@example.com",
      first_name: "Admin",
      last_name: "User",
      mobile: "07000000000",
      role: "admin",
      approval_status: "approved",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const updated = await updateUserForAdmin(adminUser as any, "existing.user@example.com", {
      first_name: "Updated",
      last_name: "Profile",
      mobile: "07777777777",
      role: "tenant",
      approval_status: "approved",
    } as any)

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
