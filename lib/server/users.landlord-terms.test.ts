import { beforeEach, describe, expect, it, vi } from "vitest"

import { LANDLORD_TERMS_VERSION, needsLandlordTermsAcceptance } from "@/lib/landlord-terms"
import type { AuthUser } from "@/lib/types/user"

vi.mock("server-only", () => ({}))

const LANDLORD_ID = "5a1c2d3e-4f50-4617-8a9b-0c1d2e3f4a5b"
const mockUsers: Record<string, unknown> = {}

const mockSendLandlordWelcomeEmail = vi.hoisted(() =>
  vi.fn(async (..._args: [string, string, string]) => ({ status: "sent" as const, detail: "Sent." })),
)

const mockUpsert = vi.fn(async (user: { id: string }) => {
  mockUsers[user.id] = user
  return user
})

vi.mock("@/lib/server/cosmos", () => ({
  getUsersContainer: vi.fn(async () => ({
    item: (id: string) => ({
      read: async () => ({ resource: mockUsers[id] ?? null }),
    }),
    items: {
      upsert: mockUpsert,
    },
  })),
}))

vi.mock("@/lib/server/auth-email", () => ({
  sendEmailChangeVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendVerificationEmail: vi.fn(),
  sendLandlordWelcomeEmail: mockSendLandlordWelcomeEmail,
}))

function buildUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: LANDLORD_ID,
    email: "landlord@example.com",
    first_name: "Lana",
    last_name: "Landlord",
    mobile: "07111111111",
    role: "landlord",
    approval_status: "approved",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as AuthUser
}

describe("needsLandlordTermsAcceptance", () => {
  it("requires Landlords who have not accepted the current version", () => {
    expect(needsLandlordTermsAcceptance(buildUser())).toBe(true)
    expect(needsLandlordTermsAcceptance(buildUser({ termsVersion: "older-version" }))).toBe(true)
  })

  it("does not gate Landlords who accepted the current version", () => {
    expect(needsLandlordTermsAcceptance(buildUser({ termsVersion: LANDLORD_TERMS_VERSION }))).toBe(false)
  })

  it("does not gate other roles", () => {
    expect(needsLandlordTermsAcceptance(buildUser({ role: "tenant" } as Partial<AuthUser>))).toBe(false)
    expect(needsLandlordTermsAcceptance(buildUser({ role: "admin" } as Partial<AuthUser>))).toBe(false)
  })
})

describe("acceptLandlordTerms", () => {
  beforeEach(() => {
    mockUpsert.mockClear()
    Object.keys(mockUsers).forEach((key) => delete mockUsers[key])
    mockUsers[LANDLORD_ID] = { ...buildUser(), passwordHash: "hash" }
  })

  it("records the accepted version and timestamp", async () => {
    const { acceptLandlordTerms } = await import("./users")

    const updated = await acceptLandlordTerms(buildUser())

    expect(updated.termsVersion).toBe(LANDLORD_TERMS_VERSION)
    expect(updated.termsAcceptedAt).toBeTruthy()
    expect(mockUpsert).toHaveBeenCalledTimes(1)
    expect(mockUsers[LANDLORD_ID]).toMatchObject({ termsVersion: LANDLORD_TERMS_VERSION })
    expect(updated).not.toHaveProperty("passwordHash")
  })

  it("rejects users who are not Landlords", async () => {
    const { acceptLandlordTerms } = await import("./users")

    await expect(acceptLandlordTerms(buildUser({ role: "tenant" } as Partial<AuthUser>))).rejects.toThrow("Forbidden")
    expect(mockUpsert).not.toHaveBeenCalled()
  })
})

describe("resendLandlordWelcomeForAdmin", () => {
  const ADMIN_ID = "9b8c7d6e-5f40-4321-8a9b-0c1d2e3f4a5c"

  beforeEach(() => {
    mockSendLandlordWelcomeEmail.mockClear()
    Object.keys(mockUsers).forEach((key) => delete mockUsers[key])
    mockUsers[LANDLORD_ID] = { ...buildUser(), passwordHash: "hash" }
  })

  it("sends the welcome email to a saved Landlord", async () => {
    const { resendLandlordWelcomeForAdmin } = await import("./users")

    const result = await resendLandlordWelcomeForAdmin(
      buildUser({ id: ADMIN_ID, role: "admin" } as Partial<AuthUser>),
      LANDLORD_ID,
      "http://localhost:3000",
    )

    expect(result?.status).toBe("sent")
    expect(mockSendLandlordWelcomeEmail).toHaveBeenCalledTimes(1)
    expect(mockSendLandlordWelcomeEmail).toHaveBeenCalledWith(
      "landlord@example.com",
      "Lana",
      expect.stringContaining("/landlord/terms"),
    )
  })

  it("rejects non-admin callers", async () => {
    const { resendLandlordWelcomeForAdmin } = await import("./users")

    await expect(resendLandlordWelcomeForAdmin(buildUser(), LANDLORD_ID, "http://localhost:3000")).rejects.toThrow("Forbidden")
    expect(mockSendLandlordWelcomeEmail).not.toHaveBeenCalled()
  })

  it("rejects users whose saved role is not Landlord", async () => {
    mockUsers[LANDLORD_ID] = { ...buildUser({ role: "tenant" } as Partial<AuthUser>), passwordHash: "hash" }
    const { resendLandlordWelcomeForAdmin } = await import("./users")

    await expect(
      resendLandlordWelcomeForAdmin(buildUser({ id: ADMIN_ID, role: "admin" } as Partial<AuthUser>), LANDLORD_ID, "http://localhost:3000"),
    ).rejects.toThrow("NotLandlord")
    expect(mockSendLandlordWelcomeEmail).not.toHaveBeenCalled()
  })

  it("returns null when the user does not exist", async () => {
    const { resendLandlordWelcomeForAdmin } = await import("./users")

    const result = await resendLandlordWelcomeForAdmin(
      buildUser({ id: ADMIN_ID, role: "admin" } as Partial<AuthUser>),
      "00000000-0000-4000-8000-000000000000",
      "http://localhost:3000",
    )

    expect(result).toBeNull()
  })
})
