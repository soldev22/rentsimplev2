import "server-only"

import type { ItemResponse } from "@azure/cosmos"

import {
  type ApplicantProfileDefaults,
  type ApprovalStatus,
  type AuthUser,
  type BuilderProfileDefaults,
  type NotificationProfileDefaults,
  type UserRole,
  getUserRole,
  normalizeEmail,
} from "@/lib/auth"
import { getUsersContainer } from "@/lib/server/cosmos"
import { hashPassword, verifyPassword } from "@/lib/server/password"

type StoredUser = AuthUser & {
  passwordHash?: string
  sessionTokenHash?: string
  sessionExpiresAt?: string
}

export type LandlordDirectoryEntry = {
  id: string
  email: string
  fullName: string
}

function isNotFoundError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 404
}

function sanitizeUser(user: StoredUser): AuthUser {
  const { passwordHash: _passwordHash, sessionTokenHash: _sessionTokenHash, sessionExpiresAt: _sessionExpiresAt, ...publicUser } = user
  return publicUser
}

function getFullName(user: Pick<AuthUser, "first_name" | "last_name" | "email">) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim()
  return fullName || user.email
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

function assertBuilder(user: AuthUser) {
  if (getUserRole(user) !== "builder") {
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

function normalizeBuilderProfile(input: Partial<BuilderProfileDefaults> | undefined): BuilderProfileDefaults {
  const preferredContactMethods = Array.isArray(input?.preferredContactMethods)
    ? input.preferredContactMethods.filter(
        (value): value is BuilderProfileDefaults["preferredContactMethods"][number] =>
          value === "email" || value === "phone" || value === "sms" || value === "whatsapp",
      )
    : []

  return {
    companyName: typeof input?.companyName === "string" ? input.companyName.trim() : "",
    primaryTrade: input?.primaryTrade ?? "general_builder",
    serviceAreas: typeof input?.serviceAreas === "string" ? input.serviceAreas.trim() : "",
    preferredContactMethods,
    emergencyCalloutAvailable: Boolean(input?.emergencyCalloutAvailable),
    hourlyRateGuidance: toNonNegativeNumber(input?.hourlyRateGuidance),
    availabilityNotes: typeof input?.availabilityNotes === "string" ? input.availabilityNotes.trim() : "",
    insuranceExpiryDate: typeof input?.insuranceExpiryDate === "string" ? input.insuranceExpiryDate.trim() : "",
    gasSafeRegistered: Boolean(input?.gasSafeRegistered),
    gasSafeNumber: typeof input?.gasSafeNumber === "string" ? input.gasSafeNumber.trim() : "",
    electricalCertified: Boolean(input?.electricalCertified),
    electricalCertificationScheme:
      typeof input?.electricalCertificationScheme === "string" ? input.electricalCertificationScheme.trim() : "",
    dbsChecked: Boolean(input?.dbsChecked),
    dbsExpiryDate: typeof input?.dbsExpiryDate === "string" ? input.dbsExpiryDate.trim() : "",
    accreditationNotes: typeof input?.accreditationNotes === "string" ? input.accreditationNotes.trim() : "",
  }
}

function normalizeNotificationProfile(input: Partial<NotificationProfileDefaults> | undefined): NotificationProfileDefaults | undefined {
  if (!input) {
    return undefined
  }

  const outboundEmail = typeof input.outboundEmail === "string" ? normalizeEmail(input.outboundEmail) : ""
  const copyLandlordOnTenantEmails = Boolean(input.copyLandlordOnTenantEmails)

  if (!outboundEmail && !copyLandlordOnTenantEmails) {
    return undefined
  }

  return {
    outboundEmail,
    copyLandlordOnTenantEmails,
  }
}

function normalizeManagedUserInput(input: {
  role?: UserRole
  approval_status?: ApprovalStatus
  managedByAgentId?: string | null
  notificationProfile?: Partial<NotificationProfileDefaults> | null
}) {
  const role = input.role ?? "unallocated"
  const approvalStatus = input.approval_status ?? (role === "unallocated" ? "pending_approval" : "approved")
  const managedByAgentId =
    role === "landlord" && typeof input.managedByAgentId === "string" && input.managedByAgentId.trim()
      ? input.managedByAgentId.trim().toLowerCase()
      : undefined

  return {
    role,
    approval_status: role === "unallocated" ? "pending_approval" : approvalStatus,
    managedByAgentId,
    notificationProfile:
      role === "landlord" || role === "agent" ? normalizeNotificationProfile(input.notificationProfile ?? undefined) : undefined,
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

export async function getUserById(id: string) {
  const normalizedId = typeof id === "string" ? id.trim().toLowerCase() : ""

  if (!normalizedId) {
    return null
  }

  const container = await getUsersContainer()
  const { resources } = await container.items
    .query<StoredUser>({
      query: "SELECT * FROM c WHERE c.id = @id",
      parameters: [{ name: "@id", value: normalizedId }],
    })
    .fetchAll()

  return resources[0] ? sanitizeUser(resources[0]) : null
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
    managedByAgentId?: string | null
    notificationProfile?: Partial<NotificationProfileDefaults> | null
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
    managedByAgentId: managedInput.role === "landlord" ? managedInput.managedByAgentId : undefined,
    notificationProfile: managedInput.notificationProfile,
    updatedAt: new Date().toISOString(),
  }

  await writeStoredUser(updatedUser)

  return sanitizeUser(updatedUser)
}

async function listAllUsers() {
  const container = await getUsersContainer()
  const { resources } = await container.items
    .query<StoredUser>({
      query: "SELECT * FROM c",
    })
    .fetchAll()

  return resources.map(sanitizeUser)
}

export async function listLandlordDirectoryForUser(user: AuthUser) {
  const role = getUserRole(user)

  if (role !== "admin" && role !== "agent" && role !== "landlord") {
    throw new Error("Forbidden")
  }

  const users = await listAllUsers()

  return users
    .filter((candidate) => {
      if (candidate.role !== "landlord") {
        return false
      }

      if (role === "admin") {
        return true
      }

      if (role === "agent") {
        return candidate.managedByAgentId === user.id
      }

      return candidate.id === user.id
    })
    .map<LandlordDirectoryEntry>((candidate) => ({
      id: candidate.id,
      email: candidate.email,
      fullName: getFullName(candidate),
    }))
    .sort((left, right) => left.fullName.localeCompare(right.fullName))
}

export async function listAgentsForAdmin(user: AuthUser) {
  assertAdmin(user)

  const users = await listAllUsers()

  return users
    .filter((candidate) => candidate.role === "agent")
    .map((candidate) => ({
      id: candidate.id,
      email: candidate.email,
      fullName: getFullName(candidate),
    }))
    .sort((left, right) => left.fullName.localeCompare(right.fullName))
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

export async function updateBuilderProfile(user: AuthUser, input: Partial<BuilderProfileDefaults>) {
  assertBuilder(user)

  const storedUser = await readStoredUser(user.email)

  if (!storedUser) {
    return null
  }

  const updatedUser: StoredUser = {
    ...storedUser,
    builderProfile: normalizeBuilderProfile(input),
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