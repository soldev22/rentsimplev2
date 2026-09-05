import { describe, expect, it } from "vitest"

import { assessRegistration } from "@/lib/server/registration-authenticity"

const baseSignals = {
  email: "applicant@example.co.uk",
  ipAddress: "203.0.113.10",
  userAgent: "Mozilla/5.0",
  acceptLanguage: "en-GB,en;q=0.9",
  timezone: "Europe/London",
  screen: "1920x1080",
  recentAttempts: 0,
  deviceAccountCount: 0,
}

describe("assessRegistration", () => {
  it("approves a complete low-risk registration", () => {
    const assessment = assessRegistration(baseSignals)

    expect(assessment.trustScore).toBe(100)
    expect(assessment.decision).toBe("approved")
    expect(assessment.emailHash).not.toContain(baseSignals.email)
    expect(assessment.ipHash).not.toContain(baseSignals.ipAddress)
  })

  it("rejects disposable email addresses before account creation", () => {
    const assessment = assessRegistration({ ...baseSignals, email: "person@mailinator.com" })

    expect(assessment.decision).toBe("rejected")
    expect(assessment.trustScore).toBe(0)
    expect(assessment.riskFactors.map((factor) => factor.code)).toContain("disposable_email")
  })

  it("rejects populated honeypots", () => {
    const assessment = assessRegistration({ ...baseSignals, honeypot: "automated-value" })

    expect(assessment.decision).toBe("rejected")
    expect(assessment.riskFactors.map((factor) => factor.code)).toContain("honeypot")
  })

  it("holds medium-confidence registrations for additional verification", () => {
    const assessment = assessRegistration({ ...baseSignals, recentAttempts: 5 })

    expect(assessment.trustScore).toBe(75)
    expect(assessment.decision).toBe("verification_required")
  })

  it("routes suspicious device reuse to review", () => {
    const assessment = assessRegistration({ ...baseSignals, recentAttempts: 5, deviceAccountCount: 2 })

    expect(assessment.trustScore).toBe(55)
    expect(assessment.decision).toBe("review")
  })
})
