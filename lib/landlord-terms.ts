import type { AuthUser } from "@/lib/types/user"

// Bump this whenever the terms change so every Landlord is asked to accept again.
export const LANDLORD_TERMS_VERSION = "2026-10-draft-1"

// The terms are a draft awaiting solicitor review; unresolved values show as [placeholders].
export const LANDLORD_TERMS_IS_PLACEHOLDER = true

export function needsLandlordTermsAcceptance(user: Pick<AuthUser, "role" | "termsVersion">) {
  return user.role === "landlord" && user.termsVersion !== LANDLORD_TERMS_VERSION
}
