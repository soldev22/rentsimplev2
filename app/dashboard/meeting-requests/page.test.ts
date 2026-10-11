import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AuthUser } from "@/lib/types/user"

const mocks = vi.hoisted(() => ({ session: vi.fn(), list: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`) } }))
vi.mock("@/lib/server/session", () => ({ getSessionUser: mocks.session }))
vi.mock("@/lib/server/cosmos", () => ({}))
vi.mock("@/lib/server/audit", () => ({}))
vi.mock("@/lib/server/meeting-requests", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/server/meeting-requests")>()
  return { ...original, listMeetingRequests: mocks.list }
})
import MeetingRequestsPage from "@/app/dashboard/meeting-requests/page"

const admin: AuthUser = { id: "admin", email: "admin@example.com", first_name: "Admin", last_name: "User", mobile: "", role: "admin", approval_status: "approved", createdAt: "", updatedAt: "" }
const props = { searchParams: Promise.resolve({}) }

describe("meeting request dashboard access", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.session.mockResolvedValue(admin)
  })
  it("redirects anonymous visitors without loading requests", async () => {
    mocks.session.mockResolvedValue(null)
    await expect(MeetingRequestsPage(props)).rejects.toThrow("redirect:/login")
    expect(mocks.list).not.toHaveBeenCalled()
  })
  it.each(["landlord", "tenant", "applicant", "agent", "builder", "unallocated"] as const)("denies %s without loading personal data", async (role) => {
    mocks.session.mockResolvedValue({ ...admin, role })
    await expect(MeetingRequestsPage(props)).rejects.toThrow("redirect:/dashboard")
    expect(mocks.list).not.toHaveBeenCalled()
  })
  it.each(["pending_approval", "pending_verification"] as const)("denies %s admins", async (approval_status) => {
    mocks.session.mockResolvedValue({ ...admin, approval_status })
    await expect(MeetingRequestsPage(props)).rejects.toThrow("redirect:/dashboard")
    expect(mocks.list).not.toHaveBeenCalled()
  })
  it("allows approved Global admins to load requests", async () => {
    mocks.list.mockRejectedValue(new Error("test reached authorized storage"))
    await expect(MeetingRequestsPage(props)).rejects.toThrow("test reached authorized storage")
    expect(mocks.list).toHaveBeenCalledWith(admin, 1)
  })
})
