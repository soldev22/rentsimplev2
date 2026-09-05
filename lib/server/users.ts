import "server-only"

import type { ItemResponse } from "@azure/cosmos"

import {
  type ApplicantScreeningScoreConfig,
  type ApplicantProfileDefaults,
  type ApprovalStatus,
  type AuthUser,
  type BuilderProfileDefaults,
  type NotificationProfileDefaults,
  type LandlordProfile,
  type UserRole,
  getUserRole,
  normalizeEmail,
} from "@/lib/auth"
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/server/auth-email"
import { consumeAuthChallenge, createAuthChallenge } from "@/lib/server/auth-security"
import {
  getApplicationCommunicationsContainer,
  getApplicationsContainer,
  getAuditEventsContainer,
  getAuthSecurityContainer,
  getUsersContainer,
} from "@/lib/server/cosmos"
import { deleteDepositDocument, deleteTenancyVerificationDocument } from "@/lib/server/blob"
import {
  buildPaginatedResult,
  fetchAllQueryInBatches,
  fetchQueryPageWithContinuation,
  normalizePageOptions,
  type PageOptions,
} from "@/lib/server/pagination"
import { hashPassword, verifyPassword } from "@/lib/server/password"
import { normalizeApplicantScreeningScoreConfig } from "@/lib/utils/applicant-screening-score"

type StoredUser = AuthUser & {
  passwordHash?: string
  sessionTokenHash?: string
  sessionExpiresAt?: string
  emailVerifiedAt?: string
  failedLoginAttempts?: number
  lastFailedLoginAt?: string
  lockoutUntil?: string
}

const LOGIN_LOCKOUT_THRESHOLD = 5
const LOGIN_LOCKOUT_DURATION_MS = 1000 * 60 * 15
const VERIFICATION_TOKEN_DURATION_MS = 1000 * 60 * 60 * 24
const PASSWORD_RESET_TOKEN_DURATION_MS = 1000 * 60 * 30

export type LandlordDirectoryEntry = {
  id: string
  email: string
  fullName: string
}

function getLandlordAccountId(user: Pick<AuthUser, "id" | "landlordAccountId">) {
  return user.landlordAccountId?.trim().toLowerCase() || user.id
}

function isNotFoundError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 404
}

function sanitizeUser(user: StoredUser): AuthUser {
  const {
    passwordHash: _passwordHash,
    sessionTokenHash: _sessionTokenHash,
    sessionExpiresAt: _sessionExpiresAt,
    emailVerifiedAt: _emailVerifiedAt,
    failedLoginAttempts: _failedLoginAttempts,
    lastFailedLoginAt: _lastFailedLoginAt,
    lockoutUntil: _lockoutUntil,
    ...publicUser
  } = user
  return publicUser
}

function getPostVerificationApprovalStatus(role: UserRole): ApprovalStatus {
  return role === "applicant" ? "approved" : "pending_approval"
}

function isUserLocked(storedUser: StoredUser) {
  return Boolean(storedUser.lockoutUntil && Date.parse(storedUser.lockoutUntil) > Date.now())
}

function getLockoutRetryAfterSeconds(storedUser: StoredUser) {
  if (!storedUser.lockoutUntil) {
    return null
  }

  return Math.max(1, Math.ceil((Date.parse(storedUser.lockoutUntil) - Date.now()) / 1000))
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

function assertLandlord(user: AuthUser) {
  if (getUserRole(user) !== "landlord") {
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

function normalizeLandlordProfile(input: Partial<LandlordProfile> | undefined): LandlordProfile | undefined {
  if (!input) {
    return undefined
  }

  const profile = {
    tradingName: typeof input.tradingName === "string" ? input.tradingName.trim() : "",
    registrationNumber: typeof input.registrationNumber === "string" ? input.registrationNumber.trim() : "",
    addressLine1: typeof input.addressLine1 === "string" ? input.addressLine1.trim() : "",
    addressLine2: typeof input.addressLine2 === "string" ? input.addressLine2.trim() : "",
    city: typeof input.city === "string" ? input.city.trim() : "",
    postcode: typeof input.postcode === "string" ? input.postcode.trim().toUpperCase() : "",
  }

  return Object.values(profile).some(Boolean) ? profile : undefined
}

function normalizeScreeningScoreConfig(
  input: Partial<ApplicantScreeningScoreConfig> | undefined,
): ApplicantScreeningScoreConfig | undefined {
  if (!input) {
    return undefined
  }

  return normalizeApplicantScreeningScoreConfig(input)
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
    notificationProfile: role === "landlord" ? normalizeNotificationProfile(input.notificationProfile ?? undefined) : undefined,
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
  const requestedApprovalStatus: ApprovalStatus = "pending_verification"

  if (existingUser && (!hasLocalPassword(existingUser) || existingUser.approval_status === "pending_verification")) {
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
      emailVerifiedAt: undefined,
      failedLoginAttempts: 0,
      lastFailedLoginAt: undefined,
      lockoutUntil: undefined,
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

  if (storedUser && isUserLocked(storedUser)) {
    return {
      user: null,
      error: "This account is temporarily locked after repeated failed sign-in attempts.",
      errorCode: "AccountLocked" as const,
      retryAfterSeconds: getLockoutRetryAfterSeconds(storedUser),
    }
  }

  if (storedUser?.approval_status === "pending_verification") {
    return {
      user: null,
      error: "Verify your email address before signing in.",
      errorCode: "EmailVerificationRequired" as const,
      retryAfterSeconds: null,
    }
  }

  if (storedUser && !hasLocalPassword(storedUser)) {
    return {
      user: null,
      error: "This account still needs a local password. Register again with the same email to finish setting one.",
      errorCode: "PasswordUnavailable" as const,
      retryAfterSeconds: null,
    }
  }

  if (!storedUser?.passwordHash || !verifyPassword(input.password, storedUser.passwordHash)) {
    if (storedUser) {
      storedUser.failedLoginAttempts = (storedUser.failedLoginAttempts ?? 0) + 1
      storedUser.lastFailedLoginAt = new Date().toISOString()

      if (storedUser.failedLoginAttempts >= LOGIN_LOCKOUT_THRESHOLD) {
        storedUser.lockoutUntil = new Date(Date.now() + LOGIN_LOCKOUT_DURATION_MS).toISOString()
      }

      storedUser.updatedAt = new Date().toISOString()
      await writeStoredUser(storedUser)
    }

    return {
      user: null,
      error: "We could not sign you in with that email and password. Check the details or register an account first.",
      errorCode: storedUser?.lockoutUntil ? ("AccountLocked" as const) : ("InvalidCredentials" as const),
      retryAfterSeconds: storedUser?.lockoutUntil ? getLockoutRetryAfterSeconds(storedUser) : null,
    }
  }

  if (storedUser.failedLoginAttempts || storedUser.lockoutUntil || storedUser.lastFailedLoginAt) {
    storedUser.failedLoginAttempts = 0
    storedUser.lockoutUntil = undefined
    storedUser.lastFailedLoginAt = undefined
    storedUser.updatedAt = new Date().toISOString()
    await writeStoredUser(storedUser)
  }

  return { user: sanitizeUser(storedUser), error: null, errorCode: null, retryAfterSeconds: null }
}

export async function sendVerificationForUser(email: string, appOrigin: string) {
  const storedUser = await readStoredUser(email)

  if (!storedUser || storedUser.approval_status !== "pending_verification") {
    return { verificationUrl: null, delivery: null }
  }

  const challenge = await createAuthChallenge(storedUser.email, "verification", VERIFICATION_TOKEN_DURATION_MS)
  const verificationUrl = `${appOrigin}/login?mode=verify&token=${challenge.token}`
  const delivery = await sendVerificationEmail(storedUser.email, verificationUrl)

  return { verificationUrl, delivery }
}

export async function verifyUserEmail(token: string) {
  const consumed = await consumeAuthChallenge("verification", token)

  if (!consumed.email || consumed.error) {
    return { user: null, error: "InvalidOrExpiredToken" as const }
  }

  const storedUser = await readStoredUser(consumed.email)

  if (!storedUser) {
    return { user: null, error: "InvalidOrExpiredToken" as const }
  }

  storedUser.approval_status = getPostVerificationApprovalStatus(storedUser.role)
  storedUser.emailVerifiedAt = new Date().toISOString()
  storedUser.updatedAt = new Date().toISOString()
  await writeStoredUser(storedUser)

  return { user: sanitizeUser(storedUser), error: null }
}

export async function requestPasswordReset(email: string, appOrigin: string) {
  const storedUser = await readStoredUser(email)

  if (!storedUser || !storedUser.passwordHash || storedUser.approval_status === "pending_verification") {
    return { resetUrl: null, delivery: null }
  }

  const challenge = await createAuthChallenge(storedUser.email, "password_reset", PASSWORD_RESET_TOKEN_DURATION_MS)
  const resetUrl = `${appOrigin}/login?mode=reset&token=${challenge.token}`
  const delivery = await sendPasswordResetEmail(storedUser.email, resetUrl)

  return { resetUrl, delivery }
}

export async function resetPasswordWithToken(token: string, password: string) {
  const consumed = await consumeAuthChallenge("password_reset", token)

  if (!consumed.email || consumed.error) {
    return { user: null, error: "InvalidOrExpiredToken" as const }
  }

  const storedUser = await readStoredUser(consumed.email)

  if (!storedUser) {
    return { user: null, error: "InvalidOrExpiredToken" as const }
  }

  storedUser.passwordHash = hashPassword(password)
  storedUser.failedLoginAttempts = 0
  storedUser.lastFailedLoginAt = undefined
  storedUser.lockoutUntil = undefined
  storedUser.sessionTokenHash = undefined
  storedUser.sessionExpiresAt = undefined
  storedUser.updatedAt = new Date().toISOString()
  await writeStoredUser(storedUser)

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

export async function listApprovedGlobalAdmins() {
  const container = await getUsersContainer()
  const { resources } = await container.items
    .query<StoredUser>({
      query: "SELECT * FROM c WHERE c.role = @role AND c.approval_status = @approvalStatus",
      parameters: [
        { name: "@role", value: "admin" },
        { name: "@approvalStatus", value: "approved" },
      ],
    })
    .fetchAll()

  return resources.map(sanitizeUser)
}

export async function listUsersForAdmin(user: AuthUser) {
  const paged = await listUsersForAdminPage(user, { page: 1, pageSize: 1000 })
  return paged.items
}

export async function listUsersForAdminPage(user: AuthUser, options?: PageOptions) {
  assertAdmin(user)

  const container = await getUsersContainer()
  const { page, pageSize, offset } = normalizePageOptions(options, { defaultPageSize: 25, maxPageSize: 100 })
  const [{ resources: countRows }, { resources }] = await Promise.all([
    container.items.query<number>({ query: "SELECT VALUE COUNT(1) FROM c" }).fetchAll(),
    container.items
      .query<StoredUser>({
        query: `SELECT * FROM c ORDER BY c.createdAt DESC OFFSET ${offset} LIMIT ${pageSize}`,
      })
      .fetchAll(),
  ])

  return buildPaginatedResult(resources.map(sanitizeUser), countRows[0] ?? 0, page, pageSize)
}

export async function listUsersForAdminByContinuation(
  user: AuthUser,
  options?: {
    continuationToken?: string
    maxItemCount?: number
  },
) {
  assertAdmin(user)

  const container = await getUsersContainer()
  const page = await fetchQueryPageWithContinuation<StoredUser>(
    container,
    {
      query: "SELECT * FROM c ORDER BY c.createdAt DESC",
    },
    options,
  )

  return {
    items: page.items.map(sanitizeUser),
    continuationToken: page.continuationToken,
    maxItemCount: page.maxItemCount,
  }
}

export async function updateUserForAdmin(
  adminUser: AuthUser,
  email: string,
  input: {
    first_name?: string
    last_name?: string
    mobile?: string
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
  const nextLandlordAccountId = managedInput.role === "landlord" ? getLandlordAccountId(storedUser) : undefined
  const updatedUser: StoredUser = {
    ...storedUser,
    first_name: typeof input.first_name === "string" ? input.first_name.trim() : storedUser.first_name,
    last_name: typeof input.last_name === "string" ? input.last_name.trim() : storedUser.last_name,
    mobile: typeof input.mobile === "string" ? input.mobile.trim() : storedUser.mobile,
    role: managedInput.role,
    approval_status: normalizedEmail === adminUser.email ? "approved" : managedInput.approval_status,
    landlordAccountId: nextLandlordAccountId,
    managedByAgentId: managedInput.role === "landlord" ? managedInput.managedByAgentId : undefined,
    notificationProfile: managedInput.notificationProfile,
    updatedAt: new Date().toISOString(),
  }

  await writeStoredUser(updatedUser)

  return sanitizeUser(updatedUser)
}

export async function deleteUserForAdmin(adminUser: AuthUser, email: string) {
  assertAdmin(adminUser)

  const normalizedEmail = normalizeEmail(email)

  if (normalizedEmail === adminUser.email) {
    throw new Error("CannotDeleteOwnAccount")
  }

  const storedUser = await readStoredUser(normalizedEmail)

  if (!storedUser) {
    return null
  }

  if (storedUser.role === "applicant" && storedUser.approval_status === "approved") {
    throw new Error("ApplicantAccountErasureWorkflowRequired")
  }

  const container = await getUsersContainer()
  await container.item(normalizedEmail, normalizedEmail).delete()

  return sanitizeUser(storedUser)
}

async function listAllUsers() {
  const container = await getUsersContainer()
  const resources = await fetchAllQueryInBatches<StoredUser>(container, {
    query: "SELECT * FROM c",
  })

  return resources.map(sanitizeUser)
}

export async function listLandlordDirectoryForUser(user: AuthUser) {
  const role = getUserRole(user)

  if (role !== "admin" && role !== "agent" && role !== "landlord") {
    throw new Error("Forbidden")
  }

  const users = await listAllUsers()
  const landlordAccountId = role === "landlord" ? getLandlordAccountId(user) : ""

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

      return getLandlordAccountId(candidate) === landlordAccountId
    })
    .map<LandlordDirectoryEntry>((candidate) => ({
      id: candidate.id,
      email: candidate.email,
      fullName: candidate.landlordProfile?.tradingName?.trim() || getFullName(candidate),
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
    landlordAccountId: role === "landlord" ? getLandlordAccountId(storedUser) : undefined,
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

export async function requestApplicantAccountErasure(user: AuthUser) {
  assertApplicant(user)

  const storedUser = await readStoredUser(user.email)
  if (!storedUser) {
    return null
  }

  if (!storedUser.accountErasureRequestedAt) {
    storedUser.accountErasureRequestedAt = new Date().toISOString()
    storedUser.updatedAt = storedUser.accountErasureRequestedAt
    await writeStoredUser(storedUser)
  }

  return sanitizeUser(storedUser)
}

export async function eraseApplicantAccountForAdmin(adminUser: AuthUser, email: string) {
  assertAdmin(adminUser)

  const normalizedEmail = normalizeEmail(email)
  const storedUser = await readStoredUser(normalizedEmail)

  if (!storedUser) {
    return null
  }

  if (storedUser.role !== "applicant" || !storedUser.accountErasureRequestedAt) {
    throw new Error("AccountErasureNotRequested")
  }

  const applicationsContainer = await getApplicationsContainer()
  const { resources: applications } = await applicationsContainer.items
    .query<{ id: string; applicantId: string; status: string; referencingInstruction?: { verificationDocuments?: Array<{ blobName: string }> }; depositRecord?: { documents?: Array<{ blobName: string }> } }>({
      query: "SELECT * FROM c WHERE c.applicantId = @applicantId",
      parameters: [{ name: "@applicantId", value: storedUser.id }],
    })
    .fetchAll()

  if (applications.some((application) => application.status === "active_tenant")) {
    throw new Error("ActiveTenancyHistoryExists")
  }

  const applicationIds = applications.map((application) => application.id)
  const [communicationsContainer, auditEventsContainer, authSecurityContainer, usersContainer] = await Promise.all([
    getApplicationCommunicationsContainer(),
    getAuditEventsContainer(),
    getAuthSecurityContainer(),
    getUsersContainer(),
  ])
  const [communicationRecords, auditRecords, authSecurityRecords] = await Promise.all([
    applicationIds.length > 0
      ? communicationsContainer.items.query<{ id: string; applicationId: string }>({
          query: "SELECT c.id, c.applicationId FROM c WHERE c.applicantId = @applicantId",
          parameters: [{ name: "@applicantId", value: storedUser.id }],
        }).fetchAll()
      : Promise.resolve({ resources: [] as Array<{ id: string; applicationId: string }> }),
    applicationIds.length > 0
      ? auditEventsContainer.items.query<{ id: string; entityKey: string }>({
          query: "SELECT c.id, c.entityKey FROM c WHERE ARRAY_CONTAINS(@entityKeys, c.entityKey)",
          parameters: [{ name: "@entityKeys", value: applicationIds.map((id) => `application:${id}`) }],
        }).fetchAll()
      : Promise.resolve({ resources: [] as Array<{ id: string; entityKey: string }> }),
    authSecurityContainer.items.query<{ id: string }>({
      query: "SELECT c.id FROM c WHERE c.email = @email",
      parameters: [{ name: "@email", value: normalizedEmail }],
    }).fetchAll(),
  ])

  await Promise.all([
    ...applications.flatMap((application) => [
      ...(application.referencingInstruction?.verificationDocuments ?? []).map((document) => deleteTenancyVerificationDocument(document.blobName)),
      ...(application.depositRecord?.documents ?? []).map((document) => deleteDepositDocument(document.blobName)),
    ]),
    ...communicationRecords.resources.map((record) => communicationsContainer.item(record.id, record.applicationId).delete()),
    ...auditRecords.resources.map((record) => auditEventsContainer.item(record.id, record.entityKey).delete()),
    ...authSecurityRecords.resources.map((record) => authSecurityContainer.item(record.id, record.id).delete()),
    ...applications.map((application) => applicationsContainer.item(application.id, application.applicantId).delete()),
  ])

  await usersContainer.item(storedUser.id, storedUser.id).delete()
  return sanitizeUser(storedUser)
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

export async function updateLandlordProfile(
  user: AuthUser,
  input: Partial<{
    firstName: string
    lastName: string
    mobile: string
    notificationProfile: Partial<NotificationProfileDefaults>
    landlordProfile: Partial<LandlordProfile>
    screeningScoreConfig: Partial<ApplicantScreeningScoreConfig>
  }>,
) {
  assertLandlord(user)

  const storedUser = await readStoredUser(user.email)

  if (!storedUser) {
    return null
  }

  const firstName = typeof input.firstName === "string" ? input.firstName.trim() : storedUser.first_name
  const lastName = typeof input.lastName === "string" ? input.lastName.trim() : storedUser.last_name
  const mobile = typeof input.mobile === "string" ? input.mobile.trim() : storedUser.mobile

  const nextNotificationProfile = normalizeNotificationProfile({
    ...(storedUser.notificationProfile ?? {}),
    ...(input.notificationProfile ?? {}),
  })
  const nextScreeningScoreConfig = normalizeScreeningScoreConfig({
    ...(storedUser.screeningScoreConfig ?? {}),
    ...(input.screeningScoreConfig ?? {}),
  })
  const nextLandlordProfile = normalizeLandlordProfile({
    ...(storedUser.landlordProfile ?? {}),
    ...(input.landlordProfile ?? {}),
  })

  const updatedUser: StoredUser = {
    ...storedUser,
    first_name: firstName,
    last_name: lastName,
    mobile,
    notificationProfile: nextNotificationProfile,
    landlordProfile: nextLandlordProfile,
    screeningScoreConfig: nextScreeningScoreConfig,
    updatedAt: new Date().toISOString(),
  }

  await writeStoredUser(updatedUser)
  return sanitizeUser(updatedUser)
}

export async function listLandlordTeamUsers(user: AuthUser) {
  assertLandlord(user)

  const users = await listAllUsers()
  const landlordAccountId = getLandlordAccountId(user)

  return users
    .filter((candidate) => candidate.role === "landlord" && getLandlordAccountId(candidate) === landlordAccountId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
}

export async function listLandlordTeamUsersForSystem(landlordOwnerId: string) {
  const landlordOwner = await getUserById(landlordOwnerId)

  if (!landlordOwner || landlordOwner.role !== "landlord") {
    return [] as AuthUser[]
  }

  const users = await listAllUsers()
  const landlordAccountId = getLandlordAccountId(landlordOwner)

  return users
    .filter((candidate) => candidate.role === "landlord" && getLandlordAccountId(candidate) === landlordAccountId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
}

export async function createLandlordTeamUser(
  landlordUser: AuthUser,
  input: {
    email: string
    password: string
    firstName: string
    lastName: string
    mobile?: string
  },
) {
  assertLandlord(landlordUser)

  const normalizedEmail = normalizeEmail(input.email)

  if (!normalizedEmail || !input.password || !input.firstName.trim() || !input.lastName.trim()) {
    throw new Error("ValidationError")
  }

  const existingUser = await readStoredUser(normalizedEmail)

  if (existingUser) {
    throw new Error("UserAlreadyExists")
  }

  const now = new Date().toISOString()
  const storedUser: StoredUser = {
    id: normalizedEmail,
    email: normalizedEmail,
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    mobile: (input.mobile ?? "").trim(),
    role: "landlord",
    approval_status: "approved",
    landlordAccountId: getLandlordAccountId(landlordUser),
    managedByAgentId: landlordUser.managedByAgentId,
    createdAt: now,
    updatedAt: now,
    passwordHash: hashPassword(input.password),
    emailVerifiedAt: now,
    failedLoginAttempts: 0,
  }

  await writeStoredUser(storedUser)
  return sanitizeUser(storedUser)
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