import type { AuthUser, UserRole } from "@/lib/types/user"

export type RegistrationRole = Exclude<UserRole, "admin" | "unallocated">

export const REGISTRATION_ROLE_LABELS = {
  applicant: "Applicant",
  landlord: "Landlord",
  agent: "Agent",
  tenant: "Tenant",
  builder: "Builder",
} satisfies Record<RegistrationRole, string>

export function isRegistrationRole(value: unknown): value is RegistrationRole {
  return typeof value === "string" && Object.hasOwn(REGISTRATION_ROLE_LABELS, value)
}

export function isLandlordApplication(user: Pick<AuthUser, "requestedRole" | "role" | "approval_status"> | null | undefined) {
  return user?.requestedRole === "landlord" && user.role === "unallocated" && user.approval_status !== "approved"
}
