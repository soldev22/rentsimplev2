import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getClientIpAddress: vi.fn(),
  registerRateLimitAttempt: vi.fn(),
  assessRegistration: vi.fn(),
  getDeviceFingerprint: vi.fn(),
  hashRegistrationIdentifier: vi.fn(),
  countRecentRegistrationAttempts: vi.fn(),
  recordRegistrationAttempt: vi.fn(),
  createUser: vi.fn(),
  sendVerificationForUser: vi.fn(),
}))

vi.mock("@/lib/server/auth-security", () => ({
  getClientIpAddress: mocks.getClientIpAddress,
  registerRateLimitAttempt: mocks.registerRateLimitAttempt,
}))
vi.mock("@/lib/server/registration-authenticity", () => ({
  assessRegistration: mocks.assessRegistration,
  getDeviceFingerprint: mocks.getDeviceFingerprint,
  hashRegistrationIdentifier: mocks.hashRegistrationIdentifier,
}))
vi.mock("@/lib/server/registration-attempts", () => ({
  countRecentRegistrationAttempts: mocks.countRecentRegistrationAttempts,
  recordRegistrationAttempt: mocks.recordRegistrationAttempt,
}))
vi.mock("@/lib/server/users", () => ({
  createUser: mocks.createUser,
  sendVerificationForUser: mocks.sendVerificationForUser,
}))

import { POST } from "@/app/api/auth/register/route"

describe("registration route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getClientIpAddress.mockReturnValue("203.0.113.10")
    mocks.registerRateLimitAttempt.mockResolvedValue({ allowed: true, retryAfterSeconds: null })
    mocks.assessRegistration.mockReturnValue({
      emailHash: "email-hash",
      ipHash: "ip-hash",
      deviceFingerprint: "device-hash",
      trustScore: 100,
      decision: "approved",
      riskFactors: [],
    })
    mocks.getDeviceFingerprint.mockReturnValue("device-hash")
    mocks.hashRegistrationIdentifier.mockReturnValue("ip-hash")
    mocks.countRecentRegistrationAttempts.mockResolvedValue(0)
    mocks.recordRegistrationAttempt.mockResolvedValue({ id: "attempt-1" })
    mocks.createUser.mockResolvedValue({ user: { id: "new@example.com" }, error: null })
    mocks.sendVerificationForUser.mockResolvedValue({
      verificationUrl: "http://localhost/login?mode=verify&token=test",
      delivery: { status: "skipped" },
    })
  })

  it("returns a readable JSON error when a registration dependency fails", async () => {
    mocks.registerRateLimitAttempt.mockRejectedValue(Object.assign(new Error("sensitive detail"), { code: 503 }))
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const response = await POST(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: "Taylor",
          lastName: "Tenant",
          email: "new@example.com",
          password: "Password123!",
        }),
      }),
    )

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: "We couldn't complete registration because of a server problem. Please try again shortly.",
    })
    expect(errorSpy).toHaveBeenCalledWith("Registration request failed.", {
      stage: "ip_rate_limit",
      code: "503",
    })
    errorSpy.mockRestore()
  })
})
