import "server-only"

import { randomUUID } from "node:crypto"

import { getRegistrationAttemptsContainer, getRegistrationReviewsContainer } from "@/lib/server/cosmos"

export type RegistrationDecision = "approved" | "verification_required" | "review" | "rejected"

export type RegistrationRiskFactor = { code: string; points: number; detail: string }

export type RegistrationAttempt = {
  id: string
  type: "registration_attempt"
  emailHash: string
  deviceFingerprint: string
  ipHash: string
  trustScore: number
  decision: RegistrationDecision
  failureReason?: string
  riskFactors: RegistrationRiskFactor[]
  createdAt: string
}

export type RegistrationReview = {
  id: string
  type: "registration_review"
  attemptId: string
  reviewer?: string
  decision: "approved" | "rejected"
  reason: string
  reviewedAt: string
}

export async function recordRegistrationAttempt(input: Omit<RegistrationAttempt, "id" | "type">) {
  const attempt: RegistrationAttempt = { id: randomUUID(), type: "registration_attempt", ...input }
  await (await getRegistrationAttemptsContainer()).items.create(attempt)
  return attempt
}

export async function countRecentRegistrationAttempts(input: { ipHash: string; deviceFingerprint: string; since: string }) {
  const { resources } = await (await getRegistrationAttemptsContainer()).items
    .query<number>({
      query: "SELECT VALUE COUNT(1) FROM c WHERE c.type = @type AND c.createdAt >= @since AND (c.ipHash = @ipHash OR c.deviceFingerprint = @deviceFingerprint)",
      parameters: [
        { name: "@type", value: "registration_attempt" },
        { name: "@since", value: input.since },
        { name: "@ipHash", value: input.ipHash },
        { name: "@deviceFingerprint", value: input.deviceFingerprint },
      ],
    })
    .fetchAll()
  return resources[0] ?? 0
}

export async function listRegistrationReviews() {
  const { resources } = await (await getRegistrationAttemptsContainer()).items
    .query<RegistrationAttempt>({
      query: "SELECT * FROM c WHERE c.type = @type AND (c.decision = @review OR c.decision = @verification) ORDER BY c.createdAt DESC",
      parameters: [
        { name: "@type", value: "registration_attempt" },
        { name: "@review", value: "review" },
        { name: "@verification", value: "verification_required" },
      ],
    })
    .fetchAll()
  return resources
}

export async function recordRegistrationReview(input: Omit<RegistrationReview, "id" | "type" | "reviewedAt">) {
  const review: RegistrationReview = { id: randomUUID(), type: "registration_review", reviewedAt: new Date().toISOString(), ...input }
  await (await getRegistrationReviewsContainer()).items.create(review)
  return review
}

export async function getRegistrationAttempt(id: string) {
  const container = await getRegistrationAttemptsContainer()
  try {
    const { resource } = await container.item(id, id).read<RegistrationAttempt>()
    return resource ?? null
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 404) return null
    throw error
  }
}

export async function resolveRegistrationAttempt(attempt: RegistrationAttempt, decision: "approved" | "rejected") {
  const container = await getRegistrationAttemptsContainer()
  const resolvedAttempt = { ...attempt, decision }
  await container.item(attempt.id, attempt.id).replace(resolvedAttempt)
  return resolvedAttempt
}