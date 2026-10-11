import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AuthUser } from "@/lib/auth"
const mocks = vi.hoisted(() => ({ session: vi.fn(), params: new URLSearchParams("mode=register&role=landlord"), videoUrl: "" }))
vi.mock("@/lib/public-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/public-config")>()
  return { ...actual, get LANDLORD_VIDEO_URL() { return mocks.videoUrl } }
})
vi.mock("@/lib/server/session", () => ({ getSessionUser: mocks.session }))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => mocks.params,
}))
import WaitingPage from "./page"
import LoginPage from "@/app/login/[[...rest]]/page"
import LandlordsPage from "@/app/(public)/landlords/page"
import { MeetingRequestProvider } from "@/components/forms/MeetingRequestPanel"
import AdminUserManager, { sortUsers } from "@/components/forms/AdminUserManager"
import { CONTACT_PHONE, CONTACT_PHONE_HREF } from "@/lib/public-config"

const user: AuthUser = { id: "prospect", first_name: "Test", last_name: "Landlord", email: "prospect@example.com", mobile: "", role: "unallocated", requestedRole: "landlord", approval_status: "pending_approval", createdAt: "2026-01-01", updatedAt: "2026-01-01" }
describe("Landlord journey UI", () => {
  beforeEach(() => {
    mocks.session.mockResolvedValue(user)
    mocks.params = new URLSearchParams("mode=register&role=landlord")
    mocks.videoUrl = ""
  })
  it("shows Landlord-specific waiting wording and phone, without changing generic waiting", async () => {
    const html = renderToStaticMarkup(await WaitingPage())
    expect(html).toContain("reviewing your application")
    expect(html).toContain(CONTACT_PHONE_HREF)
    expect(html).toContain(CONTACT_PHONE)
    mocks.session.mockResolvedValue({ ...user, requestedRole: undefined })
    const generic = renderToStaticMarkup(await WaitingPage())
    expect(generic).toContain("Account Pending Approval")
    expect(generic).not.toContain("reviewing your application")
  })
  it("continues asking unverified Landlord applicants to verify their email", async () => {
    mocks.session.mockResolvedValue({ ...user, approval_status: "pending_verification" })
    const html = renderToStaticMarkup(await WaitingPage())
    expect(html).toContain("Verify Your Email")
    expect(html).not.toContain("reviewing your application")
  })
  it("preselects Landlord signup from the sharing link and never offers Global admin", () => {
    const html = renderToStaticMarkup(<LoginPage />)
    expect(html).toContain('<option value="landlord" selected="">Landlord</option>')
    expect(html).not.toContain('<option value="admin"')
    expect(html).not.toContain('<option value="unallocated"')
    mocks.params = new URLSearchParams("mode=register&role=admin")
    expect(renderToStaticMarkup(<LoginPage />)).not.toContain('<option value="admin"')
  })
  it("reuses two contact action groups and hides the video without a configured URL", () => {
    const html = renderToStaticMarkup(<MeetingRequestProvider><LandlordsPage /></MeetingRequestProvider>)
    expect(html.match(/Create an account/g)).toHaveLength(2)
    expect(html.match(/Request a meeting/g)).toHaveLength(2)
    expect(html.match(/mode=register&amp;role=landlord/g)).toHaveLength(2)
    expect(html).toContain(CONTACT_PHONE_HREF)
    expect(html).not.toContain("<iframe")
  })
  it("shows a labelled lazy responsive video when an embed URL is configured", () => {
    mocks.videoUrl = "https://example.com/embed/onboarding"
    const html = renderToStaticMarkup(<MeetingRequestProvider><LandlordsPage /></MeetingRequestProvider>)
    expect(html).toContain('src="https://example.com/embed/onboarding"')
    expect(html).toContain('title="RentSimple Landlord onboarding"')
    expect(html).toContain('loading="lazy"')
    expect(html).toContain("aspect-video w-full")
  })
  it("prioritises pending Landlord applications, and displays badges and the right approval action", () => {
    const recent = { ...user, id: "recent", email: "recent@example.com", requestedRole: undefined, createdAt: "2026-02-01" }
    const approved = { ...user, id: "approved", email: "approved@example.com", role: "landlord" as const, approval_status: "approved" as const, createdAt: "2026-03-01" }
    expect(sortUsers([recent, approved, user]).map((item) => item.id)).toEqual(["prospect", "approved", "recent"])
    const html = renderToStaticMarkup(<AdminUserManager initialUsers={[recent, user]} initialAgents={[]} currentUserEmail="admin@example.com" />)
    expect(html).toContain("Landlord application")
    expect(html).toContain("Approve as Landlord")
  })
})
