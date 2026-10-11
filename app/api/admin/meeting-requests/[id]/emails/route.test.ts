import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AuthUser } from "@/lib/types/user"
vi.mock("server-only", () => ({}))
const mocks = vi.hoisted(() => ({ session: vi.fn(), send: vi.fn(), limit: vi.fn() }))
vi.mock("@/lib/server/session", () => ({ getSessionUser: mocks.session }))
vi.mock("@/lib/server/auth-security", () => ({ registerRateLimitAttempt: mocks.limit }))
vi.mock("@/lib/server/meeting-email", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/server/meeting-email")>()
  return { ...original, sendMeetingEmail: mocks.send }
})
import { POST } from "./route"
import { MeetingEmailError } from "@/lib/server/meeting-email"

const admin: AuthUser = { id: "admin", email: "admin@example.com", first_name: "Admin", last_name: "User", mobile: "", role: "admin", approval_status: "approved", createdAt: "", updatedAt: "" }
const id = "11111111-1111-4111-8111-111111111111"
const context = { params: Promise.resolve({ id }) }
const input = { id: "22222222-2222-4222-8222-222222222222", subject: " Meeting ", text: " Hello " }
const request = (body: unknown = input, origin = "http://localhost") => new Request(`http://localhost/api/admin/meeting-requests/${id}/emails`, {
  method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body),
})

describe("admin meeting email API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.session.mockResolvedValue(admin)
    mocks.send.mockResolvedValue({ id: input.id, status: "sent" })
    mocks.limit.mockResolvedValue({ allowed: true })
  })
  afterEach(() => vi.restoreAllMocks())
  it.each([null, { ...admin, role: "landlord" }, { ...admin, role: "agent" }, { ...admin, approval_status: "pending_approval" }])("requires an approved Global admin", async (user) => {
    mocks.session.mockResolvedValue(user)
    expect((await POST(request(), context)).status).toBe(user ? 403 : 401)
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it("uses the authenticated actor and strips forged recipient and identity fields", async () => {
    const response = await POST(request({ ...input, to: "attacker@example.com", performedBy: "forged" }), context)
    expect(response.status).toBe(200)
    expect(mocks.send).toHaveBeenCalledWith(admin, id, { ...input, subject: "Meeting", text: "Hello" })
  })
  it("rejects cross-origin sends and malformed messages", async () => {
    expect((await POST(request(input, "https://attacker.example"), context)).status).toBe(403)
    expect((await POST(request({ ...input, subject: "Hi\nBcc: attacker@example.com" }), context)).status).toBe(400)
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it("rate limits outgoing attempts without sending", async () => {
    mocks.limit.mockResolvedValue({ allowed: false, retryAfterSeconds: 120 })
    const response = await POST(request(), context)
    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("120")
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it.each([["not_found", 404], ["configuration", 503], ["conflict", 409], ["thread_full", 409]] as const)("reports %s failures", async (code, status) => {
    mocks.send.mockRejectedValue(new MeetingEmailError(code, "Unable to send"))
    expect((await POST(request(), context)).status).toBe(status)
  })
  it("returns the actual failed status instead of reporting that an email was sent", async () => {
    mocks.send.mockResolvedValue({ id: input.id, status: "failed" })
    expect(await (await POST(request(), context)).json()).toEqual({ message: { id: input.id, status: "failed" } })
  })
})
