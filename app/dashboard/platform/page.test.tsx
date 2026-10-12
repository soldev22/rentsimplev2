import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AuthUser } from "@/lib/types/user"
import type { PlatformDashboardSummary } from "@/lib/server/platform-dashboard"

const mocks = vi.hoisted(() => ({ session: vi.fn(), summary: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`) } }))
vi.mock("@/lib/server/session", () => ({ getSessionUser: mocks.session }))
vi.mock("@/lib/server/platform-dashboard", () => ({ getPlatformDashboardSummary: mocks.summary }))

import PlatformDashboardPage from "./page"

const admin: AuthUser = {
  id: "admin", email: "admin@example.com", first_name: "Admin", last_name: "User", mobile: "",
  role: "admin", approval_status: "approved", createdAt: "", updatedAt: "",
}
const empty = { total: 0, statuses: [] }
const summary: PlatformDashboardSummary = {
  accounts: { total: 0, roles: [], approvalStatuses: [] },
  properties: empty, applications: empty, maintenanceIssues: empty, cases: empty,
  meetingRequests: { total: 3, statuses: [{ label: "new", count: 2 }, { label: "confirmed", count: 1 }] },
}

describe("Global admin meeting requests dashboard panel", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.session.mockResolvedValue(admin)
    mocks.summary.mockResolvedValue(summary)
  })
  it("shows totals, status counts and a direct link to manage requests", async () => {
    const html = renderToStaticMarkup(await PlatformDashboardPage())
    expect(html).toContain("Meeting requests")
    expect(html).toContain('href="/dashboard/meeting-requests"')
    expect(html).toContain("Manage meeting requests")
    expect(html).toContain('href="/dashboard/crm"')
    expect(html).toContain("Open CRM")
    expect(html).toContain("confirmed")
    expect(html).toContain(">3</p>")
    expect(mocks.summary).toHaveBeenCalledOnce()
  })
  it("keeps the management link available when no meetings exist", async () => {
    mocks.summary.mockResolvedValue({ ...summary, meetingRequests: empty })
    const html = renderToStaticMarkup(await PlatformDashboardPage())
    expect(html).toContain("Meeting requests")
    expect(html).toContain("Manage meeting requests")
    expect(html).toContain(">0</p>")
  })
  it("redirects signed-out visitors without loading counts", async () => {
    mocks.session.mockResolvedValue(null)
    await expect(PlatformDashboardPage()).rejects.toThrow("redirect:/login")
    expect(mocks.summary).not.toHaveBeenCalled()
  })
  it.each(["landlord", "tenant", "applicant", "agent", "builder"] as const)("denies %s access before querying counts", async (role) => {
    mocks.session.mockResolvedValue({ ...admin, role })
    await expect(PlatformDashboardPage()).rejects.toThrow("redirect:/dashboard")
    expect(mocks.summary).not.toHaveBeenCalled()
  })
  it.each(["pending_approval", "pending_verification"] as const)("denies %s Global admins", async (approval_status) => {
    mocks.session.mockResolvedValue({ ...admin, approval_status })
    await expect(PlatformDashboardPage()).rejects.toThrow("redirect:/waiting")
    expect(mocks.summary).not.toHaveBeenCalled()
  })
})
