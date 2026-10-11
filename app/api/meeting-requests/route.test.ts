import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(), create: vi.fn(), notify: vi.fn(),
}))
vi.mock("@/lib/server/auth-security", () => ({
  getClientIpAddress: () => "203.0.113.1", registerRateLimitAttempt: mocks.rateLimit,
}))
vi.mock("@/lib/server/registration-authenticity", () => ({ hashRegistrationIdentifier: (value: string) => `hash:${value}` }))
vi.mock("@/lib/server/meeting-requests", () => ({ createMeetingRequest: mocks.create }))
vi.mock("@/lib/server/meeting-request-notifications", () => ({ sendMeetingRequestNotifications: mocks.notify }))

import { POST } from "@/app/api/meeting-requests/route"

const valid = {
  firstName: "Taylor", lastName: "Landlord", phone: "07739870670", email: "TAYLOR@example.com",
  numberOfProperties: 2, town: "Glasgow", preferredDays: ["Mon"], preferredTime: "morning", meetingType: "phone",
}
function request(body: unknown = valid) {
  return new Request("http://localhost/api/meeting-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
}

describe("public meeting request API", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.rateLimit.mockResolvedValue({ allowed: true })
    mocks.create.mockResolvedValue({ ...valid, id: "request-1", notes: "", status: "new" })
    mocks.notify.mockResolvedValue({ confirmationSent: true, adminsNotified: true })
  })
  afterEach(() => vi.restoreAllMocks())
  it("stores only validated fields, then sends notifications and returns a minimal confirmation", async () => {
    const response = await POST(request({ ...valid, website: "", status: "confirmed", id: "injected" }))
    expect(response.status).toBe(201)
    expect(mocks.create).toHaveBeenCalledWith({ ...valid, email: "taylor@example.com", notes: "" })
    expect(mocks.create.mock.invocationCallOrder[0]).toBeLessThan(mocks.notify.mock.invocationCallOrder[0])
    expect(await response.json()).toEqual({ id: "request-1", confirmationSent: true, message: expect.stringContaining("received") })
    expect(mocks.rateLimit).toHaveBeenCalledWith(expect.objectContaining({ action: "meeting_request", scope: "ip", identifier: "hash:203.0.113.1", maxAttempts: 5 }))
    expect(mocks.rateLimit).toHaveBeenCalledWith(expect.objectContaining({ action: "meeting_request", scope: "email", identifier: "hash:taylor@example.com", maxAttempts: 3 }))
  })
  it("rejects the honeypot without saving or notifying", async () => {
    const response = await POST(request({ ...valid, website: "bot" }))
    expect(response.status).toBe(400)
    expect((await response.json()).errors.website).toBeDefined()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.notify).not.toHaveBeenCalled()
  })
  it("rejects invalid field types on the server", async () => {
    const response = await POST(request({ ...valid, firstName: {}, preferredDays: ["Sun"] }))
    expect(response.status).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it.each(["ip", "email"])("rejects %s rate-limited requests with Retry-After", async (scope) => {
    if (scope === "email") mocks.rateLimit.mockResolvedValueOnce({ allowed: true })
    mocks.rateLimit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 120 })
    const response = await POST(request())
    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("120")
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it.each(["failed", "thrown"])("keeps the successful response when a notification is %s", async (failure) => {
    if (failure === "thrown") mocks.notify.mockRejectedValue(new Error("provider down"))
    else mocks.notify.mockResolvedValue({ confirmationSent: false, adminsNotified: false })
    const response = await POST(request())
    expect(response.status).toBe(201)
    expect(mocks.create).toHaveBeenCalledOnce()
    expect(await response.json()).toEqual({ id: "request-1", confirmationSent: false, message: expect.stringContaining("safely stored") })
  })
  it("fails explicitly if storage fails and never sends notifications", async () => {
    mocks.create.mockRejectedValue(new Error("database down"))
    const response = await POST(request())
    expect(response.status).toBe(500)
    expect(mocks.notify).not.toHaveBeenCalled()
  })
  it("rejects malformed JSON", async () => {
    const response = await POST(new Request("http://localhost/api/meeting-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }))
    expect(response.status).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it("rejects non-JSON, cross-origin and oversized requests", async () => {
    expect((await POST(new Request("http://localhost/api/meeting-requests", { method: "POST" }))).status).toBe(415)
    expect((await POST(new Request("http://localhost/api/meeting-requests", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://other.example" }, body: JSON.stringify(valid) }))).status).toBe(403)
    expect((await POST(request({ ...valid, notes: "x".repeat(16000) }))).status).toBe(413)
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
