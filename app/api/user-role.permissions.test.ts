import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import type { AuthUser } from "@/lib/auth"

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  invite: vi.fn(),
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/server/session", () => ({ getSessionUser: mocks.session, createSession: vi.fn() }))
vi.mock("@/lib/server/cases", async (original) => ({
  ...await original<typeof import("@/lib/server/cases")>(),
  getContractorInviteById: mocks.invite,
}))

import { DELETE as accounts, PATCH as updateAccount } from "./admin/users/route"
import { DELETE as meetings } from "./admin/meeting-requests/[id]/route"
import { POST as reset } from "./admin/reset-workspace/route"
import { POST as actAs } from "./admin/act-as/route"
import { POST as registrationReview } from "./admin/registration-reviews/route"
import { PATCH as moderateImage } from "./admin/property-images/route"
import { DELETE as applications } from "./applications/[id]/route"
import { DELETE as depositDocuments } from "./applications/[id]/deposit-documents/[documentId]/route"
import { DELETE as verificationDocuments } from "./applications/[id]/verification-documents/[documentId]/route"
import { DELETE as maintenancePhotos } from "./maintenance/[id]/photos/route"
import { DELETE as stagedImages } from "./properties/images/route"
import { DELETE as properties } from "./properties/[id]/route"
import { DELETE as compliance } from "./properties/[id]/compliance/route"
import { DELETE as certificates } from "./properties/[id]/compliance/documents/[...blobName]/route"
import { DELETE as cases } from "./properties/[id]/cases/[caseId]/route"
import { DELETE as attachments } from "./properties/[id]/cases/[caseId]/attachments/[attachmentId]/route"
import { DELETE as invites, PUT as updateInvite } from "./properties/[id]/cases/[caseId]/invites/[inviteId]/route"
import { DELETE as messages } from "./properties/[id]/cases/[caseId]/messages/[messageId]/route"

const user: AuthUser = { id: "user-1", email: "user@example.com", role: "user", approval_status: "approved", first_name: "Platform", last_name: "User", mobile: "", createdAt: "", updatedAt: "" }
const context = { params: Promise.resolve({ id: "resource", caseId: "case", documentId: "document", attachmentId: "attachment", inviteId: "invite", messageId: "message", blobName: ["certificate"] }) }
const request = (method: string, body: unknown = {}) => new NextRequest("http://localhost/api/test", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })

const deletions = [
  ["accounts and account erasure", accounts], ["meetings and embedded notes/history", meetings],
  ["applications", applications], ["deposit documents", depositDocuments], ["verification documents", verificationDocuments],
  ["maintenance photos", maintenancePhotos], ["staged property images", stagedImages], ["properties", properties],
  ["compliance records", compliance], ["compliance certificates", certificates], ["case archival", cases],
  ["case attachments", attachments], ["case invites", invites], ["case messages", messages],
] as const

describe("User destructive endpoint protection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.session.mockResolvedValue(user)
  })

  it.each(deletions)("forbids User deletion of %s before parsing or accessing resources", async (_name, handler) => {
    const response = await handler(request("DELETE", { userId: "target", accountErasure: true }), context)
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: "Forbidden" })
  })

  it.each(deletions)("requires authentication to delete %s", async (_name, handler) => {
    mocks.session.mockResolvedValue(null)
    expect((await handler(request("DELETE"), context)).status).toBe(401)
  })

  it("forbids bulk reset, account impersonation and destructive image rejection", async () => {
    expect((await reset()).status).toBe(403)
    expect((await actAs(request("POST", { userId: "global-admin" }))).status).toBe(403)
    expect((await moderateImage(request("PATCH", { propertyId: "property", imageId: "image", action: "reject" }))).status).toBe(403)
  })

  it.each([{ role: "admin" }, { role: "user" }, { approval_status: "approved" }, { newEmail: "takeover@example.com" }])("rejects account escalation fields %j", async (input) => {
    const response = await updateAccount(request("PATCH", { userId: "target", ...input }))
    expect(response.status).toBe(403)
  })

  it("does not let a User approve registration reviews", async () => {
    expect((await registrationReview(request("POST", { attemptId: "attempt", decision: "approved", reason: "Grant access" }))).status).toBe(401)
  })

  it("blocks invite decline as an indirect revoke", async () => {
    mocks.invite.mockResolvedValue({ id: "invite", invitedEmail: "other@example.com", status: "pending" })
    expect((await updateInvite(request("PUT", { action: "decline" }), context)).status).toBe(403)
  })
})
