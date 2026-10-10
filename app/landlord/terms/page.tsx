import { redirect } from "next/navigation"

import { buildLandlordTerms } from "@/lib/landlord-terms-content"
import {
  LANDLORD_TERMS_IS_PLACEHOLDER,
  LANDLORD_TERMS_VERSION,
  isLandlordTermsReagreement,
  needsLandlordTermsAcceptance,
} from "@/lib/landlord-terms"
import { listPropertiesForUser } from "@/lib/server/properties"
import { getSessionUser } from "@/lib/server/session"

import LandlordTermsClient from "./terms-client"

export default async function LandlordTermsPage() {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  if (user.role !== "landlord") {
    redirect("/dashboard")
  }

  const properties = await listPropertiesForUser(user).catch((error) => {
    console.error("Unable to load properties for Landlord terms", error)
    return []
  })

  return (
    <LandlordTermsClient
      displayName={`${user.first_name} ${user.last_name}`.trim() || user.email}
      alreadyAccepted={!needsLandlordTermsAcceptance(user)}
      acceptedAt={user.termsAcceptedAt}
      isReagreement={isLandlordTermsReagreement(user)}
      version={LANDLORD_TERMS_VERSION}
      isPlaceholder={LANDLORD_TERMS_IS_PLACEHOLDER}
      sections={buildLandlordTerms({ landlord: user, properties })}
    />
  )
}