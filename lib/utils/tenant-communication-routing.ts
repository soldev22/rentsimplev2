import type { AuthUser } from "@/lib/auth"

type RoutingParty = Pick<AuthUser, "email" | "first_name" | "last_name" | "notificationProfile"> | null

export type TenantCommunicationEmailRouting = {
  fromAddress: string
  fromName: string
  replyTo: string
  copiedTo: string[]
  detail: string
}

function getPartyName(party: RoutingParty) {
  if (!party) {
    return "RentSimple"
  }

  const fullName = [party.first_name, party.last_name].filter(Boolean).join(" ").trim()
  return fullName || party.email
}

export function resolveTenantCommunicationEmailRouting(input: {
  platformFromAddress: string
  landlord: RoutingParty
  managingAgent: RoutingParty
}): TenantCommunicationEmailRouting {
  const landlordEmail = input.landlord?.notificationProfile?.outboundEmail.trim() || input.landlord?.email.trim() || ""
  const agentEmail = input.managingAgent?.notificationProfile?.outboundEmail.trim() || input.managingAgent?.email.trim() || ""
  const copyLandlord = input.managingAgent?.notificationProfile?.copyLandlordOnTenantEmails !== false

  if (agentEmail) {
    return {
      fromAddress: agentEmail,
      fromName: getPartyName(input.managingAgent),
      replyTo: agentEmail,
      copiedTo: copyLandlord && landlordEmail && landlordEmail.toLowerCase() !== agentEmail.toLowerCase() ? [landlordEmail] : [],
      detail:
        copyLandlord && landlordEmail && landlordEmail.toLowerCase() !== agentEmail.toLowerCase()
          ? "Email sent directly to the tenant from the managing agent and copied to the landlord."
          : "Email sent directly to the tenant from the managing agent.",
    }
  }

  if (landlordEmail) {
    return {
      fromAddress: landlordEmail,
      fromName: getPartyName(input.landlord),
      replyTo: landlordEmail,
      copiedTo: [],
      detail: "Email sent directly to the tenant from the landlord.",
    }
  }

  return {
    fromAddress: input.platformFromAddress,
    fromName: "RentSimple",
    replyTo: input.platformFromAddress,
    copiedTo: [],
    detail: "Email sent directly to the tenant from the RentSimple platform sender because no landlord or agent email was available.",
  }
}