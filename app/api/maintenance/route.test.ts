import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  getUserRole: vi.fn(),
  isPendingApproval: vi.fn(),
  canAccessMaintenance: vi.fn(),
  createMaintenanceIssue: vi.fn(),
  listMaintenanceIssuesForUserByContinuation: vi.fn(),
  listMaintenanceIssuesForUserPage: vi.fn(),
}))

vi.mock("@/lib/server/session", () => ({ getSessionUser: mocks.getSessionUser }))
vi.mock("@/lib/auth", () => ({
  canAccessMaintenance: mocks.canAccessMaintenance,
  getUserRole: mocks.getUserRole,
  isPendingApproval: mocks.isPendingApproval,
}))
vi.mock("@/lib/server/maintenance", () => ({
  createMaintenanceIssue: mocks.createMaintenanceIssue,
  listMaintenanceIssuesForUserByContinuation: mocks.listMaintenanceIssuesForUserByContinuation,
  listMaintenanceIssuesForUserPage: mocks.listMaintenanceIssuesForUserPage,
}))

import { POST } from "@/app/api/maintenance/route"

describe("maintenance route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSessionUser.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      first_name: "Alex",
      last_name: "Admin",
    })
    mocks.getUserRole.mockReturnValue("admin")
    mocks.isPendingApproval.mockReturnValue(false)
    mocks.createMaintenanceIssue.mockResolvedValue({
      id: "issue-1",
      propertyId: "property-1",
      propertyAddress: "1 Main Street",
      title: "Heating issue",
      reportedByName: "Alex Admin",
    })
  })

  it("allows an admin to raise a maintenance issue", async () => {
    const response = await POST(
      new Request("http://localhost/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: "property-1",
          title: "Heating issue",
          description: "The heating is not working.",
          category: "heating",
          priority: "medium",
        }),
      }),
    )

    expect(response.status).toBe(201)
    expect(mocks.createMaintenanceIssue).toHaveBeenCalledWith(
      expect.objectContaining({ id: "admin-1" }),
      expect.objectContaining({ propertyId: "property-1" }),
    )
  })

  it("does not allow builders to create maintenance issues", async () => {
    mocks.getUserRole.mockReturnValue("builder")

    const response = await POST(
      new Request("http://localhost/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: "property-1",
          title: "Heating issue",
          description: "The heating is not working.",
          category: "heating",
          priority: "medium",
        }),
      }),
    )

    expect(response.status).toBe(403)
    expect(mocks.createMaintenanceIssue).not.toHaveBeenCalled()
  })
})
