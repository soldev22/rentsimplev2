import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { MeetingRequest } from "@/lib/meeting-requests"
import type { AuthUser } from "@/lib/types/user"

vi.mock("server-only", () => ({}))
const mocks = vi.hoisted(() => ({
  records: new Map<string, MeetingRequest & { _etag?: string }>(),
  version: 0, send: vi.fn(), replace: vi.fn(), provider: vi.fn(),
}))
vi.mock("@/lib/server/email", () => ({
  sendEmail: mocks.send,
  getConfiguredEmailProvider: mocks.provider,
  getPlatformFromAddress: () => "hello@rentsimple.co.uk",
  htmlToPlainText: (html: string) => html.replace(/<[^>]*>/g, "").trim(),
}))
vi.mock("@/lib/server/cosmos", () => ({
  getMeetingRequestsContainer: async () => ({
    item: (id: string) => ({
      read: async () => ({ resource: mocks.records.has(id) ? structuredClone(mocks.records.get(id)) : undefined }),
      replace: async (record: MeetingRequest, options: { accessCondition: { condition: string } }) => {
        mocks.replace(record, options)
        if (options.accessCondition.condition !== mocks.records.get(id)?._etag) throw { code: 412 }
        mocks.records.set(id, { ...structuredClone(record), _etag: String(++mocks.version) })
      },
    }),
    items: { query: ({ parameters }: { parameters: { name: string; value: string }[] }) => ({
      fetchAll: async () => ({
        resources: [...mocks.records.values()].filter((record) => record.emailReplyToken === parameters.find((parameter) => parameter.name === "@token")?.value).map(({ id }) => ({ id })),
      }),
    }) },
  }),
}))

import { getMeetingEmailConfigurationError, isPostmarkInboundAuthenticated, parseInboundMeetingEmail, receiveMeetingEmail, sendMeetingConfirmationEmail, sendMeetingEmail } from "./meeting-email"
import { validateMeetingEmail } from "@/lib/meeting-requests"

const id = "11111111-1111-4111-8111-111111111111"
const attemptId = "22222222-2222-4222-8222-222222222222"
const token = "a".repeat(24)
const inbound = "b".repeat(32) + "@inbound.postmarkapp.com"
const secret = "test-secret-that-is-at-least-32-characters"
const admin: AuthUser = { id: "admin", email: "admin@example.com", first_name: "Admin", last_name: "User", mobile: "", role: "admin", approval_status: "approved", createdAt: "", updatedAt: "" }
const request: MeetingRequest = {
  id, type: "meeting_request", firstName: "Test", lastName: "Landlord", phone: "07700000000",
  email: "prospect@example.com", numberOfProperties: 1, town: "Glasgow", preferredDays: ["Mon"], preferredTime: "morning", meetingType: "phone", notes: "Private notes",
  status: "new", createdAt: "2026-10-11T09:00:00.000Z", updatedAt: "2026-10-11T09:00:00.000Z", adminNotes: [], auditEvents: [],
  emailReplyToken: token, emailMessages: [],
}
const input = { id: attemptId, subject: "Agree a meeting", text: "Is Monday morning suitable?" }
const payload = () => ({
  MessageStream: "inbound", MessageID: "33333333-3333-4333-8333-333333333333",
  FromFull: { Email: request.email }, OriginalRecipient: inbound.replace("@", `+m-${token}@`),
  Subject: "Re: Agree a meeting", StrippedTextReply: "Yes, Monday works.", TextBody: "Yes, Monday works.\nOriginal email",
})

describe("meeting email persistence and routing", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.replace.mockReset()
    mocks.records.clear()
    mocks.version = 1
    mocks.records.set(id, { ...structuredClone(request), _etag: "1" })
    mocks.send.mockResolvedValue({ status: "sent", messageId: "postmark-message" })
    mocks.provider.mockReturnValue("postmark")
    vi.stubEnv("POSTMARK_MEETING_INBOUND_ADDRESS", inbound)
    vi.stubEnv("POSTMARK_INBOUND_WEBHOOK_SECRET", secret)
  })
  afterEach(() => vi.unstubAllEnvs())

  it("persists an outbound attempt before sending, then records the reply on the same meeting", async () => {
    mocks.send.mockImplementation(async (message) => {
      expect(mocks.records.get(id)?.emailMessages?.[0].status).toBe("sending")
      expect(message.to).toBe(request.email)
      expect(message.replyTo).toBe(payload().OriginalRecipient)
      expect(message.replyTo.split("@")[0].length).toBeLessThanOrEqual(64)
      expect(message.text).not.toContain("Private notes")
      return { status: "sent", messageId: "postmark-message" }
    })
    const sent = await sendMeetingEmail(admin, id, input)
    expect(sent).toMatchObject({ direction: "outbound", status: "sent", performedBy: admin.email, providerMessageId: "postmark-message" })
    await receiveMeetingEmail(parseInboundMeetingEmail(payload())!)
    expect(mocks.records.get(id)?.emailMessages).toHaveLength(2)
    expect(mocks.records.get(id)?.emailMessages?.[1]).toMatchObject({ direction: "inbound", text: "Yes, Monday works.", status: "received" })
    expect(mocks.records.get(id)?.status).toBe("new")
    expect(mocks.records.get(id)?.notes).toBe("Private notes")
  })

  it("never sends the same attempt twice, including concurrent submits", async () => {
    await Promise.all([sendMeetingEmail(admin, id, input), sendMeetingEmail(admin, id, input)])
    await sendMeetingEmail(admin, id, input)
    expect(mocks.send).toHaveBeenCalledOnce()
    expect(mocks.records.get(id)?.emailMessages).toHaveLength(1)
    await expect(sendMeetingEmail(admin, id, { ...input, text: "Different" })).rejects.toMatchObject({ code: "conflict" })
  })

  it("deduplicates simultaneous Postmark webhook retries without losing other messages", async () => {
    const received = parseInboundMeetingEmail(payload())!
    const results = await Promise.all([receiveMeetingEmail(received), receiveMeetingEmail(received)])
    expect(results.map((result) => result.duplicate).sort()).toEqual([false, true])
    expect(mocks.records.get(id)?.emailMessages).toHaveLength(1)
    await Promise.all([
      receiveMeetingEmail({ ...received, providerMessageId: "44444444-4444-4444-8444-444444444444" }),
      sendMeetingEmail(admin, id, input),
    ])
    expect(mocks.records.get(id)?.emailMessages).toHaveLength(3)
  })

  it.each(["failed", "skipped"])("retains a %s outbound message without automatic retries", async (status) => {
    mocks.send.mockResolvedValue({ status })
    expect((await sendMeetingEmail(admin, id, input)).status).toBe(status)
    expect((await sendMeetingEmail(admin, id, input)).status).toBe(status)
    expect(mocks.send).toHaveBeenCalledOnce()
  })

  it("leaves an ambiguous send recorded and does not resend on retry", async () => {
    mocks.send.mockRejectedValue(new Error("Connection interrupted"))
    await expect(sendMeetingEmail(admin, id, input)).rejects.toThrow("Connection interrupted")
    expect((await sendMeetingEmail(admin, id, input)).status).toBe("sending")
    expect(mocks.send).toHaveBeenCalledOnce()
  })

  it("never calls the provider when saving the send attempt fails", async () => {
    mocks.replace.mockImplementation(() => { throw new Error("Cosmos unavailable") })
    await expect(sendMeetingEmail(admin, id, input)).rejects.toThrow("Cosmos unavailable")
    expect(mocks.send).not.toHaveBeenCalled()
    expect(mocks.records.get(id)?.emailMessages).toHaveLength(0)
  })

  it("preserves the attempt when delivery succeeded but every final write conflicts", async () => {
    mocks.send.mockImplementation(async () => {
      mocks.replace.mockImplementation(() => { throw { code: 412 } })
      return { status: "sent", messageId: "postmark-message" }
    })
    await expect(sendMeetingEmail(admin, id, input)).rejects.toThrow("Unable to record the email delivery outcome.")
    expect((await sendMeetingEmail(admin, id, input)).status).toBe("sending")
    expect(mocks.send).toHaveBeenCalledOnce()
  })

  it("retries against the latest request without overwriting a simultaneous internal note", async () => {
    mocks.replace.mockImplementationOnce(() => {
      mocks.records.set(id, {
        ...structuredClone(request), _etag: String(++mocks.version),
        adminNotes: [{ text: "Called prospect", performedBy: admin.email, createdAt: request.createdAt }],
      })
    })
    await sendMeetingEmail(admin, id, input)
    expect(mocks.records.get(id)?.adminNotes?.[0].text).toBe("Called prospect")
    expect(mocks.records.get(id)?.emailMessages).toHaveLength(1)
    expect(mocks.send).toHaveBeenCalledOnce()
  })

  it("adds a reply token to existing requests and tracks the initial acknowledgement", async () => {
    mocks.records.set(id, { ...request, emailReplyToken: undefined, emailMessages: undefined, _etag: "1" })
    expect(await sendMeetingConfirmationEmail(request, "Thanks", "Your meeting request was received.")).toBe(true)
    expect(mocks.records.get(id)?.emailReplyToken).toMatch(/^[0-9a-f]{24}$/)
    expect(mocks.records.get(id)?.emailMessages?.[0]).toMatchObject({ id: "confirmation", performedBy: "RentSimple" })
  })

  it.each(["applicant", "tenant", "landlord", "agent", "builder", "unallocated"] as const)("denies %s email sending", async (role) => {
    await expect(sendMeetingEmail({ ...admin, role }, id, input)).rejects.toThrow("Forbidden")
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it("denies unapproved admins and fails closed without configuration", async () => {
    await expect(sendMeetingEmail({ ...admin, approval_status: "pending_approval" }, id, input)).rejects.toThrow("Forbidden")
    vi.stubEnv("POSTMARK_INBOUND_WEBHOOK_SECRET", "")
    expect(getMeetingEmailConfigurationError()).toContain("secret")
    await expect(sendMeetingEmail(admin, id, input)).rejects.toMatchObject({ code: "configuration" })
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it("rejects unexpected senders, unknown tokens and deleted meetings", async () => {
    const received = parseInboundMeetingEmail(payload())!
    await expect(receiveMeetingEmail({ ...received, from: "attacker@example.com" })).rejects.toMatchObject({ code: "invalid" })
    await expect(receiveMeetingEmail({ ...received, token: "c".repeat(24) })).rejects.toMatchObject({ code: "not_found" })
    mocks.records.clear()
    await expect(sendMeetingEmail(admin, id, input)).rejects.toMatchObject({ code: "not_found" })
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it("refuses oversized/full threads before sending", async () => {
    const message = { ...input, direction: "outbound" as const, status: "sent" as const, createdAt: "", from: "", to: "" }
    mocks.records.set(id, { ...request, emailMessages: Array.from({ length: 100 }, (_, index) => ({ ...message, id: String(index) })), _etag: "1" })
    await expect(sendMeetingEmail(admin, id, input)).rejects.toMatchObject({ code: "thread_full" })
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it("enforces the UTF-8 byte limit and never acknowledges an inbound persistence failure", async () => {
    const received = parseInboundMeetingEmail(payload())!
    mocks.records.set(id, { ...request, notes: "a".repeat(1000000), _etag: "1" })
    await expect(receiveMeetingEmail(received)).rejects.toMatchObject({ code: "thread_full" })
    expect(mocks.records.get(id)?.emailMessages).toHaveLength(0)
    mocks.records.set(id, { ...request, _etag: "1" })
    mocks.replace.mockImplementation(() => { throw new Error("Cosmos unavailable") })
    await expect(receiveMeetingEmail(received)).rejects.toThrow("Cosmos unavailable")
    expect(mocks.records.get(id)?.emailMessages).toHaveLength(0)
  })

  it("authenticates only configured HTTP Basic credentials", () => {
    expect(isPostmarkInboundAuthenticated(`Basic ${Buffer.from(`postmark:${secret}`).toString("base64")}`)).toBe(true)
    expect(isPostmarkInboundAuthenticated(null)).toBe(false)
    expect(isPostmarkInboundAuthenticated("Basic invalid")).toBe(false)
    expect(isPostmarkInboundAuthenticated(`Basic ${Buffer.from(`postmark:${"wrong".repeat(10)}`).toString("base64")}`)).toBe(false)
  })

  it("parses HTML-only and attachment-only replies without trusting ReplyTo or MailboxHash", () => {
    const html = parseInboundMeetingEmail({ ...payload(), StrippedTextReply: "", TextBody: "", HtmlBody: "<p>Hello</p>", ReplyTo: "attacker@example.com", MailboxHash: "forged" })
    expect(html).toMatchObject({ text: "Hello", from: request.email, token })
    expect(parseInboundMeetingEmail({ ...payload(), StrippedTextReply: "", TextBody: "", Attachments: [{}] })).toMatchObject({ text: "", attachmentCount: 1 })
    expect(parseInboundMeetingEmail({ ...payload(), OriginalRecipient: "unrelated@example.com" })).toBeNull()
    expect(parseInboundMeetingEmail({ ...payload(), StrippedTextReply: "a".repeat(50001) })).toBeNull()
  })

  it("validates email subject/body limits and prevents header injection", () => {
    expect(validateMeetingEmail(input)).toEqual(input)
    for (const value of [
      { ...input, id: "not-uuid" }, { ...input, subject: "Hello\r\nBcc: attacker@example.com" },
      { ...input, subject: " " }, { ...input, subject: "a".repeat(201) }, { ...input, text: "" },
      { ...input, text: "a".repeat(10001) }, { ...input, text: 1 },
    ]) expect(validateMeetingEmail(value)).toBeNull()
  })
})
