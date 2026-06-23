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
  const landlordRegisteredEmail = input.landlord?.email.trim() || ""
  const landlordTransactionalEmail = input.landlord?.notificationProfile?.outboundEmail.trim() || landlordRegisteredEmail

  if (landlordTransactionalEmail) {
    return {
      fromAddress: landlordTransactionalEmail,
      fromName: getPartyName(input.landlord),
      replyTo: landlordTransactionalEmail,
      copiedTo:
        landlordRegisteredEmail && landlordRegisteredEmail.toLowerCase() !== landlordTransactionalEmail.toLowerCase()
          ? [landlordRegisteredEmail]
          : [],
      detail:
        landlordRegisteredEmail && landlordRegisteredEmail.toLowerCase() !== landlordTransactionalEmail.toLowerCase()
          ? "Email sent directly between the tenant and the landlord transactional address and copied to the landlord registered onboarding email."
          : "Email sent directly between the tenant and the landlord registered onboarding email.",
    }
  }

  return {
    fromAddress: input.platformFromAddress,
    fromName: "RentSimple",
    replyTo: input.platformFromAddress,
    copiedTo: [],
    detail: "Email used the RentSimple platform sender because no landlord transactional or registered email was available.",
  }
}