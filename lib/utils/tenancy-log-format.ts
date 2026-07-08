import type { TenantCommunicationEntry, TenancyApplicationRecord } from "@/lib/auth"

type TimelineEntry = {
  occurredAt: string
  title: string
  detail: string
  category: "event" | "communication"
}

function formatDateTime(value: string | undefined) {
  if (!value) {
    return "Not recorded"
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function buildNotificationAuditLines(entry: TenantCommunicationEntry) {
  const notification = entry.notification

  if (!notification) {
    return [] as string[]
  }

  const lines = [`Notification status: ${notification.status.replaceAll("_", " ")}`]

  if (notification.channel) {
    lines.push(`Notification channel: ${notification.channel}`)
  }

  if (notification.target) {
    lines.push(`Notification target: ${notification.target}`)
  }

  if (notification.fromAddress) {
    lines.push(`Sent from: ${notification.fromAddress}`)
  }

  if (notification.replyTo) {
    lines.push(`Reply-to: ${notification.replyTo}`)
  }

  if (notification.copiedTo && notification.copiedTo.length > 0) {
    lines.push(`Copied to: ${notification.copiedTo.join(", ")}`)
  }

  if (notification.attemptedAt) {
    lines.push(`Attempted at: ${formatDateTime(notification.attemptedAt)}`)
  }

  if (notification.sentAt) {
    lines.push(`Delivered at: ${formatDateTime(notification.sentAt)}`)
  }

  if (notification.detail) {
    lines.push(`Routing detail: ${notification.detail}`)
  }

  return lines
}

function createTimelineEntries(application: TenancyApplicationRecord) {
  const entries: TimelineEntry[] = [
    {
      occurredAt: application.submittedAt,
      title: "Application submitted",
      detail: `Application created for ${application.propertyAddress}.`,
      category: "event",
    },
  ]

  if (application.referencingReport.completedAt) {
    entries.push({
      occurredAt: application.referencingReport.completedAt,
      title: "Referencing completed",
      detail: `Outcome: ${application.referencingReport.outcome.replaceAll("_", " ")}.`,
      category: "event",
    })
  }

  if (application.approvalDecision.certificateIssuedAt) {
    entries.push({
      occurredAt: application.approvalDecision.certificateIssuedAt,
      title: "Decision recorded",
      detail: `Outcome: ${application.approvalDecision.outcome.replaceAll("_", " ")}. ${application.approvalDecision.rationale || ""}`.trim(),
      category: "event",
    })
  }

  if (application.tenancyAgreement.offerLetter.sentAt) {
    entries.push({
      occurredAt: application.tenancyAgreement.offerLetter.sentAt,
      title: "Offer letter issued",
      detail: application.tenancyAgreement.offerLetter.reference || "Offer letter sent.",
      category: "event",
    })
  }

  if (application.tenancyAgreement.leaseDocument.sentAt) {
    entries.push({
      occurredAt: application.tenancyAgreement.leaseDocument.sentAt,
      title: "Lease issued",
      detail: application.tenancyAgreement.agreementProvider || "Lease sent for signature.",
      category: "event",
    })
  }

  if (application.tenancyAgreement.leaseDocument.signedCopyReceivedAt) {
    entries.push({
      occurredAt: application.tenancyAgreement.leaseDocument.signedCopyReceivedAt,
      title: "Signed lease received",
      detail: "Signed lease copy received from the tenant.",
      category: "event",
    })
  }

  if (application.tenancyAgreement.supportingLegalDocuments.sentAt) {
    entries.push({
      occurredAt: application.tenancyAgreement.supportingLegalDocuments.sentAt,
      title: "Supporting legal documents issued",
      detail: application.tenancyAgreement.supportingLegalDocuments.summary || "Supporting legal pack issued.",
      category: "event",
    })
  }

  if (application.tenancyAgreement.supportingLegalDocuments.signedCopyReceivedAt) {
    entries.push({
      occurredAt: application.tenancyAgreement.supportingLegalDocuments.signedCopyReceivedAt,
      title: "Signed legal pack received",
      detail: "Signed supporting legal documents received from the tenant.",
      category: "event",
    })
  }

  if (application.applicantChecklist.signedAt) {
    entries.push({
      occurredAt: application.applicantChecklist.signedAt,
      title: "Applicant sign-off recorded",
      detail: `${application.applicantChecklist.signedFullName || application.applicantName} completed sign-off.`,
      category: "event",
    })
  }

  if (application.postMoveInManagement.firstInspectionDate) {
    entries.push({
      occurredAt: application.postMoveInManagement.firstInspectionDate,
      title: "First inspection scheduled",
      detail: "First post move-in inspection date recorded.",
      category: "event",
    })
  }

  application.postMoveInManagement.communicationEntries.forEach((entry: TenantCommunicationEntry) => {
    const notificationAudit = buildNotificationAuditLines(entry)
    entries.push({
      occurredAt: entry.occurredAt,
      title: `Communication: ${entry.subject}`,
      detail: [
        `${entry.direction.replaceAll("_", " ")} via ${entry.channel.replaceAll("_", " ")} by ${entry.recordedByName}. ${entry.summary}`,
        ...notificationAudit,
      ].join("\n"),
      category: "communication",
    })
  })

  return entries.sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
}

export function buildTenancyLogText(application: TenancyApplicationRecord) {
  const timeline = createTimelineEntries(application)

  const lines = [
    "RentSimple Tenancy Log",
    "",
    `Tenant: ${application.applicantName}`,
    `Email: ${application.applicantEmail}`,
    `Property: ${application.propertyAddress}`,
    `Status: ${application.status.replaceAll("_", " ")}`,
    `Stage: ${application.currentStage.replaceAll("_", " ")}`,
    `Generated: ${new Date().toLocaleString()}`,
    "",
    "Summary",
    `- Monthly rent: GBP ${application.monthlyRent.toLocaleString()}`,
    `- Preferred contact methods: ${application.applicantProfile.preferredContactMethods.join(", ") || "Not provided"}`,
    `- Approval outcome: ${application.approvalDecision.outcome.replaceAll("_", " ")}`,
    `- Agreement provider: ${application.tenancyAgreement.agreementProvider || "Not set"}`,
    `- Maintenance notes: ${application.postMoveInManagement.maintenanceLogNotes || "None recorded"}`,
    "",
    "Timeline",
    ...timeline.flatMap((entry) => [
      `[${formatDateTime(entry.occurredAt)}] ${entry.title}`,
      `${entry.detail}`,
      "",
    ]),
  ]

  return lines.join("\n")
}