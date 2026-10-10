import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const sendEmail = vi.fn()
vi.mock("@/lib/server/email", () => ({ sendEmail: (...args: unknown[]) => sendEmail(...args) }))

import { sendLandlordTermsUpdatedEmail } from "@/lib/server/auth-email"

describe("auth emails", () => {
  beforeEach(() => {
    sendEmail.mockReset()
    sendEmail.mockResolvedValue({ status: "sent", detail: "ok" })
  })

  it("sends a clickable link in the HTML body and the raw URL in the text body", async () => {
    const termsUrl = "http://localhost:3000/landlord/terms?a=1&b=2"

    await sendLandlordTermsUpdatedEmail("landlord@example.com", "Land", termsUrl)

    const message = sendEmail.mock.calls[0][0]
    expect(message.text).toContain(termsUrl)
    expect(message.html).toContain('href="http://localhost:3000/landlord/terms?a=1&amp;b=2"')
    expect(message.html).toContain("Review updated terms")
    expect(message.html).toContain("Hi Land,")
  })
})
