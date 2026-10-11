import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import type { AuthUser } from "@/lib/types/user"

const mocks = vi.hoisted(() => ({ session: vi.fn(), list: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`) } }))
vi.mock("@/lib/server/session", () => ({ getSessionUser: mocks.session }))
vi.mock("@/lib/server/cosmos", () => ({}))
vi.mock("@/lib/server/audit", () => ({}))
vi.mock("@/lib/server/meeting-requests", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/server/meeting-requests")>()
  return { ...original, listDiaryEntries: mocks.list }
})
import DiaryPage from "./page"

const admin: AuthUser = { id: "admin", email: "admin@example.com", first_name: "Admin", last_name: "User", mobile: "", role: "admin", approval_status: "approved", createdAt: "", updatedAt: "" }
const props = { searchParams: Promise.resolve({}) }
describe("Global admin diary page", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-11T23:30:00Z"))
    mocks.session.mockResolvedValue(admin)
    mocks.list.mockResolvedValue({ entries: [], unscheduledCount: 0 })
  })
  afterEach(() => vi.useRealTimers())
  it("requires authentication before reading appointments", async () => {
    mocks.session.mockResolvedValue(null)
    await expect(DiaryPage(props)).rejects.toThrow("redirect:/login")
    expect(mocks.list).not.toHaveBeenCalled()
  })
  it.each(["landlord", "tenant", "applicant", "agent", "builder", "unallocated"] as const)("denies %s access", async (role) => {
    mocks.session.mockResolvedValue({ ...admin, role })
    await expect(DiaryPage(props)).rejects.toThrow("redirect:/dashboard")
    expect(mocks.list).not.toHaveBeenCalled()
  })
  it.each(["pending_approval", "pending_verification"] as const)("denies %s admins", async (approval_status) => {
    mocks.session.mockResolvedValue({ ...admin, approval_status })
    await expect(DiaryPage(props)).rejects.toThrow("redirect:/dashboard")
    expect(mocks.list).not.toHaveBeenCalled()
  })
  it("uses the UK date for today and validates query parameters with visible feedback", async () => {
    const html = renderToStaticMarkup(await DiaryPage({ searchParams: Promise.resolve({ date: "2026-02-30", view: "bad" }) }))
    expect(mocks.list).toHaveBeenCalledWith(admin, "2026-10-12", "month")
    expect(html).toContain("diary date or view was invalid")
  })
  it("loads the chosen period and flags old confirmed meetings without appointment times", async () => {
    mocks.list.mockResolvedValue({ entries: [], unscheduledCount: 2 })
    const html = renderToStaticMarkup(await DiaryPage({ searchParams: Promise.resolve({ date: "2026-12-01", view: "week" }) }))
    expect(mocks.list).toHaveBeenCalledWith(admin, "2026-12-01", "week")
    expect(html).toContain("2 confirmed meeting(s) have no appointment time")
    expect(html).toContain("Manage meeting requests")
  })
  it("does not disguise storage errors as an empty diary", async () => {
    mocks.list.mockRejectedValue(new Error("Cosmos unavailable"))
    await expect(DiaryPage(props)).rejects.toThrow("Cosmos unavailable")
  })
})
