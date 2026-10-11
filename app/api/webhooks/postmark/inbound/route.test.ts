import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("server-only", () => ({}))
const mocks = vi.hoisted(() => ({ parse: vi.fn(), receive: vi.fn(), auth: vi.fn() }))
vi.mock("@/lib/server/meeting-email", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/server/meeting-email")>()
  return { ...original, parseInboundMeetingEmail: mocks.parse, receiveMeetingEmail: mocks.receive, isPostmarkInboundAuthenticated: mocks.auth }
})
import { POST } from "./route"
import { MeetingEmailError } from "@/lib/server/meeting-email"
const request = (body = "{}") => new Request("https://rent.example/api/webhooks/postmark/inbound", {
  method: "POST", headers: { "Content-Type": "application/json", Authorization: "Basic test" }, body,
})

describe("Postmark inbound webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("POSTMARK_INBOUND_WEBHOOK_SECRET", "test-secret-that-is-at-least-32-characters")
    mocks.auth.mockReturnValue(true)
    mocks.parse.mockReturnValue({ token: "token" })
    mocks.receive.mockResolvedValue({ duplicate: false })
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })
  it("requires authentication before parsing or storing anything", async () => {
    mocks.auth.mockReturnValue(false)
    expect((await POST(request())).status).toBe(403)
    expect(mocks.parse).not.toHaveBeenCalled()
    expect(mocks.receive).not.toHaveBeenCalled()
  })
  it("fails closed with missing webhook configuration", async () => {
    vi.stubEnv("POSTMARK_INBOUND_WEBHOOK_SECRET", "")
    expect((await POST(request())).status).toBe(503)
    expect(mocks.receive).not.toHaveBeenCalled()
  })
  it("acknowledges saved replies and duplicate retries", async () => {
    expect(await (await POST(request())).json()).toEqual({ received: true, duplicate: false })
    mocks.receive.mockResolvedValue({ duplicate: true })
    expect(await (await POST(request())).json()).toEqual({ received: true, duplicate: true })
  })
  it("returns 503 rather than losing a reply when persistence fails", async () => {
    mocks.receive.mockRejectedValue(new Error("Cosmos unavailable"))
    expect((await POST(request())).status).toBe(503)
  })
  it.each(["invalid", "not_found"] as const)("rejects %s replies with a permanent response", async (code) => {
    mocks.receive.mockRejectedValue(new MeetingEmailError(code, "Sensitive reason"))
    const response = await POST(request())
    expect(response.status).toBe(403)
    expect(JSON.stringify(await response.json())).not.toContain("Sensitive")
  })
  it("rejects unsupported routing and malformed JSON", async () => {
    mocks.parse.mockReturnValue(null)
    expect((await POST(request())).status).toBe(403)
    expect((await POST(request("{"))).status).toBe(400)
    expect(mocks.receive).not.toHaveBeenCalled()
  })
  it("rejects oversized streamed payloads before parsing", async () => {
    expect((await POST(request("a".repeat(10 * 1024 * 1024 + 1)))).status).toBe(413)
    expect(mocks.parse).not.toHaveBeenCalled()
  })
})
