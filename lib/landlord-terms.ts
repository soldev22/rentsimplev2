import type { AuthUser } from "@/lib/types/user"

// Bump this whenever the terms change so every Landlord is asked to accept again.
export const LANDLORD_TERMS_VERSION = "2026-10-draft-1"

// The terms are a draft awaiting solicitor review; unresolved values show as [placeholders].
export const LANDLORD_TERMS_IS_PLACEHOLDER = true

export function needsLandlordTermsAcceptance(
  user: Pick<AuthUser, "role" | "termsVersion" | "termsReagreeRequestedAt">,
) {
  return (
    user.role === "landlord" &&
    (user.termsVersion !== LANDLORD_TERMS_VERSION || Boolean(user.termsReagreeRequestedAt))
  )
}

// True when a Landlord accepted terms before but must now accept the updated terms.
export function isLandlordTermsReagreement(
  user: Pick<AuthUser, "role" | "termsVersion" | "termsReagreeRequestedAt" | "termsAcceptedAt">,
) {
  return Boolean(user.termsAcceptedAt) && needsLandlordTermsAcceptance(user)
}
