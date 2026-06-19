import "server-only"

import type { ItemResponse } from "@azure/cosmos"

import { type ApplicantProfileDefaults, type ApprovalStatus, type AuthUser, type UserRole, getUserRole, normalizeEmail } from "@/lib/auth"
import { getUsersContainer } from "@/lib/server/cosmos"
import { hashPassword, verifyPassword } from "@/lib/server/password"

type StoredUser = AuthUser & {
  passwordHash?: string
  sessionTokenHash?: string
  sessionExpiresAt?: string
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

function hasLocalPassword(user: StoredUser | null) {
  return Boolean(user?.passwordHash)
}

function assertAdmin(user: AuthUser) {
  if (getUserRole(user) !== "admin") {
    throw new Error("Forbidden")
  }
}

function assertApplicant(user: AuthUser) {
  if (getUserRole(user) !== "applicant") {
    throw new Error("Forbidden")
  }
}

function toNonNegativeNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

function normalizeApplicantProfile(input: Partial<ApplicantProfileDefaults> | undefined): ApplicantProfileDefaults {
  const preferredContactMethods = Array.isArray(input?.preferredContactMethods)
    ? input.preferredContactMethods.filter(
        (value): value is ApplicantProfileDefaults["preferredContactMethods"][number] =>
          value === "email" || value === "phone" || value === "sms" || value === "whatsapp",
      )
    : []

  return {
    employmentStatus: input?.employmentStatus ?? "employed_full_time",
    annualIncome: toNonNegativeNumber(input?.annualIncome),
    moveInDate: typeof input?.moveInDate === "string" ? input.moveInDate.trim() : "",
    preferredContactMethods,
    hasPets: Boolean(input?.hasPets),
    petDetails: typeof input?.petDetails === "string" ? input.petDetails.trim() : "",
    smokes: Boolean(input?.smokes),
    occupantCount: Math.max(1, Math.round(toNonNegativeNumber(input?.occupantCount) || 1)),
    hasAdverseCredit: Boolean(input?.hasAdverseCredit),
    adverseCreditDetails: typeof input?.adverseCreditDetails === "string" ? input.adverseCreditDetails.trim() : "",
  }
}

function normalizeManagedUserInput(input: {
  role?: UserRole
  approval_status?: ApprovalStatus
}) {
  const role = input.role ?? "unallocated"
  const approvalStatus = input.approval_status ?? (role === "unallocated" ? "pending_approval" : "approved")

  return {
    role,
    approval_status: role === "unallocated" ? "pending_approval" : approvalStatus,
  }
}

export async function createUser(input: {
  email: string
  password: string
  firstName: string
  lastName: string
  mobile: string
  requestedRole?: "applicant"
}) {
  const normalizedEmail = normalizeEmail(input.email)
  const existingUser = await readStoredUser(normalizedEmail)
  const requestedRole = input.requestedRole === "applicant" ? "applicant" : "unallocated"
  const requestedApprovalStatus = requestedRole === "applicant" ? "approved" : "pending_approval"

  if (existingUser && !hasLocalPassword(existingUser)) {
    const updatedUser: StoredUser = {
      ...existingUser,
      email: normalizedEmail,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      mobile: input.mobile.trim(),
      role: requestedRole,
      approval_status: requestedApprovalStatus,
      updatedAt: new Date().toISOString(),
      passwordHash: hashPassword(input.password),
    }

    await writeStoredUser(updatedUser)

    return { user: sanitizeUser(updatedUser), error: null }
  }

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
    role: requestedRole,
    approval_status: requestedApprovalStatus,
    createdAt: timestamp,
    updatedAt: timestamp,
    passwordHash: hashPassword(input.password),
  }

  await writeStoredUser(storedUser)

  return { user: sanitizeUser(storedUser), error: null }
}

export async function authenticateUser(input: { email: string; password: string }) {
  const storedUser = await readStoredUser(input.email)

  if (storedUser && !hasLocalPassword(storedUser)) {
    return {
      user: null,
      error: "This account still needs a local password. Register again with the same email to finish setting one.",
    }
  }

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

export async function listUsersForAdmin(user: AuthUser) {
  assertAdmin(user)

  const container = await getUsersContainer()
  const { resources } = await container.items
    .query<StoredUser>({
      query: "SELECT * FROM c ORDER BY c.createdAt DESC",
    })
    .fetchAll()

  return resources.map(sanitizeUser)
}

export async function updateUserForAdmin(
  adminUser: AuthUser,
  email: string,
  input: {
    role?: UserRole
    approval_status?: ApprovalStatus
  },
) {
  assertAdmin(adminUser)

  const normalizedEmail = normalizeEmail(email)

  if (normalizedEmail === adminUser.email && input.role && input.role !== "admin") {
    throw new Error("CannotChangeOwnAdminRole")
  }

  const storedUser = await readStoredUser(normalizedEmail)

  if (!storedUser) {
    return null
  }

  const managedInput = normalizeManagedUserInput(input)
  const updatedUser: StoredUser = {
    ...storedUser,
    role: managedInput.role,
    approval_status: normalizedEmail === adminUser.email ? "approved" : managedInput.approval_status,
    updatedAt: new Date().toISOString(),
  }

  await writeStoredUser(updatedUser)

  return sanitizeUser(updatedUser)
}

export async function setUserRoleForWorkflow(email: string, role: UserRole, approval_status: ApprovalStatus = "approved") {
  const normalizedEmail = normalizeEmail(email)
  const storedUser = await readStoredUser(normalizedEmail)

  if (!storedUser) {
    return null
  }

  const updatedUser: StoredUser = {
    ...storedUser,
    role,
    approval_status,
    updatedAt: new Date().toISOString(),
  }

  await writeStoredUser(updatedUser)

  return sanitizeUser(updatedUser)
}

export async function updateApplicantProfile(user: AuthUser, input: Partial<ApplicantProfileDefaults>) {
  assertApplicant(user)

  const storedUser = await readStoredUser(user.email)

  if (!storedUser) {
    return null
  }

  const updatedUser: StoredUser = {
    ...storedUser,
    applicantProfile: normalizeApplicantProfile(input),
    updatedAt: new Date().toISOString(),
  }

  await writeStoredUser(updatedUser)
  return sanitizeUser(updatedUser)
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