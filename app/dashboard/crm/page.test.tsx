import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AuthUser } from "@/lib/types/user"

const mocks = vi.hoisted(() => ({ session: vi.fn(), list: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`) }, useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("@/lib/server/session", () => ({ getSessionUser: mocks.session }))
vi.mock("@/lib/server/cosmos", () => ({}))
vi.mock("@/lib/server/audit", () => ({}))
vi.mock("@/lib/server/crm", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/server/crm")>()
  return { ...original, listCrmContacts: mocks.list }
})
import CrmPage from "./page"

const admin: AuthUser = { id: "admin", email: "admin@example.com", first_name: "Admin", last_name: "User", mobile: "", role: "admin", approval_status: "approved", createdAt: "", updatedAt: "" }

describe("CRM dashboard page", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.session.mockResolvedValue(admin)
    mocks.list.mockResolvedValue([{
      key: "sam@example.com", email: "sam@example.com", firstName: "Sam", lastName: "Shaw", phone: "", company: "", town: "",
      manual: null, meetings: [{ id: "m1", status: "done", createdAt: "2026-02-01T00:00:00.000Z", done: true, doneAt: "2026-02-05T00:00:00.000Z" }],
      accounts: [], stage: "Prospect", stageReasons: ["Meeting request m1 is marked done."],
    }])
  })
  it("renders contacts with their stage, reasons and meeting links", async () => {
    const html = renderToStaticMarkup(await CrmPage())
    expect(html).toContain("CRM")
    expect(html).toContain("Prospect")
    expect(html).toContain("Meeting request m1 is marked done.")
    expect(html).toContain('href="/dashboard/meeting-requests?request=m1"')
  })
  it("redirects signed-out visitors without loading contacts", async () => {
    mocks.session.mockResolvedValue(null)
    await expect(CrmPage()).rejects.toThrow("redirect:/login")
    expect(mocks.list).not.toHaveBeenCalled()
  })
  it.each([
    { role: "landlord" }, { role: "tenant" }, { role: "applicant" }, { role: "agent" }, { role: "builder" },
    { role: "user", approval_status: "pending_approval" }, { role: "admin", approval_status: "pending_verification" },
  ])("redirects %o away without loading contacts", async (overrides) => {
    mocks.session.mockResolvedValue({ ...admin, ...overrides })
    await expect(CrmPage()).rejects.toThrow("redirect:/dashboard")
    expect(mocks.list).not.toHaveBeenCalled()
  })
})
