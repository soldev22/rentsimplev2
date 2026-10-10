import "server-only"

import { createHash, randomBytes } from "node:crypto"
import { cookies } from "next/headers"

import { clearUserSession, getUserBySession, setUserSession } from "@/lib/server/users"

const SESSION_COOKIE_NAME = "rentsimple_session"
const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
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

  const userId = value.slice(0, separatorIndex).toLowerCase()

  // Legacy cookies keyed by email are treated as signed out.
  if (!USER_ID_PATTERN.test(userId)) {
    return null
  }

  return {
    userId,
    token: value.slice(separatorIndex + 1),
  }
}

export async function createSession(userId: string) {
  const normalizedUserId = userId.trim().toLowerCase()
  const token = createSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

  await setUserSession(normalizedUserId, hashSessionToken(token), expiresAt.toISOString())

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, `${normalizedUserId}|${token}`, {
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
    await clearUserSession(session.userId)
  }

  cookieStore.delete(SESSION_COOKIE_NAME)
}

export async function getSessionUser() {
  const cookieStore = await cookies()
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value)

  if (!session) {
    return null
  }

  const user = await getUserBySession(session.userId, hashSessionToken(session.token))

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