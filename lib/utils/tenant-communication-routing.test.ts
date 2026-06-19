import { describe, expect, it } from "vitest"

import { resolveTenantCommunicationEmailRouting } from "@/lib/utils/tenant-communication-routing"

describe("resolveTenantCommunicationEmailRouting", () => {
  it("uses the managing agent email and copies the landlord", () => {
    const routing = resolveTenantCommunicationEmailRouting({
      platformFromAddress: "notifications@rentsimple.co.uk",
      landlord: {
        email: "landlord@example.com",
        first_name: "Lana",
        last_name: "Landlord",
        notificationProfile: undefined,
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

    expect(routing.fromAddress).toBe("larn.agent@example.com")
    expect(routing.replyTo).toBe("larn.agent@example.com")
    expect(routing.copiedTo).toEqual(["landlord@example.com"])
  })

  it("uses the landlord email when no managing agent exists", () => {
    const routing = resolveTenantCommunicationEmailRouting({
      platformFromAddress: "notifications@rentsimple.co.uk",
      landlord: {
        email: "landlord@example.com",
        first_name: "Lana",
        last_name: "Landlord",
        notificationProfile: {
          outboundEmail: "portfolio@landlord.example.com",
          copyLandlordOnTenantEmails: false,
        },
      },
      managingAgent: null,
    })

    expect(routing.fromAddress).toBe("portfolio@landlord.example.com")
    expect(routing.copiedTo).toEqual([])
  })

  it("lets an agent disable landlord copying when needed", () => {
    const routing = resolveTenantCommunicationEmailRouting({
      platformFromAddress: "notifications@rentsimple.co.uk",
      landlord: {
        email: "landlord@example.com",
        first_name: "Lana",
        last_name: "Landlord",
        notificationProfile: undefined,
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