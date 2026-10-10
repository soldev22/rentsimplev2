import "server-only"

import { EmailClient } from "@azure/communication-email"
import { DefaultAzureCredential } from "@azure/identity"
import nodemailer from "nodemailer"

export type EmailProvider = "postmark" | "acs" | "smtp"

export type EmailAttachment = {
  filename: string
  content: Buffer
  contentType: string
}

export type OutboundEmail = {
  to: string
  cc?: string[]
  fromName?: string
  replyTo?: string
  subject: string
  text?: string
  html?: string
  attachments?: EmailAttachment[]
  tag?: string
}

export type EmailDeliveryResult = {
  status: "sent" | "skipped" | "failed"
  detail: string
  provider?: EmailProvider
  fromAddress?: string
  messageId?: string
}

const POSTMARK_API_URL = "https://api.postmarkapp.com/email"

function getPostmarkConfig() {
  const serverToken = process.env.POSTMARK_SERVER_TOKEN?.trim()
  const from = process.env.POSTMARK_FROM?.trim()
  const messageStream = process.env.POSTMARK_MESSAGE_STREAM?.trim() || "outbound"

  if (!serverToken || !from) {
    return null
  }

  return { serverToken, from, messageStream }
}

function getAcsConfig() {
  const connectionString = process.env.ACS_EMAIL_CONNECTION_STRING?.trim()
  const endpoint = process.env.ACS_EMAIL_ENDPOINT?.trim()
  const sender = process.env.ACS_EMAIL_SENDER?.trim()

  if (!sender || (!connectionString && !endpoint)) {
    return null
  }

  return { connectionString, endpoint, sender }
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim()
  const port = Number(process.env.SMTP_PORT ?? "587")
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  const from = process.env.SMTP_FROM?.trim()

  if (!host || !user || !pass || !from || !Number.isFinite(port)) {
    return null
  }

  return { host, port, user, pass, from }
}

export function getConfiguredEmailProvider(): EmailProvider | null {
  if (getPostmarkConfig()) return "postmark"
  if (getAcsConfig()) return "acs"
  if (getSmtpConfig()) return "smtp"
  return null
}

export function getPlatformFromAddress(): string | null {
  return getPostmarkConfig()?.from ?? getAcsConfig()?.sender ?? getSmtpConfig()?.from ?? null
}

function formatMailbox(address: string, name?: string) {
  const trimmedName = name?.trim().replace(/["\r\n]/g, "")
  return trimmedName ? `"${trimmedName}" <${address}>` : address
}

function htmlToPlainText(html: string) {
  return html
    .replace(/<(br|\/p|\/div|\/h[1-6]|\/li)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function logEmailFailure(provider: EmailProvider, error: unknown) {
  const metadata: { provider: string; code?: string | number; errorName: string; responseCode?: number; statusCode?: number } = {
    provider,
    errorName: error instanceof Error ? error.name : "UnknownError",
  }
  if (typeof error === "object" && error !== null) {
    const code = Reflect.get(error, "code")
    const responseCode = Reflect.get(error, "responseCode")
    const statusCode = Reflect.get(error, "statusCode")
    if (typeof code === "string" || typeof code === "number") metadata.code = code
    if (typeof responseCode === "number") metadata.responseCode = responseCode
    if (typeof statusCode === "number") metadata.statusCode = statusCode
  }
  console.error("Email delivery failed.", metadata)
}

async function sendWithPostmark(
  config: NonNullable<ReturnType<typeof getPostmarkConfig>>,
  message: OutboundEmail,
): Promise<EmailDeliveryResult> {
  const payload: Record<string, unknown> = {
    From: formatMailbox(config.from, message.fromName),
    To: message.to,
    Subject: message.subject,
    MessageStream: config.messageStream,
  }
  if (message.text) payload.TextBody = message.text
  if (message.html) payload.HtmlBody = message.html
  if (message.cc && message.cc.length > 0) payload.Cc = message.cc.join(", ")
  if (message.replyTo) payload.ReplyTo = message.replyTo
  if (message.tag) payload.Tag = message.tag
  if (message.attachments && message.attachments.length > 0) {
    payload.Attachments = message.attachments.map((attachment) => ({
      Name: attachment.filename,
      Content: attachment.content.toString("base64"),
      ContentType: attachment.contentType,
    }))
  }

  try {
    const response = await fetch(POSTMARK_API_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": config.serverToken,
      },
      body: JSON.stringify(payload),
    })

    const body = (await response.json().catch(() => null)) as
      | { ErrorCode?: number; Message?: string; MessageID?: string }
      | null

    if (!response.ok || !body || body.ErrorCode !== 0) {
      logEmailFailure("postmark", { name: "PostmarkSendError", code: body?.ErrorCode, statusCode: response.status })
      return {
        status: "failed",
        provider: "postmark",
        fromAddress: config.from,
        detail: body?.Message
          ? `Postmark rejected the email: ${body.Message}`
          : `Postmark returned status ${response.status}.`,
      }
    }

    return {
      status: "sent",
      provider: "postmark",
      fromAddress: config.from,
      messageId: body.MessageID,
      detail: `Delivered using Postmark sender ${config.from}.`,
    }
  } catch (error) {
    logEmailFailure("postmark", error)
    return {
      status: "failed",
      provider: "postmark",
      fromAddress: config.from,
      detail: error instanceof Error ? error.message : "Unable to send email with Postmark.",
    }
  }
}

async function sendWithAcs(
  config: NonNullable<ReturnType<typeof getAcsConfig>>,
  message: OutboundEmail,
): Promise<EmailDeliveryResult> {
  try {
    const client = config.connectionString
      ? new EmailClient(config.connectionString)
      : new EmailClient(config.endpoint as string, new DefaultAzureCredential())

    const poller = await client.beginSend({
      senderAddress: config.sender,
      recipients: {
        to: [{ address: message.to }],
        cc: message.cc?.map((address) => ({ address })),
      },
      replyTo: message.replyTo ? [{ address: message.replyTo }] : undefined,
      content: {
        subject: message.subject,
        plainText: message.text ?? htmlToPlainText(message.html ?? ""),
        html: message.html,
      },
      attachments: message.attachments?.map((attachment) => ({
        name: attachment.filename,
        contentType: attachment.contentType,
        contentInBase64: attachment.content.toString("base64"),
      })),
    })
    const result = await poller.pollUntilDone()

    if (result.status !== "Succeeded") {
      logEmailFailure("acs", { name: "AcsSendError", code: result.error?.code })
      return {
        status: "failed",
        provider: "acs",
        fromAddress: config.sender,
        detail: result.error?.message ?? `Azure Communication Services returned status ${result.status}.`,
      }
    }

    return {
      status: "sent",
      provider: "acs",
      fromAddress: config.sender,
      messageId: result.id,
      detail: `Delivered using Azure Communication Services sender ${config.sender}.`,
    }
  } catch (error) {
    logEmailFailure("acs", error)
    return {
      status: "failed",
      provider: "acs",
      fromAddress: config.sender,
      detail: error instanceof Error ? error.message : "Unable to send email.",
    }
  }
}

async function sendWithSmtp(
  config: NonNullable<ReturnType<typeof getSmtpConfig>>,
  message: OutboundEmail,
): Promise<EmailDeliveryResult> {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  })

  try {
    const delivery = await transporter.sendMail({
      from: formatMailbox(config.from, message.fromName),
      sender: config.from,
      to: message.to,
      cc: message.cc && message.cc.length > 0 ? message.cc : undefined,
      replyTo: message.replyTo,
      subject: message.subject,
      text: message.text,
      html: message.html,
      attachments: message.attachments,
    })

    const normalizedTarget = message.to.trim().toLowerCase()
    const rejected = (delivery.rejected ?? []).map((value) => String(value).trim().toLowerCase())
    if (rejected.includes(normalizedTarget)) {
      return {
        status: "failed",
        provider: "smtp",
        fromAddress: config.from,
        messageId: delivery.messageId,
        detail: `Recipient rejected by SMTP provider: ${message.to}`,
      }
    }

    return {
      status: "sent",
      provider: "smtp",
      fromAddress: config.from,
      messageId: delivery.messageId,
      detail: `Delivered using the platform SMTP sender ${config.from}.`,
    }
  } catch (error) {
    logEmailFailure("smtp", error)
    return {
      status: "failed",
      provider: "smtp",
      fromAddress: config.from,
      detail: error instanceof Error ? error.message : "Unable to send email.",
    }
  }
}

/**
 * Sends a transactional email using the first configured provider:
 * Postmark, then Azure Communication Services (retiring 2028), then SMTP.
 */
export async function sendEmail(message: OutboundEmail): Promise<EmailDeliveryResult> {
  const postmarkConfig = getPostmarkConfig()
  if (postmarkConfig) {
    return sendWithPostmark(postmarkConfig, message)
  }

  const acsConfig = getAcsConfig()
  if (acsConfig) {
    return sendWithAcs(acsConfig, message)
  }

  const smtpConfig = getSmtpConfig()
  if (smtpConfig) {
    return sendWithSmtp(smtpConfig, message)
  }

  return {
    status: "skipped",
    detail: "Email configuration is missing.",
  }
}
