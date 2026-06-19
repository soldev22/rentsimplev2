import { describe, expect, it } from "vitest"

import type { TenantCommunicationEntry } from "@/lib/auth"
import { prepareTenantCommunicationNotification } from "@/lib/utils/tenant-communication-notifications"

const audience = {
  tenantName: "Alex Tenant",
  tenantEmail: "alex@example.com",
  tenantMobile: "+447700900123",
  propertyAddress: "12 Demo Street",
}

function createEntry(overrides: Partial<TenantCommunicationEntry> = {}): TenantCommunicationEntry {
  return {
    id: "entry-1",
    occurredAt: "2026-06-19T09:00:00.000Z",
    channel: "email",
    direction: "outbound",
    subject: "Rent reminder",
    summary: "Your rent is due on the first of the month.",
    recordedByName: "Admin User",
    ...overrides,
  }
}

describe("prepareTenantCommunicationNotification", () => {
  it("builds an email notification for outbound email entries", () => {
    const prepared = prepareTenantCommunicationNotification(audience, createEntry())

    expect(prepared.kind).toBe("email")
    if (prepared.kind !== "email") {
      return
    }

    expect(prepared.target).toBe("alex@example.com")
    expect(prepared.subject).toContain("Rent reminder")
    expect(prepared.message).toContain("12 Demo Street")
  })

  it("builds an sms notification for outbound sms entries", () => {
    const prepared = prepareTenantCommunicationNotification(audience, createEntry({ channel: "sms" }))

    expect(prepared.kind).toBe("sms")
    if (prepared.kind !== "sms") {
      return
    }

    expect(prepared.target).toBe("+447700900123")
    expect(prepared.message).toContain("Rent reminder")
  })

  it("marks inbound entries as not applicable", () => {
    const prepared = prepareTenantCommunicationNotification(audience, createEntry({ direction: "inbound" }))

    expect(prepared).toEqual({
      kind: "none",
      status: "not_applicable",
      detail: "Inbound communication entry; no outgoing notification sent.",
    })
  })

  it("skips sms when no mobile number is available", () => {
    const prepared = prepareTenantCommunicationNotification(
      { ...audience, tenantMobile: "" },
      createEntry({ channel: "sms" }),
    )

    expect(prepared).toEqual({
      kind: "none",
      status: "skipped",
      detail: "Tenant mobile number is missing.",
    })
  })
})