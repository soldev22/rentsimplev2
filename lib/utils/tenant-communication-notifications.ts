import type {
  TenantCommunicationEntry,
  TenantCommunicationNotificationStatus,
} from "@/lib/auth"

export type TenantNotificationAudience = {
  tenantName: string
  tenantEmail: string
  tenantMobile?: string
  propertyAddress: string
}

export type PreparedTenantCommunicationNotification =
  | {
      kind: "none"
      status: Extract<TenantCommunicationNotificationStatus, "not_applicable" | "skipped">
      detail: string
    }
  | {
      kind: "email"
      target: string
      subject: string
      message: string
    }
  | {
      kind: "sms"
      target: string
      message: string
    }

function normalizePhoneNumber(value: string | undefined) {
  return typeof value === "string" ? value.trim() : ""
}

export function prepareTenantCommunicationNotification(
  audience: TenantNotificationAudience,
  entry: TenantCommunicationEntry,
): PreparedTenantCommunicationNotification {
  if (entry.direction !== "outbound") {
    return {
      kind: "none",
      status: "not_applicable",
      detail: "Inbound communication entry; no outgoing notification sent.",
    }
  }

  if (entry.channel === "email") {
    if (!audience.tenantEmail.trim()) {
      return {
        kind: "none",
        status: "skipped",
        detail: "Tenant email address is missing.",
      }
    }

    return {
      kind: "email",
      target: audience.tenantEmail.trim(),
      subject: `RentSimple update: ${entry.subject}`,
      message: [
        `Hello ${audience.tenantName},`,
        "",
        `${entry.subject}`,
        "",
        `${entry.summary}`,
        "",
        `Property: ${audience.propertyAddress}`,
        `Recorded: ${new Date(entry.occurredAt).toLocaleString()}`,
        "",
        "RentSimple",
      ].join("\n"),
    }
  }

  if (entry.channel === "sms") {
    const mobile = normalizePhoneNumber(audience.tenantMobile)

    if (!mobile) {
      return {
        kind: "none",
        status: "skipped",
        detail: "Tenant mobile number is missing.",
      }
    }

    return {
      kind: "sms",
      target: mobile,
      message: `${entry.subject}: ${entry.summary} (${audience.propertyAddress})`,
    }
  }

  return {
    kind: "none",
    status: "not_applicable",
    detail: `Channel ${entry.channel.replaceAll("_", " ")} is logged only and does not send an email or SMS notification.`,
  }
}