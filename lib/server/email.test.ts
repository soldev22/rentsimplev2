import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { nodemailerSend, acsBeginSend } = vi.hoisted(() => ({
  nodemailerSend: vi.fn(),
  acsBeginSend: vi.fn(),
}))

vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: nodemailerSend }) },
}))

vi.mock("@azure/communication-email", () => ({
  EmailClient: class {
    beginSend = acsBeginSend
  },
}))

vi.mock("@azure/identity", () => ({ DefaultAzureCredential: class {} }))

import { getConfiguredEmailProvider, sendEmail } from "@/lib/server/email"

const EMAIL_ENV_KEYS = [
  "POSTMARK_SERVER_TOKEN",
  "POSTMARK_FROM",
  "POSTMARK_MESSAGE_STREAM",
  "ACS_EMAIL_CONNECTION_STRING",
  "ACS_EMAIL_ENDPOINT",
  "ACS_EMAIL_SENDER",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
]

describe("sendEmail", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    for (const key of EMAIL_ENV_KEYS) vi.stubEnv(key, "")
    vi.stubGlobal("fetch", fetchMock)
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    fetchMock.mockReset()
    nodemailerSend.mockReset()
    acsBeginSend.mockReset()
  })

  it("skips when no provider is configured", async () => {
    expect(getConfiguredEmailProvider()).toBeNull()
    const result = await sendEmail({ to: "landlord@example.com", subject: "Hi", text: "Hello" })
    expect(result.status).toBe("skipped")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("sends through Postmark with the expected payload", async () => {
    vi.stubEnv("POSTMARK_SERVER_TOKEN", "pm-token")
    vi.stubEnv("POSTMARK_FROM", "no-reply@rentsimple.co.uk")
    vi.stubEnv("SMTP_HOST", "smtp.example.com")
    vi.stubEnv("SMTP_USER", "user")
    vi.stubEnv("SMTP_PASS", "pass")
    vi.stubEnv("SMTP_FROM", "smtp@example.com")
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ErrorCode: 0, Message: "OK", MessageID: "pm-123" }),
    })

    expect(getConfiguredEmailProvider()).toBe("postmark")

    const result = await sendEmail({
      fromName: "RentSimple",
      to: "landlord@example.com",
      cc: ["admin@example.com"],
      subject: "Welcome",
      text: "Hello",
      html: "<p>Hello</p>",
      tag: "landlord-welcome",
      attachments: [{ filename: "a.pdf", content: Buffer.from("pdf"), contentType: "application/pdf" }],
    })

    expect(result).toMatchObject({ status: "sent", provider: "postmark", messageId: "pm-123" })
    expect(nodemailerSend).not.toHaveBeenCalled()

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://api.postmarkapp.com/email")
    expect(init.headers["X-Postmark-Server-Token"]).toBe("pm-token")
    expect(JSON.parse(init.body)).toEqual({
      From: '"RentSimple" <no-reply@rentsimple.co.uk>',
      To: "landlord@example.com",
      Cc: "admin@example.com",
      Subject: "Welcome",
      TextBody: "Hello",
      HtmlBody: "<p>Hello</p>",
      Tag: "landlord-welcome",
      MessageStream: "outbound",
      Attachments: [{ Name: "a.pdf", Content: Buffer.from("pdf").toString("base64"), ContentType: "application/pdf" }],
    })
  })

  it("accepts a configured Postmark sender that already includes a display name", async () => {
    vi.stubEnv("POSTMARK_SERVER_TOKEN", "pm-token")
    vi.stubEnv("POSTMARK_FROM", "RentSimple <admin@rentsimple.co.uk>")
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ErrorCode: 0, Message: "OK", MessageID: "pm-456" }),
    })

    await sendEmail({ fromName: "RentSimple Team", to: "landlord@example.com", subject: "Hi", text: "Hi" })
    await sendEmail({ to: "landlord@example.com", subject: "Hi", text: "Hi" })

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).From).toBe('"RentSimple Team" <admin@rentsimple.co.uk>')
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).From).toBe('"RentSimple" <admin@rentsimple.co.uk>')
  })

  it("reports a Postmark rejection as failed without falling back", async () => {
    vi.stubEnv("POSTMARK_SERVER_TOKEN", "pm-token")
    vi.stubEnv("POSTMARK_FROM", "no-reply@rentsimple.co.uk")
    vi.stubEnv("SMTP_HOST", "smtp.example.com")
    vi.stubEnv("SMTP_USER", "user")
    vi.stubEnv("SMTP_PASS", "pass")
    vi.stubEnv("SMTP_FROM", "smtp@example.com")
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ ErrorCode: 400, Message: "Sender signature not confirmed" }),
    })

    const result = await sendEmail({ to: "landlord@example.com", subject: "Hi", text: "Hello" })

    expect(result.status).toBe("failed")
    expect(result.detail).toContain("Sender signature not confirmed")
    expect(nodemailerSend).not.toHaveBeenCalled()
  })

  it("falls back to SMTP configuration when Postmark is not configured", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.com")
    vi.stubEnv("SMTP_USER", "user")
    vi.stubEnv("SMTP_PASS", "pass")
    vi.stubEnv("SMTP_FROM", "smtp@example.com")
    nodemailerSend.mockResolvedValue({ messageId: "smtp-1", accepted: ["landlord@example.com"], rejected: [] })

    expect(getConfiguredEmailProvider()).toBe("smtp")
    const result = await sendEmail({ to: "landlord@example.com", subject: "Hi", text: "Hello" })

    expect(result.status).toBe("sent")
    expect(result.provider).toBe("smtp")
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
