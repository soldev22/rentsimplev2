import { createHash } from "node:crypto"

import type { RegistrationDecision, RegistrationRiskFactor } from "@/lib/server/registration-attempts"

const DISPOSABLE_EMAIL_DOMAINS = new Set(["10minutemail.com", "guerrillamail.com", "mailinator.com", "tempmail.com", "yopmail.com"])
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type RegistrationSignals = {
  email: string
  ipAddress: string
  userAgent: string
  acceptLanguage: string
  timezone: string
  screen: string
  honeypot?: string
  recentAttempts: number
  deviceAccountCount: number
}

export type RegistrationAssessment = {
  emailHash: string
  ipHash: string
  deviceFingerprint: string
  trustScore: number
  decision: RegistrationDecision
  failureReason?: string
  riskFactors: RegistrationRiskFactor[]
}

export function hashRegistrationIdentifier(value: string) {
  const salt = process.env.REGISTRATION_HASH_SALT?.trim() || "rentsimple-registration"
  return createHash("sha256").update(`${salt}:${value}`).digest("hex")
}

export function getDeviceFingerprint(signals: Pick<RegistrationSignals, "userAgent" | "acceptLanguage" | "timezone" | "screen">) {
  return hashRegistrationIdentifier([signals.userAgent, signals.acceptLanguage, signals.timezone, signals.screen].join("|"))
}

function addFactor(factors: RegistrationRiskFactor[], code: string, points: number, detail: string) {
  factors.push({ code, points, detail })
}

export function assessRegistration(signals: RegistrationSignals): RegistrationAssessment {
  const factors: RegistrationRiskFactor[] = []
  const email = signals.email.trim().toLowerCase()
  const domain = email.split("@")[1] ?? ""

  if (!EMAIL_PATTERN.test(email)) addFactor(factors, "invalid_email", -100, "Email format is invalid.")
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) addFactor(factors, "disposable_email", -100, "Disposable email provider detected.")
  if (signals.honeypot?.trim()) addFactor(factors, "honeypot", -100, "Honeypot field was populated.")
  if (signals.recentAttempts >= 5) addFactor(factors, "registration_velocity", -25, "Registration burst detected for this network identity.")
  if (signals.deviceAccountCount >= 2) addFactor(factors, "device_reuse", -20, "Multiple accounts are associated with this device fingerprint.")
  if (/\b(headless|puppeteer|playwright|selenium)\b/i.test(signals.userAgent)) addFactor(factors, "automation_user_agent", -60, "Automation framework signature detected.")
  if (!signals.userAgent || !signals.acceptLanguage || !signals.timezone) addFactor(factors, "missing_browser_signals", -15, "Expected browser signals are missing.")

  const trustScore = Math.max(0, Math.min(100, 100 + factors.reduce((total, factor) => total + factor.points, 0)))
  const hasHardFailure = factors.some((factor) => factor.points <= -100)
  const decision: RegistrationDecision = hasHardFailure || trustScore < 40
    ? "rejected"
    : trustScore >= 90
      ? "approved"
      : trustScore >= 70
        ? "verification_required"
        : "review"

  return {
    emailHash: hashRegistrationIdentifier(email),
    ipHash: hashRegistrationIdentifier(signals.ipAddress),
    deviceFingerprint: getDeviceFingerprint(signals),
    trustScore,
    decision,
    failureReason: decision === "rejected" ? factors[0]?.detail || "Registration failed authenticity checks." : undefined,
    riskFactors: factors,
  }
}