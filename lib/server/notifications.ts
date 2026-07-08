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

type CreditReportRequestNotificationParams = {
  toEmail: string
  requestedByEmail: string
  requestedAt: string
  applicantName: string
  applicantEmail: string
  propertyAddress: string
  applicationId: string
}

export async function sendCreditReportRequestNotification(
  params: CreditReportRequestNotificationParams,
): Promise<boolean> {
  const smtpConfig = getSmtpConfig()

  if (!smtpConfig) {
    console.warn("SMTP not configured - cannot send credit report request notification")
    return false
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.port === 465,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
    })

    const subject = `Credit report requested for ${params.applicantName}`
    const text = [
      "A landlord has requested a tenant credit score and report.",
      "",
      `Application ID: ${params.applicationId}`,
      `Applicant: ${params.applicantName} (${params.applicantEmail})`,
      `Property: ${params.propertyAddress}`,
      `Requested by: ${params.requestedByEmail}`,
      `Requested at: ${new Date(params.requestedAt).toLocaleString("en-GB")}`,
      "",
      "Please process this report request within 24 hours.",
    ].join("\n")

    await transporter.sendMail({
      from: formatMailbox(smtpConfig.from, "RentSimple Notifications"),
      to: params.toEmail,
      subject,
      text,
    })

    return true
  } catch (error) {
    console.error("Error sending credit report request notification:", error)
    return false
  }
}

type GuarantorReferenceRequestNotificationParams = {
  toEmail: string
  requestedByEmail: string
  requestedAt: string
  applicantName: string
  applicantEmail: string
  propertyAddress: string
  applicationId: string
  refereeName: string
  consentUrl: string
}

export async function sendGuarantorReferenceRequestNotification(
  params: GuarantorReferenceRequestNotificationParams,
): Promise<boolean> {
  const smtpConfig = getSmtpConfig()

  if (!smtpConfig) {
    console.warn("SMTP not configured - cannot send guarantor reference request notification")
    return false
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.port === 465,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
    })

    const subject = `Guarantor check request for ${params.applicantName}`
    const text = [
      `Hello ${params.refereeName},`,
      "",
      "A tenancy team is requesting your approval to act as guarantor.",
      "",
      `Application ID: ${params.applicationId}`,
      `Applicant: ${params.applicantName} (${params.applicantEmail})`,
      `Property: ${params.propertyAddress}`,
      `Requested by: ${params.requestedByEmail}`,
      `Requested at: ${new Date(params.requestedAt).toLocaleString("en-GB")}`,
      "",
      "Review the guarantor terms and respond using this secure link:",
      params.consentUrl,
      "",
      "Please confirm whether you are prepared to act as guarantor for this applicant.",
    ].join("\n")

    await transporter.sendMail({
      from: formatMailbox(smtpConfig.from, "RentSimple Notifications"),
      to: params.toEmail,
      subject,
      text,
    })

    return true
  } catch (error) {
    console.error("Error sending guarantor reference request notification:", error)
    return false
  }
}

// ==================== CASE ESCALATION NOTIFICATIONS ====================

type EscalationNotificationParams = {
  caseId: string
  caseTitle: string
  propertyId: string
  stageName: string
  escalationLevel: "alert_24h" | "alert_72h" | "alert_5d"
  dueAt: string
  recipientEmail: string
}

/**
 * Send escalation notification for overdue case stages
 */
export async function sendEscalationNotification(params: EscalationNotificationParams): Promise<boolean> {
  const smtpConfig = getSmtpConfig()
  if (!smtpConfig) {
    console.warn("SMTP not configured - cannot send escalation notification")
    return false
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.port === 465,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
    })

    const dueDate = new Date(params.dueAt)
    const now = new Date()
    const daysOverdue = Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

    const escalationLevelLabels = {
      alert_24h: "24 hours",
      alert_72h: "3 days",
      alert_5d: "5 days",
    }

    const subjectPrefix =
      params.escalationLevel === "alert_24h" ? "🔔 URGENT" : params.escalationLevel === "alert_72h" ? "⚠️ WARNING" : "🚨 CRITICAL"

    const subject = `${subjectPrefix}: Case Deadline Approaching - ${params.caseTitle}`

    const html = `
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: ${params.escalationLevel === "alert_24h" ? "#dc2626" : params.escalationLevel === "alert_72h" ? "#ea580c" : "#7c2d12"};">
              ${subjectPrefix} – Case Deadline Alert
            </h2>

            <p style="color: #374151; margin-bottom: 16px;">
              Hi,
            </p>

            <p style="color: #374151; margin-bottom: 16px;">
              The following case stage has ${params.escalationLevel === "alert_24h" ? "LESS THAN 24 HOURS" : params.escalationLevel === "alert_72h" ? "LESS THAN 72 HOURS" : "LESS THAN 5 DAYS"} remaining before it is overdue:
            </p>

            <div style="background: #f3f4f6; border-left: 4px solid ${params.escalationLevel === "alert_24h" ? "#dc2626" : params.escalationLevel === "alert_72h" ? "#ea580c" : "#7c2d12"}; padding: 16px; margin-bottom: 24px;">
              <p style="margin: 0 0 8px 0; color: #111827;"><strong>Case:</strong> ${params.caseTitle}</p>
              <p style="margin: 0 0 8px 0; color: #111827;"><strong>Stage:</strong> ${params.stageName}</p>
              <p style="margin: 0 0 8px 0; color: #111827;"><strong>Due Date:</strong> ${dueDate.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}</p>
              ${daysOverdue > 0 ? `<p style="margin: 0; color: #dc2626;"><strong>Status:</strong> ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} OVERDUE</p>` : ""}
            </div>

            <p style="color: #374151; margin-bottom: 16px;">
              Please take immediate action to complete this stage or contact your advisor if you need assistance.
            </p>

            <p style="color: #6b7280; font-size: 14px;">
              ${new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </body>
      </html>
    `

    await transporter.sendMail({
      from: formatMailbox(smtpConfig.from, "RentSimple Cases"),
      to: params.recipientEmail,
      subject,
      html,
    })

    return true
  } catch (error) {
    console.error("Error sending escalation notification:", error)
    return false
  }
}