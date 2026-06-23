import "server-only"

import nodemailer from "nodemailer"

import type { TenantCommunicationEntry, TenantCommunicationNotification, TenancyApplicationRecord } from "@/lib/auth"
import { getPropertyByIdForSystem } from "@/lib/server/properties"
import { prepareTenantCommunicationNotification } from "@/lib/utils/tenant-communication-notifications"
import { resolveTenantCommunicationEmailRouting } from "@/lib/utils/tenant-communication-routing"
import { getUserByEmail, getUserById } from "@/lib/server/users"

type DeliveryResult = {
  status: TenantCommunicationNotification["status"]
  detail: string
  attemptedAt?: string
  sentAt?: string
  fromAddress?: string
  replyTo?: string
  copiedTo?: string[]
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

function getTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim()

  if (!accountSid || !authToken || !fromNumber) {
    return null
  }

  return { accountSid, authToken, fromNumber }
}

function formatMailbox(address: string, name: string) {
  return name ? `${name} <${address}>` : address
}

function formatPlatformFromName(routedName: string) {
  return routedName && routedName !== "RentSimple" ? `${routedName} via RentSimple` : "RentSimple"
}

async function resolveEmailRouting(application: TenancyApplicationRecord, platformFromAddress: string) {
  const property = await getPropertyByIdForSystem(application.propertyId)
  const landlord = property ? await getUserById(property.ownerId) : null
  const managingAgent = landlord?.managedByAgentId ? await getUserById(landlord.managedByAgentId) : null

  return resolveTenantCommunicationEmailRouting({
    platformFromAddress,
    landlord,
    managingAgent,
  })
}

async function sendRoutedEmailNotification(
  application: TenancyApplicationRecord,
  to: string,
  subject: string,
  text: string,
): Promise<Omit<TenantCommunicationNotification, "channel" | "target">> {
  const config = getSmtpConfig()
  const attemptedAt = new Date().toISOString()

  if (!config) {
    return {
      status: "skipped",
      attemptedAt,
      detail: "SMTP configuration is missing.",
    }
  }

  const routing = await resolveEmailRouting(application, config.from)
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
    await transporter.sendMail({
      from: formatMailbox(config.from, formatPlatformFromName(routing.fromName)),
      sender: config.from,
      replyTo: routing.replyTo,
      cc: routing.copiedTo.length > 0 ? routing.copiedTo : undefined,
      to,
      subject,
      text,
    })

    return {
      status: "sent",
      attemptedAt,
      sentAt: new Date().toISOString(),
      fromAddress: config.from,
      replyTo: routing.replyTo,
      copiedTo: routing.copiedTo,
      detail: `${routing.detail} Delivered using the platform SMTP sender ${config.from}.`,
    }
  } catch (error) {
    return {
      status: "failed",
      attemptedAt,
      fromAddress: config.from,
      replyTo: routing.replyTo,
      copiedTo: routing.copiedTo,
      detail:
        error instanceof Error
          ? `${routing.detail} Delivery via the platform SMTP sender ${config.from} failed. ${error.message}`.trim()
          : `${routing.detail} Delivery via the platform SMTP sender ${config.from} failed.`,
    }
  }
}

async function sendSmsNotification(to: string, body: string): Promise<DeliveryResult> {
  const config = getTwilioConfig()
  const attemptedAt = new Date().toISOString()

  if (!config) {
    return { status: "skipped", attemptedAt, detail: "Twilio SMS configuration is missing." }
  }

  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: config.fromNumber, Body: body }),
    })

    if (!response.ok) {
      const detail = await response.text()
      return { status: "failed", attemptedAt, detail: detail || `SMS notification failed with status ${response.status}.` }
    }

    return { status: "sent", attemptedAt, sentAt: new Date().toISOString(), detail: "SMS notification sent." }
  } catch (error) {
    return { status: "failed", attemptedAt, detail: error instanceof Error ? error.message : "SMS notification failed." }
  }
}

export async function deliverTenantCommunicationNotification(
  application: TenancyApplicationRecord,
  entry: TenantCommunicationEntry,
) {
  const now = new Date().toISOString()
  const user = await getUserByEmail(application.applicantEmail)
  const prepared = prepareTenantCommunicationNotification(
    {
      tenantName: application.applicantName,
      tenantEmail: application.applicantEmail,
      tenantMobile: user?.mobile,
      propertyAddress: application.propertyAddress,
    },
    entry,
  )

  if (prepared.kind === "none") {
    return {
      ...entry,
      notification: {
        status: prepared.status,
        detail: prepared.detail,
        attemptedAt: now,
      },
    }
  }

  const delivery =
    prepared.kind === "email"
      ? await sendRoutedEmailNotification(application, prepared.target, prepared.subject, prepared.message)
      : await sendSmsNotification(prepared.target, prepared.message)

  return {
    ...entry,
    notification: {
      channel: prepared.kind,
      target: prepared.target,
      status: delivery.status,
      detail: delivery.detail,
      attemptedAt: delivery.attemptedAt ?? now,
      sentAt: delivery.status === "sent" ? delivery.sentAt ?? now : undefined,
      fromAddress: prepared.kind === "email" ? delivery.fromAddress : undefined,
      replyTo: prepared.kind === "email" ? delivery.replyTo : undefined,
      copiedTo: prepared.kind === "email" ? delivery.copiedTo : undefined,
    },
  }
}