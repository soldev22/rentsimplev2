import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  getUserRole: vi.fn(),
  isPendingApproval: vi.fn(),
  getMaintenanceContainer: vi.fn(),
  getMaintenanceIssueForUpdate: vi.fn(),
  uploadToBlob: vi.fn(),
  getBlobUrl: vi.fn(),
  deleteBlob: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/server/session", () => ({ getSessionUser: mocks.getSessionUser }))
vi.mock("@/lib/auth", () => ({
  getUserRole: mocks.getUserRole,
  isPendingApproval: mocks.isPendingApproval,
}))
vi.mock("@/lib/server/cosmos", () => ({ getMaintenanceContainer: mocks.getMaintenanceContainer }))
vi.mock("@/lib/server/maintenance", () => ({
  getMaintenanceIssueForUpdate: mocks.getMaintenanceIssueForUpdate,
}))
vi.mock("@/lib/server/blob", () => ({
  uploadToBlob: mocks.uploadToBlob,
  getBlobUrl: mocks.getBlobUrl,
  deleteBlob: mocks.deleteBlob,
}))

import { POST } from "@/app/api/maintenance/[id]/updates/route"

describe("maintenance update route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSessionUser.mockResolvedValue({
      id: "tenant-1",
      email: "tenant@example.com",
      first_name: "Taylor",
      last_name: "Tenant",
    })
    mocks.getUserRole.mockReturnValue("tenant")
    mocks.isPendingApproval.mockReturnValue(false)
    mocks.getMaintenanceIssueForUpdate.mockResolvedValue({
      id: "issue-1",
      propertyId: "property-1",
      tenantId: "tenant-1",
      updates: [],
    })
  })

  it("saves a tenant note with uploaded photos on their maintenance issue", async () => {
    const existingIssue = {
      id: "issue-1",
      propertyId: "property-1",
      tenantId: "tenant-1",
      updates: [],
    }
    mocks.getMaintenanceIssueForUpdate.mockResolvedValue(existingIssue)
    const replace = vi.fn().mockResolvedValue({})
    const container = {
      items: {
        query: vi.fn(() => ({
          fetchAll: vi.fn().mockResolvedValue({ resources: [existingIssue] }),
        })),
      },
      item: vi.fn(() => ({ replace })),
    }
    mocks.getMaintenanceContainer.mockResolvedValue(container)
    mocks.uploadToBlob.mockResolvedValue(undefined)
    mocks.getBlobUrl.mockImplementation((path: string) => `https://blob.example/${path}`)

    const formData = new FormData()
    formData.set("note", "The leak has got worse.")
    formData.append("photos", new File([], "", { type: "application/octet-stream" }))
    formData.append("photos", new File(["image-data"], "leak.jpg", { type: "image/jpeg" }))

    const response = await POST(
      new Request("http://localhost/api/maintenance/issue-1/updates", { method: "POST", body: formData }),
      { params: Promise.resolve({ id: "issue-1" }) },
    )

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.update).toMatchObject({
      authorId: "tenant-1",
      authorName: "Taylor Tenant",
      note: "The leak has got worse.",
    })
    expect(body.update.photos).toHaveLength(1)
    expect(mocks.uploadToBlob).toHaveBeenCalledWith(
      expect.stringMatching(/^maintenance\/issue-1\/updates\/.+\/.+$/),
      expect.any(ArrayBuffer),
      "image/jpeg",
    )
    expect(replace).toHaveBeenCalledWith({
      ...existingIssue,
      updates: [body.update],
      updatedAt: body.update.createdAt,
    })
  })

  it("rejects updates to another tenant's issue", async () => {
    mocks.getMaintenanceIssueForUpdate.mockRejectedValue(new Error("Forbidden"))

    const formData = new FormData()
    formData.set("note", "Not my issue")

    const response = await POST(
      new Request("http://localhost/api/maintenance/issue-1/updates", { method: "POST", body: formData }),
      { params: Promise.resolve({ id: "issue-1" }) },
    )

    expect(response.status).toBe(403)
    expect(mocks.uploadToBlob).not.toHaveBeenCalled()
  })

  it("allows a property admin to add a maintenance update", async () => {
    mocks.getUserRole.mockReturnValue("admin")
    mocks.getSessionUser.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      first_name: "Alex",
      last_name: "Admin",
    })
    mocks.getMaintenanceIssueForUpdate.mockResolvedValue({
      id: "issue-1",
      propertyId: "property-1",
      tenantId: "tenant-1",
      updates: [],
    })
    mocks.getMaintenanceContainer.mockResolvedValue({
      item: vi.fn(() => ({ replace: vi.fn().mockResolvedValue({}) })),
    })

    const formData = new FormData()
    formData.set("note", "Contractor has been contacted.")

    const response = await POST(
      new Request("http://localhost/api/maintenance/issue-1/updates", { method: "POST", body: formData }),
      { params: Promise.resolve({ id: "issue-1" }) },
    )

    expect(response.status).toBe(201)
    expect(mocks.getMaintenanceIssueForUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: "admin-1" }), "issue-1")
  })

  it("requires a note or at least one photo", async () => {
    const response = await POST(
      new Request("http://localhost/api/maintenance/issue-1/updates", {
        method: "POST",
        body: new FormData(),
      }),
      { params: Promise.resolve({ id: "issue-1" }) },
    )

    expect(response.status).toBe(400)
    expect(mocks.getMaintenanceContainer).not.toHaveBeenCalled()
  })
})
