import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AuthUser, PropertyRecord, TenancyApplicationRecord } from "@/lib/auth"

const mocks = vi.hoisted(() => ({
  property: {} as Record<string, unknown>,
  application: vi.fn(),
  replace: vi.fn(),
  sync: vi.fn(async (_application, entries) => entries),
  audit: vi.fn(),
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/server/cosmos", () => ({
  getPropertiesContainer: async () => ({
    items: { query: () => ({ fetchAll: async () => ({ resources: [mocks.property] }) }) },
    item: () => ({ replace: mocks.replace }),
  }),
  getApplicationsContainer: async () => ({ item: () => ({ replace: mocks.replace }) }),
}))
vi.mock("@/lib/server/audit", () => ({ writeAuditEvent: mocks.audit, writeAuditEvents: mocks.audit }))
vi.mock("@/lib/server/applications/shared", async (original) => ({
  ...await original<typeof import("@/lib/server/applications/shared")>(),
  getApplicationById: mocks.application,
  syncStoredCommunicationEntries: mocks.sync,
}))

import { getPropertyForUser, updateProperty, deletePropertyForUser, removePropertyImage, removePropertyCompliance, reviewPropertyImageForAdmin, updatePropertyCompliance } from "./properties"
import { updateApplicationForReviewer, deleteApplicationForAdmin } from "./applications/core"
import { deleteVerificationDocumentForApplication, uploadVerificationDocumentForApplication } from "./applications/verification-documents"
import { deleteDepositDocumentForApplication, uploadDepositDocumentForApplication } from "./applications/deposits"
import { hydrateStoredApplication } from "./applications/shared"
import { deleteUserForAdmin, eraseApplicantAccountForAdmin, setUserRoleForWorkflow } from "./users"
import { archivePropertyCase } from "./cases"
import { resetWorkspaceForTesting } from "./admin-reset"

const user: AuthUser = { id: "platform-user", email: "user@example.com", role: "user", approval_status: "approved", first_name: "Platform", last_name: "User", mobile: "", createdAt: "", updatedAt: "" }

describe("User storage-level access and data preservation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.property = {
      id: "property", ownerId: "unrelated-landlord", uid: "property", address: "1 Test Road", addressLine1: "1 Test Road",
      city: "London", postcode: "SW1A 1AA", type: "Flat", status: "Available", shortDescription: "A home", longDescription: "A home",
      images: [], includedItems: [{ id: "item", name: "Fridge", isElectrical: true }],
      compliance: [{ id: "certificate", type: "gas", documents: [{ blobName: "old-blob", url: "old-url", fileName: "Gas.pdf", uploadedAt: "" }] }],
      createdAt: "", updatedAt: "",
    }
    mocks.replace.mockImplementation(async (property: PropertyRecord) => { mocks.property = { ...property }; return { resource: property } })
    mocks.application.mockResolvedValue(hydrateStoredApplication({
      id: "application", applicantId: "applicant", applicantEmail: "applicant@example.com", propertyId: "property",
      currentStage: "referencing", status: "under_review", createdAt: "", updatedAt: "",
      referencingInstruction: {
        referees: [{ id: "contact", name: "Contact", email: "contact@example.com", role: "employer" }],
        referenceRequests: [{ id: "request", refereeId: "contact", status: "sent" }],
        verificationDocuments: [{ id: "document", blobName: "verification-blob" }],
      },
      postMoveInManagement: { communicationEntries: [{ id: "note", summary: "Retain this note", subject: "History", recordedByName: "Admin", occurredAt: "", channel: "portal", direction: "outbound" }] },
      tenancyAgreement: { leaseDocument: { url: "lease-url" } },
    } as unknown as TenancyApplicationRecord))
  })

  it("reads and updates another Landlord's property, retaining included items", async () => {
    expect((await getPropertyForUser(user, "property"))?.ownerId).toBe("unrelated-landlord")
    const updated = await updateProperty(user, "property", { nickname: "Managed by platform" })
    expect(updated?.nickname).toBe("Managed by platform")
    expect(mocks.replace).toHaveBeenCalledOnce()
    expect((await getPropertyForUser(user, "property"))?.nickname).toBe("Managed by platform")
    expect((await getPropertyForUser({ ...user, approval_status: "pending_approval" }, "property"))).toBeNull()
  })

  it("forbids removing included items through PATCH", async () => {
    await expect(updateProperty(user, "property", { includedItems: [] })).rejects.toThrow("Forbidden")
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it("forbids stripping compliance documents through PUT", async () => {
    await expect(updatePropertyCompliance(user, "property", "certificate", { id: "certificate", type: "gas", lastCheckedDate: "", expirationDate: "", documents: [] })).rejects.toThrow("Forbidden")
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it.each([
    ["accounts", () => deleteUserForAdmin(user, "target")],
    ["account erasure", () => eraseApplicantAccountForAdmin(user, "target")],
    ["workspace reset", () => resetWorkspaceForTesting(user)],
    ["properties", () => deletePropertyForUser(user, "property")],
    ["images", () => removePropertyImage(user, "property", "image")],
    ["compliance", () => removePropertyCompliance(user, "property", "certificate")],
    ["image rejection", () => reviewPropertyImageForAdmin(user, "property", "image", "reject")],
    ["applications", () => deleteApplicationForAdmin(user, "application")],
    ["verification documents", () => deleteVerificationDocumentForApplication(user, "application", "document")],
    ["deposit documents", () => deleteDepositDocumentForApplication(user, "application", "document")],
    ["verification replacement", () => uploadVerificationDocumentForApplication(user, "application", "identity", {} as File, "document")],
    ["deposit replacement", () => uploadDepositDocumentForApplication(user, "application", "payment_receipt", {} as File, "document")],
    ["case archival", () => archivePropertyCase(user, {} as Parameters<typeof archivePropertyCase>[1], "Remove")],
    ["workflow role elevation", () => setUserRoleForWorkflow("applicant@example.com", "tenant", "approved", user)],
    ["workflow User assignment", () => setUserRoleForWorkflow("applicant@example.com", "user")],
  ] as const)("forbids User destruction/elevation of %s at the service boundary", async (_name, action) => {
    await expect(action()).rejects.toThrow("Forbidden")
    expect(mocks.replace).not.toHaveBeenCalled()
    expect(mocks.application).not.toHaveBeenCalled()
  })

  it.each([
    { referencingInstruction: { referees: [] } },
    { referencingInstruction: { referenceRequests: [] } },
    { referencingInstruction: { verificationDocuments: [] } },
    { postMoveInManagement: { communicationEntries: [] } },
    { tenancyAgreement: { leaseDocument: { url: "" } } },
    { currentStage: "post_move_in" },
  ])("forbids destructive replacement or indirect promotion through reviewer PATCH: %j", async (input) => {
    await expect(updateApplicationForReviewer(user, "application", input as Parameters<typeof updateApplicationForReviewer>[2])).rejects.toThrow("Forbidden")
    expect(mocks.replace).not.toHaveBeenCalled()
    expect(mocks.sync).not.toHaveBeenCalled()
  })
})
