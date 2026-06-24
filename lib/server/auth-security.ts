import "server-only"

import { createHash, randomBytes } from "node:crypto"
import type { ItemDefinition } from "@azure/cosmos"

import { getAuthSecurityContainer } from "@/lib/server/cosmos"

type AuthChallengeKind = "verification" | "password_reset"
type AuthRateLimitAction = "login" | "register" | "forgot_password" | "verify_request"
type AuthRateLimitScope = "ip" | "email"

type AuthChallengeRecord = {
  id: string
  type: "challenge"
  kind: AuthChallengeKind
  email: string
  expiresAt: string
  createdAt: string
  consumedAt?: string
}

type AuthRateLimitRecord = {
  id: string
  type: "rate_limit"
  action: AuthRateLimitAction
  scope: AuthRateLimitScope
  identifier: string
  count: number
  windowStartedAt: string
  expiresAt: string
  updatedAt: string
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

function buildChallengeId(kind: AuthChallengeKind, tokenHash: string) {
  return `challenge:${kind}:${tokenHash}`
}

function buildRateLimitId(action: AuthRateLimitAction, scope: AuthRateLimitScope, identifier: string) {
  return `rate:${action}:${scope}:${identifier}`
}

async function readRecordById<T extends ItemDefinition>(id: string) {
  const container = await getAuthSecurityContainer()

  try {
    const { resource } = await container.item(id, id).read<T>()
    return resource ?? null
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 404) {
      return null
    }

    throw error
  }
}

async function writeRecord<T extends { id: string }>(record: T) {
  const container = await getAuthSecurityContainer()
  await container.items.upsert(record)
  return record
}

export function getClientIpAddress(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const realIp = request.headers.get("x-real-ip")?.trim()
  return forwardedFor || realIp || "unknown"
}

export async function createAuthChallenge(email: string, kind: AuthChallengeKind, expiresInMs: number) {
  const token = randomBytes(32).toString("hex")
  const tokenHash = hashToken(token)
  const now = new Date().toISOString()
  const record: AuthChallengeRecord = {
    id: buildChallengeId(kind, tokenHash),
    type: "challenge",
    kind,
    email,
    createdAt: now,
    expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
  }

  await writeRecord(record)

  return {
    token,
    expiresAt: record.expiresAt,
  }
}

export async function consumeAuthChallenge(kind: AuthChallengeKind, token: string) {
  const record = await readRecordById<AuthChallengeRecord>(buildChallengeId(kind, hashToken(token)))

  if (!record || record.type !== "challenge" || record.kind !== kind) {
    return { email: null, error: "InvalidOrExpiredToken" as const }
  }

  if (record.consumedAt || Date.parse(record.expiresAt) <= Date.now()) {
    return { email: null, error: "InvalidOrExpiredToken" as const }
  }

  record.consumedAt = new Date().toISOString()
  await writeRecord(record)

  return { email: record.email, error: null }
}

export async function registerRateLimitAttempt(input: {
  action: AuthRateLimitAction
  scope: AuthRateLimitScope
  identifier: string
  maxAttempts: number
  windowMs: number
}) {
  const id = buildRateLimitId(input.action, input.scope, input.identifier)
  const now = Date.now()
  const existing = await readRecordById<AuthRateLimitRecord>(id)

  if (existing && existing.type === "rate_limit" && Date.parse(existing.expiresAt) > now) {
    if (existing.count >= input.maxAttempts) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((Date.parse(existing.expiresAt) - now) / 1000)),
      }
    }

    existing.count += 1
    existing.updatedAt = new Date().toISOString()
    await writeRecord(existing)

    return { allowed: true, retryAfterSeconds: null }
  }

  const createdAt = new Date().toISOString()
  const record: AuthRateLimitRecord = {
    id,
    type: "rate_limit",
    action: input.action,
    scope: input.scope,
    identifier: input.identifier,
    count: 1,
    windowStartedAt: createdAt,
    expiresAt: new Date(now + input.windowMs).toISOString(),
    updatedAt: createdAt,
  }
  await writeRecord(record)

  return { allowed: true, retryAfterSeconds: null }
}