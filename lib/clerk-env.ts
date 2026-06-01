const CLERK_PUBLISHABLE_KEY_PLACEHOLDER = "pk_test_your_clerk_publishable_key"
const CLERK_SECRET_KEY_PLACEHOLDER = "sk_test_your_clerk_secret_key"

function hasRealValue(value: string | undefined, placeholder: string) {
  return Boolean(value && value !== placeholder)
}

export function hasClerkPublishableKey() {
  return hasRealValue(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_PUBLISHABLE_KEY_PLACEHOLDER)
}

export function hasClerkSecretKey() {
  return hasRealValue(process.env.CLERK_SECRET_KEY, CLERK_SECRET_KEY_PLACEHOLDER)
}

export function isClerkConfigured() {
  return hasClerkPublishableKey() && hasClerkSecretKey()
}