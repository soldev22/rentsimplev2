import "server-only"

import { auth, currentUser } from "@clerk/nextjs/server"

import { isClerkConfigured } from "@/lib/clerk-env"
import { ensureClerkUser } from "@/lib/server/users"

export async function createSession(email: string) {
  void email
}

export async function destroySession() {
  return
}

export async function getSessionUser() {
  if (!isClerkConfigured()) {
    return null
  }

  const { userId } = await auth()

  if (!userId) {
    return null
  }

  const clerkUser = await currentUser()

  if (!clerkUser) {
    return null
  }

  const email = clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress

  if (!email) {
    return null
  }

  return ensureClerkUser({
    clerkUserId: clerkUser.id,
    email,
    firstName: clerkUser.firstName,
    lastName: clerkUser.lastName,
    mobile: clerkUser.primaryPhoneNumber?.phoneNumber ?? null,
  })
}