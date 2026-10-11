import "server-only"

import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import type { AuthUser } from "@/lib/types/user"
import { isRecord, type MeetingEmailInput, type MeetingEmailMessage, type MeetingRequest } from "@/lib/meeting-requests"
import { getMeetingRequestsContainer } from "@/lib/server/cosmos"
import { canManageMeetingRequests } from "@/lib/server/meeting-requests"
import { getConfiguredEmailProvider, getPlatformFromAddress, htmlToPlainText, sendEmail } from "@/lib/server/email"

export class MeetingEmailError extends Error {
  constructor(public readonly code: "not_found" | "conflict" | "configuration" | "thread_full" | "invalid", message: string) {
    super(message)
    this.name = "MeetingEmailError"
  }
}

function inboundAddress() {
  const address = process.env.POSTMARK_MEETING_INBOUND_ADDRESS?.trim().toLowerCase()
  if (!address || !/^[a-z0-9]+@inbound\.postmarkapp\.com$/.test(address)) {
    throw new MeetingEmailError("configuration", "Configure the Postmark meeting inbound address.")
  }
  return address
}

export function getMeetingEmailConfigurationError() {
  try {
    inboundAddress()
    if ((process.env.POSTMARK_INBOUND_WEBHOOK_SECRET?.trim().length ?? 0) < 32) {
      return "Meeting email is not ready: configure the Postmark inbound webhook secret."
    }
    if (getConfiguredEmailProvider() !== "postmark") return "Meeting email requires the existing Postmark sender configuration."
    return null
  } catch (error) {
    if (error instanceof MeetingEmailError) return error.message
    throw error
  }
}

export function isPostmarkInboundAuthenticated(authorization: string | null) {
  const secret = process.env.POSTMARK_INBOUND_WEBHOOK_SECRET?.trim()
  if (!secret || secret.length < 32 || !authorization?.startsWith("Basic ")) return false
  const expected = Buffer.from(`postmark:${secret}`)
  const actual = Buffer.from(authorization.slice(6), "base64")
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function replyAddress(request: MeetingRequest) {
  if (!request.emailReplyToken) throw new MeetingEmailError("configuration", "The reply token is missing.")
  const [mailbox, domain] = inboundAddress().split("@")
  return `${mailbox}+m-${request.emailReplyToken}@${domain}`
}

function codeOf(error: unknown) {
  return isRecord(error) ? error.code : undefined
}

async function mutateRequest(
  id: string,
  mutate: (current: MeetingRequest) => MeetingRequest | null,
) {
  const item = (await getMeetingRequestsContainer()).item(id, id)
  for (let attempt = 0; attempt < 5; attempt++) {
    let current: (MeetingRequest & { _etag?: string }) | undefined
    try {
      current = (await item.read<MeetingRequest>()).resource
    } catch (error) {
      if (codeOf(error) === 404) throw new MeetingEmailError("not_found", "Meeting request not found.")
      throw error
    }
    if (!current || current.type !== "meeting_request") throw new MeetingEmailError("not_found", "Meeting request not found.")
    const next = mutate(current)
    if (!next) return current
    next.updatedAt = new Date(Math.max(Date.now(), Date.parse(current.updatedAt) + 1)).toISOString()
    if ((next.emailMessages?.length ?? 0) > 100 || Buffer.byteLength(JSON.stringify(next), "utf8") > 1000000) {
      throw new MeetingEmailError("thread_full", "This meeting email thread has reached its storage limit. Contact the prospect directly.")
    }
    if (!current._etag) throw new Error("Meeting request version is missing.")
    try {
      await item.replace(next, { accessCondition: { type: "IfMatch", condition: current._etag } })
      return next
    } catch (error) {
      if (codeOf(error) !== 412) throw error
    }
  }
  throw new MeetingEmailError("conflict", "The request is being updated. Please try again.")
}

async function deliverMeetingEmail(id: string, input: MeetingEmailInput, performedBy: string) {
  const configurationError = getMeetingEmailConfigurationError()
  if (configurationError) throw new MeetingEmailError("configuration", configurationError)
  const from = getPlatformFromAddress()
  if (!from) throw new MeetingEmailError("configuration", "The Postmark sender address is missing.")
  let claimed = false
  const request = await mutateRequest(id, (current) => {
    claimed = false
    const existing = current.emailMessages?.find((message) => message.id === input.id)
    if (existing) {
      if (existing.subject !== input.subject || existing.text !== input.text) {
        throw new MeetingEmailError("conflict", "This email attempt already exists with different content.")
      }
      return null
    }
    claimed = true
    const message: MeetingEmailMessage = {
      ...input, direction: "outbound", from,
      to: current.email, status: "sending", performedBy, createdAt: new Date().toISOString(),
    }
    return {
      ...current, emailReplyToken: current.emailReplyToken || randomBytes(12).toString("hex"),
      emailMessages: [...(current.emailMessages || []), message],
    }
  })
  if (!claimed) return request.emailMessages!.find((message) => message.id === input.id)!

  // Save the attempt before sending. Repeating the same attempt never sends twice.
  const delivery = await sendEmail({
    to: request.email, replyTo: replyAddress(request), fromName: "RentSimple",
    tag: "meeting-conversation", subject: input.subject, text: input.text,
  })
  const saved = await mutateRequest(id, (current) => ({
    ...current,
    emailMessages: (current.emailMessages || []).map((message) => message.id === input.id
      ? { ...message, status: delivery.status, providerMessageId: delivery.messageId }
      : message),
  })).catch((error: unknown) => {
    // The provider was already called; keep the same attempt even on a storage conflict.
    throw new Error("Unable to record the email delivery outcome.", { cause: error })
  })
  return saved.emailMessages!.find((message) => message.id === input.id)!
}

export async function sendMeetingEmail(user: AuthUser, id: string, input: MeetingEmailInput) {
  if (!canManageMeetingRequests(user)) throw new Error("Forbidden")
  return deliverMeetingEmail(id, input, user.email)
}

export async function sendMeetingConfirmationEmail(request: MeetingRequest, subject: string, text: string) {
  const message = await deliverMeetingEmail(request.id, { id: "confirmation", subject, text }, "RentSimple")
  return message.status === "sent"
}

type InboundMeetingEmail = {
  token: string
  providerMessageId: string
  from: string
  subject: string
  text: string
  attachmentCount: number
}

export function parseInboundMeetingEmail(body: unknown): InboundMeetingEmail | null {
  if (!isRecord(body) || body.MessageStream !== "inbound" || !isRecord(body.FromFull) ||
      typeof body.FromFull.Email !== "string" || typeof body.OriginalRecipient !== "string" ||
      typeof body.MessageID !== "string" || !/^[0-9a-f-]{36}$/i.test(body.MessageID) ||
      typeof body.Subject !== "string" || body.Subject.length > 200 || /[\r\n]/.test(body.Subject)) return null
  const [mailbox, domain] = inboundAddress().split("@")
  const recipient = body.OriginalRecipient.toLowerCase()
  if (!recipient.startsWith(`${mailbox}+m-`) || !recipient.endsWith(`@${domain}`)) return null
  const token = recipient.slice(`${mailbox}+m-`.length, -(`@${domain}`).length)
  if (!/^[0-9a-f]{24}$/.test(token)) return null
  const from = body.FromFull.Email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from) || from.length > 254) return null
  const text = typeof body.StrippedTextReply === "string" && body.StrippedTextReply.trim()
    ? body.StrippedTextReply.trim()
    : typeof body.TextBody === "string" && body.TextBody.trim()
      ? body.TextBody.trim()
      : typeof body.HtmlBody === "string" ? htmlToPlainText(body.HtmlBody) : ""
  const attachmentCount = Array.isArray(body.Attachments) ? body.Attachments.length : 0
  if ((!text && !attachmentCount) || text.length > 50000) return null
  return { token, providerMessageId: body.MessageID, from, subject: body.Subject, text, attachmentCount }
}

export async function receiveMeetingEmail(input: InboundMeetingEmail) {
  const { resources } = await (await getMeetingRequestsContainer()).items.query<{ id: string }>({
    query: "SELECT TOP 1 c.id FROM c WHERE c.type = @type AND c.emailReplyToken = @token",
    parameters: [{ name: "@type", value: "meeting_request" }, { name: "@token", value: input.token }],
  }).fetchAll()
  if (!resources[0]) throw new MeetingEmailError("not_found", "Meeting reply address not found.")
  let duplicate = false
  await mutateRequest(resources[0].id, (current) => {
    if (current.emailReplyToken !== input.token || current.email.toLowerCase() !== input.from) {
      throw new MeetingEmailError("invalid", "The sender or reply address does not match this meeting.")
    }
    duplicate = Boolean(current.emailMessages?.some((message) => message.direction === "inbound" && message.providerMessageId === input.providerMessageId))
    if (duplicate) return null
    const message: MeetingEmailMessage = {
      id: createHash("sha256").update(input.providerMessageId).digest("hex"),
      direction: "inbound", from: input.from, to: replyAddress(current),
      subject: input.subject, text: input.text, createdAt: new Date().toISOString(),
      status: "received", providerMessageId: input.providerMessageId, attachmentCount: input.attachmentCount,
    }
    return { ...current, emailMessages: [...(current.emailMessages || []), message] }
  })
  return { duplicate }
}
