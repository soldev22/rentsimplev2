import "server-only"

import { createHash, randomBytes } from "node:crypto"
import { cookies } from "next/headers"

import { normalizeEmail } from "@/lib/auth"
import { clearUserSession, getUserBySession, setUserSession } from "@/lib/server/users"

const SESSION_COOKIE_NAME = "rentsimple_session"
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30

function createSessionToken() {
  return randomBytes(32).toString("hex")
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

function parseSessionCookieValue(value: string | undefined) {
  if (!value) {
    return null
  }

  const separatorIndex = value.indexOf("|")

  if (separatorIndex <= 0 || separatorIndex >= value.length - 1) {
    return null
  }

  return {
    email: value.slice(0, separatorIndex),
    token: value.slice(separatorIndex + 1),
  }
}

export async function createSession(email: string) {
  const normalizedEmail = normalizeEmail(email)
  const token = createSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

  await setUserSession(normalizedEmail, hashSessionToken(token), expiresAt.toISOString())

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, `${normalizedEmail}|${token}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  })
}

export async function destroySession() {
  const cookieStore = await cookies()
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value)

  if (session) {
    await clearUserSession(session.email)
  }

  cookieStore.delete(SESSION_COOKIE_NAME)
}

export async function getSessionUser() {
  const cookieStore = await cookies()
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value)

  if (!session) {
    return null
  }

  const user = await getUserBySession(session.email, hashSessionToken(session.token))

  // Don't delete the cookie here - it can only be deleted in Server Actions/Route Handlers
  // Return null if user is invalid; let the logout handler clean up
  if (!user) {
    return null
  }

  return user
}

/**
 * Clear an invalid session cookie (must be called from a Route Handler or Server Action)
 */
export async function clearInvalidSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}