import { describe, expect, it } from "vitest"

import { resolveTenantCommunicationEmailRouting } from "@/lib/utils/tenant-communication-routing"

describe("resolveTenantCommunicationEmailRouting", () => {
  it("uses the landlord transactional email and does not copy when copy preference is disabled", () => {
    const routing = resolveTenantCommunicationEmailRouting({
      platformFromAddress: "notifications@rentsimple.co.uk",
      landlord: {
        email: "landlord@example.com",
        first_name: "Lana",
        last_name: "Landlord",
        notificationProfile: {
          outboundEmail: "case-123@rentsimple.co.uk",
          copyLandlordOnTenantEmails: false,
        },
      },
      managingAgent: {
        email: "agent@example.com",
        first_name: "Ava",
        last_name: "Agent",
        notificationProfile: {
          outboundEmail: "larn.agent@example.com",
          copyLandlordOnTenantEmails: true,
        },
      },
    })

    expect(routing.fromAddress).toBe("case-123@rentsimple.co.uk")
    expect(routing.replyTo).toBe("case-123@rentsimple.co.uk")
    expect(routing.copiedTo).toEqual([])
  })

  it("copies the registered landlord email when copy preference is enabled", () => {
    const routing = resolveTenantCommunicationEmailRouting({
      platformFromAddress: "notifications@rentsimple.co.uk",
      landlord: {
        email: "landlord@example.com",
        first_name: "Lana",
        last_name: "Landlord",
        notificationProfile: {
          outboundEmail: "case-123@rentsimple.co.uk",
          copyLandlordOnTenantEmails: true,
        },
      },
      managingAgent: null,
    })

    expect(routing.fromAddress).toBe("case-123@rentsimple.co.uk")
    expect(routing.replyTo).toBe("case-123@rentsimple.co.uk")
    expect(routing.copiedTo).toEqual(["landlord@example.com"])
  })

  it("uses the landlord registered email when no transactional alias exists", () => {
    const routing = resolveTenantCommunicationEmailRouting({
      platformFromAddress: "notifications@rentsimple.co.uk",
      landlord: {
        email: "landlord@example.com",
        first_name: "Lana",
        last_name: "Landlord",
        notificationProfile: undefined,
      },
      managingAgent: null,
    })

    expect(routing.fromAddress).toBe("landlord@example.com")
    expect(routing.replyTo).toBe("landlord@example.com")
    expect(routing.copiedTo).toEqual([])
  })

  it("ignores agent email settings for tenant-landlord correspondence", () => {
    const routing = resolveTenantCommunicationEmailRouting({
      platformFromAddress: "notifications@rentsimple.co.uk",
      landlord: {
        email: "landlord@example.com",
        first_name: "Lana",
        last_name: "Landlord",
        notificationProfile: {
          outboundEmail: "landlord-alias@rentsimple.co.uk",
          copyLandlordOnTenantEmails: false,
        },
      },
      managingAgent: {
        email: "agent@example.com",
        first_name: "Ava",
        last_name: "Agent",
        notificationProfile: {
          outboundEmail: "agent@example.com",
          copyLandlordOnTenantEmails: false,
        },
      },
    })

    expect(routing.fromAddress).toBe("landlord-alias@rentsimple.co.uk")
    expect(routing.replyTo).toBe("landlord-alias@rentsimple.co.uk")
    expect(routing.copiedTo).toEqual([])
  })

  it("falls back to the platform sender when no user emails are available", () => {
    const routing = resolveTenantCommunicationEmailRouting({
      platformFromAddress: "notifications@rentsimple.co.uk",
      landlord: null,
      managingAgent: null,
    })

    expect(routing.fromAddress).toBe("notifications@rentsimple.co.uk")
    expect(routing.replyTo).toBe("notifications@rentsimple.co.uk")
  })
})