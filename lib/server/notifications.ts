import "server-only"

import type { TenantCommunicationEntry, TenantCommunicationNotification, TenancyApplicationRecord } from "@/lib/auth"
import { getPropertyByIdForSystem } from "@/lib/server/properties"
import { prepareTenantCommunicationNotification } from "@/lib/utils/tenant-communication-notifications"
import { resolveTenantCommunicationEmailRouting } from "@/lib/utils/tenant-communication-routing"
import { getUserByEmail, getUserById, listApprovedGlobalAdmins } from "@/lib/server/users"
import { getPlatformFromAddress, sendEmail } from "@/lib/server/email"
import { sendSms } from "@/lib/server/sms"

type DeliveryResult = {
  status: TenantCommunicationNotification["status"]
  detail: string
  attemptedAt?: string
  sentAt?: string
  fromAddress?: string
  replyTo?: string
  copiedTo?: string[]
}

function formatPlatformFromName(routedName: string) {
  return routedName && routedName !== "RentSimple" ? `${routedName} via RentSimple` : "RentSimple"
}

function getPublicAppOrigin() {
  const configuredOrigin = process.env.NEXT_PUBLIC_BASE_URL?.trim()
  if (configuredOrigin) {
    return configuredOrigin.replace(/\/+$/, "")
  }

  const deploymentHost = process.env.VERCEL_URL?.trim()
  if (deploymentHost) {
    return `https://${deploymentHost}`
  }

  return "http://localhost:3000"
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
  const platformFromAddress = getPlatformFromAddress()
  const attemptedAt = new Date().toISOString()

  if (!platformFromAddress) {
    return {
      status: "skipped",
      attemptedAt,
      detail: "Email delivery is not configured.",
    }
  }

  const routing = await resolveEmailRouting(application, platformFromAddress)
  const delivery = await sendEmail({
    to,
    cc: routing.copiedTo.length > 0 ? routing.copiedTo : undefined,
    fromName: formatPlatformFromName(routing.fromName),
    replyTo: routing.replyTo,
    subject,
    text,
    tag: "tenant-communication",
  })
  const fromAddress = delivery.fromAddress ?? platformFromAddress

  if (delivery.status === "sent") {
    return {
      status: "sent",
      attemptedAt,
      sentAt: new Date().toISOString(),
      fromAddress,
      replyTo: routing.replyTo,
      copiedTo: routing.copiedTo,
      detail: `${routing.detail} Delivered using the platform sender ${fromAddress}.`,
    }
  }

  return {
    status: delivery.status,
    attemptedAt,
    fromAddress,
    replyTo: routing.replyTo,
    copiedTo: routing.copiedTo,
    detail: `${routing.detail} Delivery via the platform sender ${fromAddress} did not complete. ${delivery.detail}`.trim(),
  }
}

export async function sendNewApplicationNotifications(application: TenancyApplicationRecord): Promise<boolean> {
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

    const reviewUrl = `${getPublicAppOrigin()}/dashboard/applications?applicationId=${encodeURIComponent(application.id)}`
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
    const deliveries = await Promise.all(recipients.map((to) => sendEmail({
      fromName: "RentSimple Notifications",
      to,
      subject,
      text,
    })))
    const failed = deliveries.filter((delivery) => delivery.status !== "sent")

    if (failed.length > 0) {
      console.warn(`New application notifications not fully sent: ${failed.map((delivery) => delivery.detail).join("; ")}`)
      return false
    }

    return true
  } catch (error) {
    console.error("Error sending new application notifications:", error)
    return false
  }
}

async function sendSmsNotification(to: string, body: string): Promise<DeliveryResult> {
  const attemptedAt = new Date().toISOString()
  const result = await sendSms(to, body)

  return result.status === "sent"
    ? { status: "sent", attemptedAt, sentAt: new Date().toISOString(), detail: result.detail }
    : { status: result.status, attemptedAt, detail: result.detail }
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
  try {
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

    const delivery = await sendEmail({
      fromName: "RentSimple Notifications",
      to: params.toEmail,
      subject,
      text,
    })

    if (delivery.status !== "sent") {
      console.warn(`Email notification not sent: ${delivery.detail}`)
      return false
    }

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
  try {
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

    const delivery = await sendEmail({
      fromName: "RentSimple Notifications",
      to: params.toEmail,
      subject,
      text,
    })

    if (delivery.status !== "sent") {
      console.warn(`Email notification not sent: ${delivery.detail}`)
      return false
    }

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
  try {
    const subject = `Deposit reminder for ${params.propertyAddress}`
    const text = [
      `Hello ${params.tenantName},`,
      "",
      `This is a reminder that your tenancy deposit of ${params.currency} ${params.amount.toLocaleString("en-GB")} is still outstanding.`,
      params.dueDate ? `Due date: ${new Date(params.dueDate).toLocaleDateString("en-GB")}` : "",
      "",
      "Please review the deposit request in your RentSimple dashboard.",
    ].filter(Boolean).join("\n")

    const delivery = await sendEmail({
      fromName: "RentSimple Notifications",
      to: params.toEmail,
      subject,
      text,
    })

    if (delivery.status !== "sent") {
      console.warn(`Email notification not sent: ${delivery.detail}`)
      return false
    }

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
  try {
    const subject = `Deposit payment received confirmation for ${params.propertyAddress}`
    const text = [
      `Deposit payment for ${params.tenantName} at ${params.propertyAddress} has been marked as received.`,
      "",
      `Amount: ${params.currency} ${params.amount.toLocaleString("en-GB")}`,
      "",
      "Next action: record deposit protection details in RentSimple.",
    ].join("\n")

    const delivery = await sendEmail({
      fromName: "RentSimple Notifications",
      to: params.toEmail,
      subject,
      text,
    })

    if (delivery.status !== "sent") {
      console.warn(`Email notification not sent: ${delivery.detail}`)
      return false
    }

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
  try {
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

    const delivery = await sendEmail({
      fromName: "RentSimple Notifications",
      to: params.toEmail,
      subject,
      text,
    })

    if (delivery.status !== "sent") {
      console.warn(`Email notification not sent: ${delivery.detail}`)
      return false
    }

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
  try {
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

    const delivery = await sendEmail({
      fromName: "RentSimple Notifications",
      to: params.toEmail,
      subject,
      text,
    })

    if (delivery.status !== "sent") {
      console.warn(`Email notification not sent: ${delivery.detail}`)
      return false
    }

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
  try {
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

    const delivery = await sendEmail({
      fromName: "RentSimple Notifications",
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

    if (delivery.status !== "sent") {
      console.warn(`Email notification not sent: ${delivery.detail}`)
      return false
    }

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
  try {
    const dueDate = new Date(params.dueAt)
    const now = new Date()
    const daysOverdue = Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

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

    const delivery = await sendEmail({
      fromName: "RentSimple Cases",
      to: params.recipientEmail,
      subject,
      html,
    })

    if (delivery.status !== "sent") {
      console.warn(`Email notification not sent: ${delivery.detail}`)
      return false
    }

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
  try {
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

    const delivery = await sendEmail({
      fromName: "RentSimple Viewings",
      to: params.toEmail,
      subject,
      text,
      tag: "site-visit-invite",
    })

    if (delivery.status !== "sent") {
      console.warn(`Site visit invite notification not sent: ${delivery.detail}`)
      return {
        sent: false,
        error: delivery.detail,
        messageId: delivery.messageId,
      }
    }

    return {
      sent: true,
      messageId: delivery.messageId,
      accepted: [params.toEmail.trim().toLowerCase()],
      rejected: [],
    }
  } catch (error) {
    console.error("Error sending site visit invite notification:", error)
    const detail = error instanceof Error && error.message ? error.message : "Unknown email delivery error."

    return {
      sent: false,
      error: detail,
    }
  }
}