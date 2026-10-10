import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { isSmsConfigured, sendSms } from "@/lib/server/sms"

const SMS_ENV_KEYS = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER", "TWILIO_MESSAGING_SERVICE_SID"]

describe("sendSms", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    for (const key of SMS_ENV_KEYS) vi.stubEnv(key, "")
    vi.stubGlobal("fetch", fetchMock)
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    fetchMock.mockReset()
  })

  it("skips when Twilio is not configured", async () => {
    expect(isSmsConfigured()).toBe(false)
    const result = await sendSms("+447700900123", "Hello")
    expect(result.status).toBe("skipped")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("posts to the Twilio Messages API with basic auth and a from number", async () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "AC123")
    vi.stubEnv("TWILIO_AUTH_TOKEN", "secret")
    vi.stubEnv("TWILIO_FROM_NUMBER", "+447700900000")
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({ sid: "SM1" }) })

    const result = await sendSms("+447700900123", "Hello")

    expect(result).toMatchObject({ status: "sent", messageId: "SM1" })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json")
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from("AC123:secret").toString("base64")}`)
    const params = init.body as URLSearchParams
    expect(params.get("To")).toBe("+447700900123")
    expect(params.get("Body")).toBe("Hello")
    expect(params.get("From")).toBe("+447700900000")
    expect(params.get("MessagingServiceSid")).toBeNull()
  })

  it("prefers a Messaging Service when configured", async () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "AC123")
    vi.stubEnv("TWILIO_AUTH_TOKEN", "secret")
    vi.stubEnv("TWILIO_FROM_NUMBER", "+447700900000")
    vi.stubEnv("TWILIO_MESSAGING_SERVICE_SID", "MG1")
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({ sid: "SM2" }) })

    await sendSms("+447700900123", "Hello")

    const params = fetchMock.mock.calls[0][1].body as URLSearchParams
    expect(params.get("MessagingServiceSid")).toBe("MG1")
    expect(params.get("From")).toBeNull()
  })

  it("reports Twilio errors as failed", async () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "AC123")
    vi.stubEnv("TWILIO_AUTH_TOKEN", "secret")
    vi.stubEnv("TWILIO_FROM_NUMBER", "+447700900000")
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ code: 21211, message: "Invalid 'To' Phone Number" }),
    })

    const result = await sendSms("bad", "Hello")

    expect(result.status).toBe("failed")
    expect(result.detail).toContain("Invalid 'To' Phone Number")
  })
})
