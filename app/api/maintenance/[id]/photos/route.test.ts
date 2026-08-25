import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  return {
    getSessionUser: vi.fn(),
    isPendingApproval: vi.fn(),
    getUserRole: vi.fn(),
    getMaintenanceContainer: vi.fn(),
    uploadToBlob: vi.fn(),
    getBlobUrl: vi.fn(),
  }
})

vi.mock("server-only", () => ({}))

vi.mock("@/lib/server/session", () => ({
  getSessionUser: mocks.getSessionUser,
}))

vi.mock("@/lib/auth", () => ({
  isPendingApproval: mocks.isPendingApproval,
  getUserRole: mocks.getUserRole,
}))

vi.mock("@/lib/server/cosmos", () => ({
  getMaintenanceContainer: mocks.getMaintenanceContainer,
}))

vi.mock("@/lib/server/blob", () => ({
  uploadToBlob: mocks.uploadToBlob,
  getBlobUrl: mocks.getBlobUrl,
}))

import { DELETE, POST } from "@/app/api/maintenance/[id]/photos/route"

describe("maintenance photo route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSessionUser.mockResolvedValue({ id: "tenant-1" })
    mocks.isPendingApproval.mockReturnValue(false)
    mocks.getUserRole.mockReturnValue("tenant")
  })

  it("uploads a photo and persists photo metadata on the issue", async () => {
    const readMock = vi.fn().mockResolvedValue({
      resource: {
        id: "issue-1",
        propertyId: "property-1",
        photoIds: [],
        photoUrls: [],
      },
    })
    const replaceMock = vi.fn().mockResolvedValue({})

    const container = {
      items: {
        query: vi.fn(() => ({
          fetchAll: vi.fn().mockResolvedValue({
            resources: [{ id: "issue-1", propertyId: "property-1", tenantId: "tenant-1" }],
          }),
        })),
      },
      item: vi.fn(() => ({
        read: readMock,
        replace: replaceMock,
      })),
    }

    mocks.getMaintenanceContainer.mockResolvedValue(container)
    mocks.uploadToBlob.mockResolvedValue(undefined)
    mocks.getBlobUrl.mockImplementation((blobPath: string) => `https://blob.example/${blobPath}`)

    const formData = new FormData()
    formData.append("file", new File(["image-data"], "photo.jpg", { type: "image/jpeg" }))

    const response = await POST(
      new Request("http://localhost/api/maintenance/issue-1/photos", {
        method: "POST",
        body: formData,
      }),
      { params: Promise.resolve({ id: "issue-1" }) },
    )

    expect(response.status).toBe(201)

    const body = (await response.json()) as {
      photo: { id: string; url: string; uploadedAt: string }
    }

    expect(body.photo.id).toBeTruthy()
    expect(body.photo.url).toContain("https://blob.example/maintenance/issue-1/")

    expect(mocks.uploadToBlob).toHaveBeenCalledTimes(1)
    const [blobPath, arrayBuffer, contentType] = mocks.uploadToBlob.mock.calls[0]
    expect(blobPath).toContain("maintenance/issue-1/")
    expect(arrayBuffer).toBeInstanceOf(ArrayBuffer)
    expect(contentType).toBe("image/jpeg")

    expect(replaceMock).toHaveBeenCalledTimes(1)
    const updatedIssue = replaceMock.mock.calls[0][0] as {
      photoIds: string[]
      photoUrls: Array<{ id: string; url: string; uploadedAt: string }>
    }
    expect(updatedIssue.photoIds).toHaveLength(1)
    expect(updatedIssue.photoUrls).toHaveLength(1)
    expect(updatedIssue.photoUrls[0].id).toBe(updatedIssue.photoIds[0])
    expect(updatedIssue.photoUrls[0].url).toContain("https://blob.example/maintenance/issue-1/")
  })

  it("deletes a photo and removes metadata from the issue", async () => {
    const readMock = vi.fn().mockResolvedValue({
      resource: {
        id: "issue-1",
        propertyId: "property-1",
        photoIds: ["photo-1", "photo-2"],
        photoUrls: [
          { id: "photo-1", url: "https://blob.example/photo-1", uploadedAt: "2026-07-08T00:00:00.000Z" },
          { id: "photo-2", url: "https://blob.example/photo-2", uploadedAt: "2026-07-08T00:00:00.000Z" },
        ],
      },
    })
    const replaceMock = vi.fn().mockResolvedValue({})

    const container = {
      items: {
        query: vi.fn(() => ({
          fetchAll: vi.fn().mockResolvedValue({
            resources: [{ id: "issue-1", propertyId: "property-1", tenantId: "tenant-1" }],
          }),
        })),
      },
      item: vi.fn(() => ({
        read: readMock,
        replace: replaceMock,
      })),
    }

    mocks.getMaintenanceContainer.mockResolvedValue(container)

    const response = await DELETE(
      new Request("http://localhost/api/maintenance/issue-1/photos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: "photo-1" }),
      }),
      { params: Promise.resolve({ id: "issue-1" }) },
    )

    expect(response.status).toBe(200)
    expect(replaceMock).toHaveBeenCalledTimes(1)

    const updatedIssue = replaceMock.mock.calls[0][0] as {
      photoIds: string[]
      photoUrls: Array<{ id: string; url: string; uploadedAt: string }>
    }

    expect(updatedIssue.photoIds).toEqual(["photo-2"])
    expect(updatedIssue.photoUrls).toEqual([
      { id: "photo-2", url: "https://blob.example/photo-2", uploadedAt: "2026-07-08T00:00:00.000Z" },
    ])
  })
})
