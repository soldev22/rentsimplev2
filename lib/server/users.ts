import "server-only"

import type { ItemResponse } from "@azure/cosmos"

import { type AuthUser, normalizeEmail } from "@/lib/auth"
import { getUsersContainer } from "@/lib/server/cosmos"
import { hashPassword, verifyPassword } from "@/lib/server/password"

type StoredUser = AuthUser & {
  passwordHash?: string
  sessionTokenHash?: string
  sessionExpiresAt?: string
  auth_provider?: "local" | "clerk"
  clerk_user_id?: string
}

function isNotFoundError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 404
}

function sanitizeUser(user: StoredUser): AuthUser {
  const { passwordHash: _passwordHash, sessionTokenHash: _sessionTokenHash, sessionExpiresAt: _sessionExpiresAt, ...publicUser } = user
  return publicUser
}

async function readStoredUser(email: string) {
  const normalizedEmail = normalizeEmail(email)
  const container = await getUsersContainer()

  try {
    const response: ItemResponse<StoredUser> = await container.item(normalizedEmail, normalizedEmail).read<StoredUser>()
    return response.resource ?? null
  } catch (error) {
    if (isNotFoundError(error)) {
      return null
    }

    throw error
  }
}

async function writeStoredUser(user: StoredUser) {
  const container = await getUsersContainer()
  await container.items.upsert(user)
  return user
}

export async function ensureClerkUser(input: {
  clerkUserId: string
  email: string
  firstName?: string | null
  lastName?: string | null
  mobile?: string | null
}) {
  const normalizedEmail = normalizeEmail(input.email)
  const existingUser = await readStoredUser(normalizedEmail)
  const timestamp = new Date().toISOString()

  if (existingUser) {
    const updatedUser: StoredUser = {
      ...existingUser,
      email: normalizedEmail,
      first_name: input.firstName?.trim() || existingUser.first_name,
      last_name: input.lastName?.trim() || existingUser.last_name,
      mobile: input.mobile?.trim() || existingUser.mobile,
      auth_provider: "clerk",
      clerk_user_id: input.clerkUserId,
      updatedAt: timestamp,
    }

    await writeStoredUser(updatedUser)
    return sanitizeUser(updatedUser)
  }

  const storedUser: StoredUser = {
    id: normalizedEmail,
    email: normalizedEmail,
    first_name: input.firstName?.trim() || "",
    last_name: input.lastName?.trim() || "",
    mobile: input.mobile?.trim() || "",
    role: "unallocated",
    approval_status: "pending_approval",
    createdAt: timestamp,
    updatedAt: timestamp,
    auth_provider: "clerk",
    clerk_user_id: input.clerkUserId,
  }

  await writeStoredUser(storedUser)
  return sanitizeUser(storedUser)
}

export async function createUser(input: {
  email: string
  password: string
  firstName: string
  lastName: string
  mobile: string
}) {
  const normalizedEmail = normalizeEmail(input.email)
  const existingUser = await readStoredUser(normalizedEmail)

  if (existingUser) {
    return { user: null, error: "An account with this email already exists. Try logging in instead." }
  }

  const timestamp = new Date().toISOString()
  const storedUser: StoredUser = {
    id: normalizedEmail,
    email: normalizedEmail,
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    mobile: input.mobile.trim(),
    role: "unallocated",
    approval_status: "pending_approval",
    createdAt: timestamp,
    updatedAt: timestamp,
    passwordHash: hashPassword(input.password),
  }

  await writeStoredUser(storedUser)

  return { user: sanitizeUser(storedUser), error: null }
}

export async function authenticateUser(input: { email: string; password: string }) {
  const storedUser = await readStoredUser(input.email)

  if (!storedUser?.passwordHash || !verifyPassword(input.password, storedUser.passwordHash)) {
    return {
      user: null,
      error: "We could not sign you in with that email and password. Check the details or register an account first.",
    }
  }

  return { user: sanitizeUser(storedUser), error: null }
}

export async function getUserByEmail(email: string) {
  const storedUser = await readStoredUser(email)
  return storedUser ? sanitizeUser(storedUser) : null
}

export async function setUserSession(email: string, sessionTokenHash: string, sessionExpiresAt: string) {
  const storedUser = await readStoredUser(email)

  if (!storedUser) {
    return null
  }

  storedUser.sessionTokenHash = sessionTokenHash
  storedUser.sessionExpiresAt = sessionExpiresAt
  storedUser.updatedAt = new Date().toISOString()

  await writeStoredUser(storedUser)

  return sanitizeUser(storedUser)
}

export async function clearUserSession(email: string) {
  const storedUser = await readStoredUser(email)

  if (!storedUser) {
    return
  }

  delete storedUser.sessionTokenHash
  delete storedUser.sessionExpiresAt
  storedUser.updatedAt = new Date().toISOString()

  await writeStoredUser(storedUser)
}

export async function getUserBySession(email: string, sessionTokenHash: string) {
  const storedUser = await readStoredUser(email)

  if (!storedUser?.sessionTokenHash || storedUser.sessionTokenHash !== sessionTokenHash) {
    return null
  }

  if (!storedUser.sessionExpiresAt || Date.parse(storedUser.sessionExpiresAt) <= Date.now()) {
    return null
  }

  return sanitizeUser(storedUser)
}