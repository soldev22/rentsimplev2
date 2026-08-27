import "server-only"

import nodemailer from "nodemailer"

import type { TenantCommunicationEntry, TenantCommunicationNotification, TenancyApplicationRecord } from "@/lib/auth"
import { getPropertyByIdForSystem } from "@/lib/server/properties"
import { prepareTenantCommunicationNotification } from "@/lib/utils/tenant-communication-notifications"
import { resolveTenantCommunicationEmailRouting } from "@/lib/utils/tenant-communication-routing"
import { getUserByEmail, getUserById, listApprovedGlobalAdmins } from "@/lib/server/users"

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

export async function sendNewApplicationNotifications(application: TenancyApplicationRecord): Promise<boolean> {
  const smtpConfig = getSmtpConfig()

  if (!smtpConfig) {
    console.warn("SMTP not configured - cannot send new application notifications")
    return false
  }

  const [property, globalAdmins] = await Promise.all([
    getPropertyByIdForSystem(application.propertyId),
    listApprovedGlobalAdmins(),
  ])
  const landlord = property ? await getUserById(property.ownerId) : null
  const recipients = [...new Set([landlord?.email, ...globalAdmins.map((globalAdmin) => globalAdmin.email)]
    .map((email) => email?.trim().toLowerCase())
    .filter((email): email is string => Boolean(email)))]

  if (recipients.length === 0) {
    console.warn(`No landlord or global admin recipients found for application ${application.id}`)
    return false
  }

  const reviewUrl = `${process.env.NEXT_PUBLIC_BASE_URL?.trim() || "http://localhost:3000"}/dashboard/applications?applicationId=${encodeURIComponent(application.id)}`
  const subject = `New tenancy application for ${application.propertyAddress}`
  const text = [
    "A new tenancy application is ready for review.",
    "",
    `Applicant: ${application.applicantName} (${application.applicantEmail})`,
    `Property: ${application.propertyAddress}`,
    `Submitted: ${new Date(application.submittedAt).toLocaleString("en-GB")}`,
    "",
    `Review application: ${reviewUrl}`,
  ].join("\n")

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

    await Promise.all(recipients.map((to) => transporter.sendMail({
      from: formatMailbox(smtpConfig.from, "RentSimple Notifications"),
      to,
      subject,
      text,
    })))

    return true
  } catch (error) {
    console.error("Error sending new application notifications:", error)
    return false
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

type DepositRequestedNotificationParams = {
  toEmail: string
  tenantName: string
  propertyAddress: string
  amount: number
  currency: string
  dueDate?: string
  paymentInstructions: string
}

export async function sendDepositRequestedNotification(params: DepositRequestedNotificationParams): Promise<boolean> {
  const smtpConfig = getSmtpConfig()

  if (!smtpConfig) {
    console.warn("SMTP not configured - cannot send deposit request notification")
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

    const subject = `Deposit requested for ${params.propertyAddress}`
    const text = [
      `Hello ${params.tenantName},`,
      "",
      `A tenancy deposit of ${params.currency} ${params.amount.toLocaleString("en-GB")} has been requested for ${params.propertyAddress}.`,
      params.dueDate ? `Payment due date: ${new Date(params.dueDate).toLocaleDateString("en-GB")}` : "",
      "",
      "Payment instructions:",
      params.paymentInstructions || "Please check your RentSimple dashboard for payment instructions.",
      "",
      "Please log in to RentSimple to acknowledge this request and confirm once payment has been made.",
    ].filter(Boolean).join("\n")

    await transporter.sendMail({
      from: formatMailbox(smtpConfig.from, "RentSimple Notifications"),
      to: params.toEmail,
      subject,
      text,
    })

    return true
  } catch (error) {
    console.error("Error sending deposit request notification:", error)
    return false
  }
}

type DepositReminderNotificationParams = {
  toEmail: string
  tenantName: string
  propertyAddress: string
  amount: number
  currency: string
  dueDate?: string
}

export async function sendDepositReminderNotification(params: DepositReminderNotificationParams): Promise<boolean> {
  const smtpConfig = getSmtpConfig()

  if (!smtpConfig) {
    console.warn("SMTP not configured - cannot send deposit reminder notification")
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

    const subject = `Deposit reminder for ${params.propertyAddress}`
    const text = [
      `Hello ${params.tenantName},`,
      "",
      `This is a reminder that your tenancy deposit of ${params.currency} ${params.amount.toLocaleString("en-GB")} is still outstanding.`,
      params.dueDate ? `Due date: ${new Date(params.dueDate).toLocaleDateString("en-GB")}` : "",
      "",
      "Please review the deposit request in your RentSimple dashboard.",
    ].filter(Boolean).join("\n")

    await transporter.sendMail({
      from: formatMailbox(smtpConfig.from, "RentSimple Notifications"),
      to: params.toEmail,
      subject,
      text,
    })

    return true
  } catch (error) {
    console.error("Error sending deposit reminder notification:", error)
    return false
  }
}

type DepositPaymentReceivedNotificationParams = {
  toEmail: string
  propertyAddress: string
  tenantName: string
  amount: number
  currency: string
}

export async function sendDepositPaymentReceivedNotification(
  params: DepositPaymentReceivedNotificationParams,
): Promise<boolean> {
  const smtpConfig = getSmtpConfig()

  if (!smtpConfig) {
    console.warn("SMTP not configured - cannot send deposit payment received notification")
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

    const subject = `Deposit payment received confirmation for ${params.propertyAddress}`
    const text = [
      `Deposit payment for ${params.tenantName} at ${params.propertyAddress} has been marked as received.`,
      "",
      `Amount: ${params.currency} ${params.amount.toLocaleString("en-GB")}`,
      "",
      "Next action: record deposit protection details in RentSimple.",
    ].join("\n")

    await transporter.sendMail({
      from: formatMailbox(smtpConfig.from, "RentSimple Notifications"),
      to: params.toEmail,
      subject,
      text,
    })

    return true
  } catch (error) {
    console.error("Error sending deposit payment received notification:", error)
    return false
  }
}

type DepositProtectedNotificationParams = {
  toEmail: string
  tenantName: string
  propertyAddress: string
  providerName: string
  protectionReference: string
  protectedAmount: number
  currency: string
  protectedDate?: string
}

export async function sendDepositProtectedNotification(params: DepositProtectedNotificationParams): Promise<boolean> {
  const smtpConfig = getSmtpConfig()

  if (!smtpConfig) {
    console.warn("SMTP not configured - cannot send deposit protected notification")
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

    const subject = `Deposit protection confirmed for ${params.propertyAddress}`
    const text = [
      `Hello ${params.tenantName},`,
      "",
      "Your deposit protection has been recorded.",
      "",
      `Provider: ${params.providerName}`,
      `Reference: ${params.protectionReference}`,
      `Protected amount: ${params.currency} ${params.protectedAmount.toLocaleString("en-GB")}`,
      params.protectedDate ? `Protection date: ${new Date(params.protectedDate).toLocaleDateString("en-GB")}` : "",
      "",
      "You can review the latest details and documents in your RentSimple dashboard.",
    ].filter(Boolean).join("\n")

    await transporter.sendMail({
      from: formatMailbox(smtpConfig.from, "RentSimple Notifications"),
      to: params.toEmail,
      subject,
      text,
    })

    return true
  } catch (error) {
    console.error("Error sending deposit protected notification:", error)
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

type GuarantorDeclarationCopyNotificationParams = {
  toEmail: string
  refereeName: string
  applicantName: string
  applicantEmail: string
  propertyAddress: string
  applicationId: string
  respondedAt: string
  declarationPdfBytes: Buffer
}

export async function sendGuarantorDeclarationCopyNotification(
  params: GuarantorDeclarationCopyNotificationParams,
): Promise<boolean> {
  const smtpConfig = getSmtpConfig()

  if (!smtpConfig) {
    console.warn("SMTP not configured - cannot send guarantor declaration copy")
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

    const subject = `Signed guarantor declaration for ${params.applicantName}`
    const text = [
      `Hello ${params.refereeName},`,
      "",
      "Thank you for confirming your guarantor declaration.",
      "",
      "A PDF copy of your signed declaration is attached for your records.",
      "",
      `Application ID: ${params.applicationId}`,
      `Applicant: ${params.applicantName} (${params.applicantEmail})`,
      `Property: ${params.propertyAddress}`,
      `Recorded at: ${new Date(params.respondedAt).toLocaleString("en-GB")}`,
      "",
      "Regards,",
      "RentSimple",
    ].join("\n")

    await transporter.sendMail({
      from: formatMailbox(smtpConfig.from, "RentSimple Notifications"),
      to: params.toEmail,
      subject,
      text,
      attachments: [
        {
          filename: `guarantor-declaration-${params.applicationId}.pdf`,
          content: params.declarationPdfBytes,
          contentType: "application/pdf",
        },
      ],
    })

    return true
  } catch (error) {
    console.error("Error sending guarantor declaration copy notification:", error)
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

type SiteVisitInviteNotificationParams = {
  toEmail: string
  applicantName: string
  requestedByEmail: string
  requestedAt: string
  propertyAddress: string
  applicationId: string
  scheduledAt?: string
  assigneeName?: string
  meetingConfirmationUrl: string
}

type SiteVisitInviteDeliveryResult = {
  sent: boolean
  error?: string
  messageId?: string
  accepted?: string[]
  rejected?: string[]
}

export async function sendSiteVisitMeetingInviteNotification(
  params: SiteVisitInviteNotificationParams,
): Promise<SiteVisitInviteDeliveryResult> {
  const smtpConfig = getSmtpConfig()

  if (!smtpConfig) {
    console.warn("SMTP not configured - cannot send site visit invite notification")
    return {
      sent: false,
      error: "SMTP is not configured on this environment.",
    }
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

    const formattedSchedule = params.scheduledAt
      ? new Date(params.scheduledAt).toLocaleString("en-GB")
      : "to be confirmed"
    const subject = `Please confirm your RentSimple site visit for ${params.propertyAddress}`
    const text = [
      `Hello ${params.applicantName},`,
      "",
      "Your tenancy team would like to arrange your site visit and needs your confirmation.",
      "",
      `Application ID: ${params.applicationId}`,
      `Property: ${params.propertyAddress}`,
      `Proposed meeting time: ${formattedSchedule}`,
      params.assigneeName ? `Host: ${params.assigneeName}` : "",
      `Requested by: ${params.requestedByEmail}`,
      `Requested at: ${new Date(params.requestedAt).toLocaleString("en-GB")}`,
      "",
      "Review the meeting details and confirm using your secure link:",
      params.meetingConfirmationUrl,
      "",
      "This secure link can only be used once.",
    ]
      .filter(Boolean)
      .join("\n")

    const delivery = await transporter.sendMail({
      from: formatMailbox(smtpConfig.from, "RentSimple Viewings"),
      to: params.toEmail,
      subject,
      text,
    })

    const accepted = (delivery.accepted ?? []).map((value) => String(value).trim().toLowerCase())
    const rejected = (delivery.rejected ?? []).map((value) => String(value).trim().toLowerCase())
    const normalizedTarget = params.toEmail.trim().toLowerCase()
    const targetAccepted = accepted.includes(normalizedTarget)
    const targetRejected = rejected.includes(normalizedTarget)

    if (!targetAccepted || targetRejected) {
      const reason = targetRejected
        ? `Recipient rejected by SMTP provider: ${params.toEmail}`
        : `SMTP did not confirm recipient acceptance: ${params.toEmail}`

      return {
        sent: false,
        error: reason,
        messageId: delivery.messageId,
        accepted,
        rejected,
      }
    }

    return {
      sent: true,
      messageId: delivery.messageId,
      accepted,
      rejected,
    }
  } catch (error) {
    console.error("Error sending site visit invite notification:", error)
    const detail = error instanceof Error && error.message ? error.message : "Unknown SMTP delivery error."

    return {
      sent: false,
      error: detail,
    }
  }
}