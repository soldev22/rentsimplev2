import type { ApplicantScreeningScoreConfig, EmploymentStatus, TenancyApplicationRecord } from "@/lib/auth"

const EMPLOYMENT_STATUSES: EmploymentStatus[] = [
  "employed_full_time",
  "employed_part_time",
  "self_employed",
  "contractor",
  "student",
  "retired",
  "unemployed",
  "other",
]

export const DEFAULT_APPLICANT_SCREENING_SCORE_CONFIG: ApplicantScreeningScoreConfig = {
  employmentStatusScores: {
    employed_full_time: 30,
    employed_part_time: 20,
    self_employed: 18,
    contractor: 16,
    student: 8,
    retired: 12,
    unemployed: -20,
    other: 0,
  },
  incomeAffordabilityPassScore: 30,
  incomeAffordabilityFailScore: -30,
  moveInWithinDaysTarget: 45,
  moveInWithinTargetScore: 10,
  moveInOutsideTargetScore: 0,
  perPreferredContactMethodScore: 2,
  hasPetsScore: -4,
  smokesScore: -8,
  adverseCreditScore: -25,
  creditConsentScore: 10,
  additionalOccupantScore: -2,
  guarantorSignedOffScore: 20,
  guarantorDeclinedScore: -20,
  siteVisitScheduledScore: 4,
  siteVisitCompletedScore: 10,
  siteVisitIssueScore: -8,
}

export type ApplicantScreeningScoreRow = {
  key: string
  criterion: string
  value: string
  score: number
}

export type ApplicantScreeningScoreResult = {
  rows: ApplicantScreeningScoreRow[]
  totalScore: number
}

function toFiniteNumber(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toInteger(value: unknown, fallback: number) {
  return Math.round(toFiniteNumber(value, fallback))
}

function toNonNegativeInteger(value: unknown, fallback: number) {
  return Math.max(0, toInteger(value, fallback))
}

function normalizeEmploymentStatusScores(input: Partial<Record<EmploymentStatus, number>> | undefined) {
  return {
    employed_full_time: toInteger(input?.employed_full_time, DEFAULT_APPLICANT_SCREENING_SCORE_CONFIG.employmentStatusScores.employed_full_time),
    employed_part_time: toInteger(input?.employed_part_time, DEFAULT_APPLICANT_SCREENING_SCORE_CONFIG.employmentStatusScores.employed_part_time),
    self_employed: toInteger(input?.self_employed, DEFAULT_APPLICANT_SCREENING_SCORE_CONFIG.employmentStatusScores.self_employed),
    contractor: toInteger(input?.contractor, DEFAULT_APPLICANT_SCREENING_SCORE_CONFIG.employmentStatusScores.contractor),
    student: toInteger(input?.student, DEFAULT_APPLICANT_SCREENING_SCORE_CONFIG.employmentStatusScores.student),
    retired: toInteger(input?.retired, DEFAULT_APPLICANT_SCREENING_SCORE_CONFIG.employmentStatusScores.retired),
    unemployed: toInteger(input?.unemployed, DEFAULT_APPLICANT_SCREENING_SCORE_CONFIG.employmentStatusScores.unemployed),
    other: toInteger(input?.other, DEFAULT_APPLICANT_SCREENING_SCORE_CONFIG.employmentStatusScores.other),
  }
}

export function normalizeApplicantScreeningScoreConfig(
  input: Partial<ApplicantScreeningScoreConfig> | undefined,
): ApplicantScreeningScoreConfig {
  return {
    employmentStatusScores: normalizeEmploymentStatusScores(input?.employmentStatusScores),
    incomeAffordabilityPassScore: toInteger(
      input?.incomeAffordabilityPassScore,
      DEFAULT_APPLICANT_SCREENING_SCORE_CONFIG.incomeAffordabilityPassScore,
    ),
    incomeAffordabilityFailScore: toInteger(
      input?.incomeAffordabilityFailScore,
      DEFAULT_APPLICANT_SCREENING_SCORE_CONFIG.incomeAffordabilityFailScore,
    ),
    moveInWithinDaysTarget: toNonNegativeInteger(
      input?.moveInWithinDaysTarget,
      DEFAULT_APPLICANT_SCREENING_SCORE_CONFIG.moveInWithinDaysTarget,
    ),
    moveInWithinTargetScore: toInteger(
      input?.moveInWithinTargetScore,
      DEFAULT_APPLICANT_SCREENING_SCORE_CONFIG.moveInWithinTargetScore,
    ),
    moveInOutsideTargetScore: toInteger(
      input?.moveInOutsideTargetScore,
      DEFAULT_APPLICANT_SCREENING_SCORE_CONFIG.moveInOutsideTargetScore,
    ),
    perPreferredContactMethodScore: toInteger(
      input?.perPreferredContactMethodScore,
      DEFAULT_APPLICANT_SCREENING_SCORE_CONFIG.perPreferredContactMethodScore,
    ),
    hasPetsScore: toInteger(input?.hasPetsScore, DEFAULT_APPLICANT_SCREENING_SCORE_CONFIG.hasPetsScore),
    smokesScore: toInteger(input?.smokesScore, DEFAULT_APPLICANT_SCREENING_SCORE_CONFIG.smokesScore),
    adverseCreditScore: toInteger(
      input?.adverseCreditScore,
      DEFAULT_APPLICANT_SCREENING_SCORE_CONFIG.adverseCreditScore,
    ),
    creditConsentScore: toInteger(
      input?.creditConsentScore,
      DEFAULT_APPLICANT_SCREENING_SCORE_CONFIG.creditConsentScore,
    ),
    additionalOccupantScore: toInteger(
      input?.additionalOccupantScore,
      DEFAULT_APPLICANT_SCREENING_SCORE_CONFIG.additionalOccupantScore,
    ),
    guarantorSignedOffScore: toInteger(
      input?.guarantorSignedOffScore,
      DEFAULT_APPLICANT_SCREENING_SCORE_CONFIG.guarantorSignedOffScore,
    ),
    guarantorDeclinedScore: toInteger(
      input?.guarantorDeclinedScore,
      DEFAULT_APPLICANT_SCREENING_SCORE_CONFIG.guarantorDeclinedScore,
    ),
    siteVisitScheduledScore: toInteger(
      input?.siteVisitScheduledScore,
      DEFAULT_APPLICANT_SCREENING_SCORE_CONFIG.siteVisitScheduledScore,
    ),
    siteVisitCompletedScore: toInteger(
      input?.siteVisitCompletedScore,
      DEFAULT_APPLICANT_SCREENING_SCORE_CONFIG.siteVisitCompletedScore,
    ),
    siteVisitIssueScore: toInteger(
      input?.siteVisitIssueScore,
      DEFAULT_APPLICANT_SCREENING_SCORE_CONFIG.siteVisitIssueScore,
    ),
  }
}

function formatEmploymentStatus(status: EmploymentStatus) {
  switch (status) {
    case "employed_full_time":
      return "Employed full time"
    case "employed_part_time":
      return "Employed part time"
    case "self_employed":
      return "Self employed"
    case "contractor":
      return "Contractor"
    case "student":
      return "Student"
    case "retired":
      return "Retired"
    case "unemployed":
      return "Unemployed"
    default:
      return "Other"
  }
}

function getMoveInDaysUntil(moveInDate: string, submittedAt: string) {
  const moveInTimestamp = Date.parse(moveInDate)
  const submittedTimestamp = Date.parse(submittedAt)

  if (!Number.isFinite(moveInTimestamp) || !Number.isFinite(submittedTimestamp)) {
    return null
  }

  return Math.ceil((moveInTimestamp - submittedTimestamp) / (1000 * 60 * 60 * 24))
}

export function calculateApplicantScreeningScore(
  application: TenancyApplicationRecord,
  configInput?: Partial<ApplicantScreeningScoreConfig>,
): ApplicantScreeningScoreResult {
  const config = normalizeApplicantScreeningScoreConfig(configInput)
  const profile = application.applicantProfile
  const employmentScore = config.employmentStatusScores[profile.employmentStatus]

  const requiredAnnualIncome = application.monthlyRent * 12 * application.affordabilityMultiple
  const passesAffordability = profile.annualIncome >= requiredAnnualIncome
  const incomeScore = passesAffordability ? config.incomeAffordabilityPassScore : config.incomeAffordabilityFailScore

  const moveInDays = getMoveInDaysUntil(profile.moveInDate, application.submittedAt)
  const moveInScore =
    moveInDays !== null && moveInDays >= 0 && moveInDays <= config.moveInWithinDaysTarget
      ? config.moveInWithinTargetScore
      : config.moveInOutsideTargetScore

  const preferredContactScore = profile.preferredContactMethods.length * config.perPreferredContactMethodScore
  const petsScore = profile.hasPets ? config.hasPetsScore : 0
  const smokingScore = profile.smokes ? config.smokesScore : 0
  const adverseCreditScore = profile.hasAdverseCredit ? config.adverseCreditScore : 0
  const creditConsentScore = profile.creditCheckConsentGiven ? config.creditConsentScore : 0
  const additionalOccupants = Math.max(0, profile.occupantCount - 1)
  const occupantsScore = additionalOccupants * config.additionalOccupantScore
  const manualCreditReportScore = Number(application.referencingReport.checks.creditScore)
  const creditReportScore = Number.isFinite(manualCreditReportScore) ? Math.round(manualCreditReportScore) : 0
  const latestRequestByRefereeId = new Map<string, TenancyApplicationRecord["referencingInstruction"]["referenceRequests"][number]>()

  for (const request of application.referencingInstruction.referenceRequests ?? []) {
    const current = latestRequestByRefereeId.get(request.refereeId)
    const currentRequestedAt = current ? Date.parse(current.requestedAt) : Number.NEGATIVE_INFINITY
    const candidateRequestedAt = Date.parse(request.requestedAt)

    if (!current || candidateRequestedAt >= currentRequestedAt) {
      latestRequestByRefereeId.set(request.refereeId, request)
    }
  }

  const latestRequests = [...latestRequestByRefereeId.values()]
  const hasGuarantorSignedOff = latestRequests.some((request) => request.status === "completed")
  const hasGuarantorDeclined = latestRequests.some((request) => request.status === "declined")
  const guarantorOutcomeScore = hasGuarantorSignedOff
    ? config.guarantorSignedOffScore
    : hasGuarantorDeclined
      ? config.guarantorDeclinedScore
      : 0
  const guarantorOutcomeValue = hasGuarantorSignedOff
    ? "Signed off"
    : hasGuarantorDeclined
      ? "Declined"
      : latestRequests.length > 0
        ? "Requested - awaiting response"
        : "Not requested"

  const siteVisitStatus =
    application.preMoveInCompliance.siteVisit?.status ??
    (application.preMoveInCompliance.checkInScheduled ? "scheduled" : "not_scheduled")
  const siteVisitOutcomeScore =
    siteVisitStatus === "completed"
      ? config.siteVisitCompletedScore
      : siteVisitStatus === "scheduled"
        ? config.siteVisitScheduledScore
        : siteVisitStatus === "no_access" || siteVisitStatus === "cancelled"
          ? config.siteVisitIssueScore
          : 0
  const siteVisitOutcomeValue = siteVisitStatus.replaceAll("_", " ")

  const rows: ApplicantScreeningScoreRow[] = [
    {
      key: "employmentStatus",
      criterion: "Employment status",
      value: formatEmploymentStatus(profile.employmentStatus),
      score: employmentScore,
    },
    {
      key: "annualIncome",
      criterion: "Annual income vs affordability",
      value: `GBP ${profile.annualIncome.toLocaleString()} vs GBP ${requiredAnnualIncome.toLocaleString()} required`,
      score: incomeScore,
    },
    {
      key: "moveInDate",
      criterion: "Move-in timeframe",
      value:
        moveInDays === null
          ? "Invalid date"
          : `${Math.max(0, moveInDays)} days from submission (target <= ${config.moveInWithinDaysTarget})`,
      score: moveInScore,
    },
    {
      key: "preferredContactMethods",
      criterion: "Preferred contact methods",
      value: profile.preferredContactMethods.length > 0 ? profile.preferredContactMethods.join(", ") : "Not provided",
      score: preferredContactScore,
    },
    {
      key: "hasPets",
      criterion: "Pets",
      value: profile.hasPets ? `Yes${profile.petDetails ? ` (${profile.petDetails})` : ""}` : "No",
      score: petsScore,
    },
    {
      key: "smokes",
      criterion: "Smoking",
      value: profile.smokes ? "Yes" : "No",
      score: smokingScore,
    },
    {
      key: "occupantCount",
      criterion: "Occupants",
      value: String(profile.occupantCount),
      score: occupantsScore,
    },
    {
      key: "hasAdverseCredit",
      criterion: "Adverse credit",
      value: profile.hasAdverseCredit ? `Yes${profile.adverseCreditDetails ? ` (${profile.adverseCreditDetails})` : ""}` : "No",
      score: adverseCreditScore,
    },
    {
      key: "creditCheckConsentGiven",
      criterion: "Credit check consent",
      value: profile.creditCheckConsentGiven ? "Given" : "Not given",
      score: creditConsentScore,
    },
    {
      key: "creditReportScore",
      criterion: "Credit report score (manual)",
      value:
        typeof application.referencingReport.checks.creditScore === "string" && application.referencingReport.checks.creditScore.trim()
          ? application.referencingReport.checks.creditScore.trim()
          : "Not entered",
      score: creditReportScore,
    },
    {
      key: "guarantorOutcome",
      criterion: "Guarantor outcome",
      value: guarantorOutcomeValue,
      score: guarantorOutcomeScore,
    },
    {
      key: "siteVisitOutcome",
      criterion: "Site visit outcome",
      value: siteVisitOutcomeValue,
      score: siteVisitOutcomeScore,
    },
  ]

  const totalScore = rows.reduce((sum, row) => sum + row.score, 0)

  return {
    rows,
    totalScore,
  }
}

export function getEmploymentStatuses() {
  return EMPLOYMENT_STATUSES
}
