"use client"

import { useState, useTransition } from "react"

import type { ApplicantScreeningScoreConfig, AuthUser, LandlordProfile, NotificationProfileDefaults } from "@/lib/auth"
import {
  DEFAULT_APPLICANT_SCREENING_SCORE_CONFIG,
  getEmploymentStatuses,
  normalizeApplicantScreeningScoreConfig,
} from "@/lib/utils/applicant-screening-score"

type LandlordProfileSettingsFormProps = {
  initialProfile: {
    firstName: string
    lastName: string
    mobile: string
    email: string
    landlordProfile?: LandlordProfile
    notificationProfile?: NotificationProfileDefaults
    screeningScoreConfig?: ApplicantScreeningScoreConfig
  }
  initialTeamUsers: AuthUser[]
  mode?: "profile" | "screening" | "team"
}

type FormState = {
  firstName: string
  lastName: string
  mobile: string
  tradingName: string
  registrationNumber: string
  addressLine1: string
  addressLine2: string
  city: string
  postcode: string
  outboundEmail: string
  copyLandlordOnTenantEmails: boolean
  screeningScoreConfig: ApplicantScreeningScoreConfig
}

type FeedbackState = {
  type: "success" | "error"
  message: string
} | null

type TeamMemberCreateState = {
  firstName: string
  lastName: string
  email: string
  mobile: string
  password: string
}

function createInitialFormState(profile: LandlordProfileSettingsFormProps["initialProfile"]): FormState {
  const screeningScoreConfig = normalizeApplicantScreeningScoreConfig(profile.screeningScoreConfig)

  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    mobile: profile.mobile,
    tradingName: profile.landlordProfile?.tradingName ?? "",
    registrationNumber: profile.landlordProfile?.registrationNumber ?? "",
    addressLine1: profile.landlordProfile?.addressLine1 ?? "",
    addressLine2: profile.landlordProfile?.addressLine2 ?? "",
    city: profile.landlordProfile?.city ?? "",
    postcode: profile.landlordProfile?.postcode ?? "",
    outboundEmail: profile.notificationProfile?.outboundEmail ?? "",
    copyLandlordOnTenantEmails: profile.notificationProfile?.copyLandlordOnTenantEmails ?? false,
    screeningScoreConfig,
  }
}

function createInitialTeamMemberFormState(): TeamMemberCreateState {
  return {
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    password: "",
  }
}

export default function LandlordProfileSettingsForm({
  initialProfile,
  initialTeamUsers,
  mode = "profile",
}: LandlordProfileSettingsFormProps) {
  const [formState, setFormState] = useState<FormState>(() => createInitialFormState(initialProfile))
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [teamFeedback, setTeamFeedback] = useState<FeedbackState>(null)
  const [teamUsers, setTeamUsers] = useState(initialTeamUsers)
  const [teamMemberForm, setTeamMemberForm] = useState<TeamMemberCreateState>(() => createInitialTeamMemberFormState())
  const [isPending, startTransition] = useTransition()

  function updateField<Key extends keyof FormState>(field: Key, value: FormState[Key]) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function updateScreeningField<Key extends keyof ApplicantScreeningScoreConfig>(
    field: Key,
    value: ApplicantScreeningScoreConfig[Key],
  ) {
    setFormState((current) => ({
      ...current,
      screeningScoreConfig: {
        ...current.screeningScoreConfig,
        [field]: value,
      },
    }))
  }

  function updateEmploymentStatusScore(status: keyof ApplicantScreeningScoreConfig["employmentStatusScores"], value: number) {
    setFormState((current) => ({
      ...current,
      screeningScoreConfig: {
        ...current.screeningScoreConfig,
        employmentStatusScores: {
          ...current.screeningScoreConfig.employmentStatusScores,
          [status]: value,
        },
      },
    }))
  }

  function parseNumericInput(value: string, fallback = 0) {
    if (!value.trim()) {
      return fallback
    }

    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  function formatEmploymentStatusLabel(status: ReturnType<typeof getEmploymentStatuses>[number]) {
    return status.replaceAll("_", " ")
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)

    startTransition(async () => {
      try {
        const response = await fetch("/api/landlord/profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            firstName: formState.firstName,
            lastName: formState.lastName,
            mobile: formState.mobile,
            landlordProfile: {
              tradingName: formState.tradingName,
              registrationNumber: formState.registrationNumber,
              addressLine1: formState.addressLine1,
              addressLine2: formState.addressLine2,
              city: formState.city,
              postcode: formState.postcode,
            },
            notificationProfile: {
              outboundEmail: formState.outboundEmail,
              copyLandlordOnTenantEmails: formState.copyLandlordOnTenantEmails,
            },
            screeningScoreConfig: formState.screeningScoreConfig,
          }),
        })

        const payload = (await response.json()) as {
          profile?: {
            firstName: string
            lastName: string
            mobile: string
            landlordProfile?: LandlordProfile | null
            notificationProfile?: NotificationProfileDefaults | null
            screeningScoreConfig?: ApplicantScreeningScoreConfig | null
          }
          error?: string
        }

        if (!response.ok || !payload.profile) {
          throw new Error(payload.error || "Unable to save your landlord profile.")
        }

        setFormState({
          firstName: payload.profile.firstName,
          lastName: payload.profile.lastName,
          mobile: payload.profile.mobile,
          tradingName: payload.profile.landlordProfile?.tradingName ?? "",
          registrationNumber: payload.profile.landlordProfile?.registrationNumber ?? "",
          addressLine1: payload.profile.landlordProfile?.addressLine1 ?? "",
          addressLine2: payload.profile.landlordProfile?.addressLine2 ?? "",
          city: payload.profile.landlordProfile?.city ?? "",
          postcode: payload.profile.landlordProfile?.postcode ?? "",
          outboundEmail: payload.profile.notificationProfile?.outboundEmail ?? "",
          copyLandlordOnTenantEmails: payload.profile.notificationProfile?.copyLandlordOnTenantEmails ?? false,
          screeningScoreConfig: normalizeApplicantScreeningScoreConfig(payload.profile.screeningScoreConfig ?? undefined),
        })

        setFeedback({
          type: "success",
          message: "Landlord profile saved.",
        })
      } catch (error) {
        setFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Unable to save your landlord profile.",
        })
      }
    })
  }

  function handleReset() {
    setFeedback(null)
    setFormState(createInitialFormState(initialProfile))
  }

  function updateTeamMemberField<Key extends keyof TeamMemberCreateState>(field: Key, value: TeamMemberCreateState[Key]) {
    setTeamMemberForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function handleCreateTeamMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTeamFeedback(null)

    startTransition(async () => {
      try {
        const response = await fetch("/api/landlord/team-users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(teamMemberForm),
        })

        const payload = (await response.json()) as {
          user?: AuthUser
          error?: string
        }

        if (!response.ok || !payload.user) {
          throw new Error(payload.error || "Unable to create landlord team user.")
        }

        setTeamUsers((current) => [...current, payload.user!].sort((left, right) => left.email.localeCompare(right.email)))
        setTeamMemberForm(createInitialTeamMemberFormState())
        setTeamFeedback({
          type: "success",
          message: "Team member login created.",
        })
      } catch (error) {
        setTeamFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Unable to create landlord team user.",
        })
      }
    })
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">
            {mode === "screening" ? "Applicant screening" : mode === "team" ? "Team access" : "Landlord profile"}
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            {mode === "screening"
              ? "Applicant screening score settings"
              : mode === "team"
                ? "Landlord team logins"
                : "Contact and communication settings"}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            {mode === "screening"
              ? "Configure how applicant profile data is scored in the application review panel. Scores persist on your landlord account."
              : mode === "team"
                ? "Add and manage additional landlord users for this account. All team members have full landlord access."
                : "Manage your profile details and tenant communication defaults used by the dashboard workflows."}
          </p>
        </div>
      </div>

      {mode !== "team" && feedback ? (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {mode !== "team" ? (
      <form className="mt-6 grid gap-4 lg:grid-cols-2" onSubmit={handleSubmit}>
        {mode === "profile" ? (
          <>
        <label className="block text-sm font-medium text-slate-700">
          First name
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
            value={formState.firstName}
            onChange={(event) => updateField("firstName", event.target.value)}
            required
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Last name
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
            value={formState.lastName}
            onChange={(event) => updateField("lastName", event.target.value)}
            required
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Mobile
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
            value={formState.mobile}
            onChange={(event) => updateField("mobile", event.target.value)}
            placeholder="07123 456789"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Trading name
          <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500" value={formState.tradingName} onChange={(event) => updateField("tradingName", event.target.value)} placeholder="Individual landlord or company name" />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Landlord registration number
          <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500" value={formState.registrationNumber} onChange={(event) => updateField("registrationNumber", event.target.value)} placeholder="Registration number" />
        </label>

        <label className="block text-sm font-medium text-slate-700 lg:col-span-2">
          Correspondence address
          <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500" value={formState.addressLine1} onChange={(event) => updateField("addressLine1", event.target.value)} placeholder="Address line 1" />
        </label>

        <label className="block text-sm font-medium text-slate-700 lg:col-span-2">
          Address line 2
          <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500" value={formState.addressLine2} onChange={(event) => updateField("addressLine2", event.target.value)} />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Town / city
          <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500" value={formState.city} onChange={(event) => updateField("city", event.target.value)} />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Postcode
          <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500" value={formState.postcode} onChange={(event) => updateField("postcode", event.target.value.toUpperCase())} />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Account email
          <input
            className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700"
            value={initialProfile.email}
            disabled
          />
        </label>

        <label className="block text-sm font-medium text-slate-700 lg:col-span-2">
          Outbound tenant email (optional)
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
            value={formState.outboundEmail}
            onChange={(event) => updateField("outboundEmail", event.target.value)}
            placeholder="Optional dedicated sender address"
          />
          <span className="mt-2 block text-xs text-slate-500">
            Leave blank to send from your account email.
          </span>
        </label>

        <label className="lg:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={formState.copyLandlordOnTenantEmails}
            onChange={(event) => updateField("copyLandlordOnTenantEmails", event.target.checked)}
          />
          Copy me on tenant communication emails by default
        </label>

          </>
        ) : null}

        {mode === "screening" ? (
        <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Scoring criteria</h2>
            <p className="text-sm text-slate-600">Set the score applied to each applicant criterion.</p>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Criterion</th>
                  <th className="px-4 py-3 text-left font-semibold">Scoring input</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {getEmploymentStatuses().map((status) => (
                  <tr key={status}>
                    <td className="px-4 py-3 font-medium text-slate-700 capitalize">Employment: {formatEmploymentStatusLabel(status)}</td>
                    <td className="px-4 py-3">
                      <input
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
                        type="number"
                        aria-label={`Employment score for ${formatEmploymentStatusLabel(status)}`}
                        title={`Employment score for ${formatEmploymentStatusLabel(status)}`}
                        value={formState.screeningScoreConfig.employmentStatusScores[status]}
                        onChange={(event) => updateEmploymentStatusScore(status, parseNumericInput(event.target.value))}
                      />
                    </td>
                  </tr>
                ))}

                <tr>
                  <td className="px-4 py-3 font-medium text-slate-700">Affordability pass score</td>
                  <td className="px-4 py-3">
                    <input
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
                      type="number"
                      aria-label="Affordability pass score"
                      title="Affordability pass score"
                      value={formState.screeningScoreConfig.incomeAffordabilityPassScore}
                      onChange={(event) =>
                        updateScreeningField("incomeAffordabilityPassScore", parseNumericInput(event.target.value))
                      }
                    />
                  </td>
                </tr>

                <tr>
                  <td className="px-4 py-3 font-medium text-slate-700">Affordability fail score</td>
                  <td className="px-4 py-3">
                    <input
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
                      type="number"
                      aria-label="Affordability fail score"
                      title="Affordability fail score"
                      value={formState.screeningScoreConfig.incomeAffordabilityFailScore}
                      onChange={(event) =>
                        updateScreeningField("incomeAffordabilityFailScore", parseNumericInput(event.target.value))
                      }
                    />
                  </td>
                </tr>

                <tr>
                  <td className="px-4 py-3 font-medium text-slate-700">Move-in target days</td>
                  <td className="px-4 py-3">
                    <input
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
                      type="number"
                      min="0"
                      aria-label="Move-in target days"
                      title="Move-in target days"
                      value={formState.screeningScoreConfig.moveInWithinDaysTarget}
                      onChange={(event) =>
                        updateScreeningField("moveInWithinDaysTarget", Math.max(0, parseNumericInput(event.target.value)))
                      }
                    />
                  </td>
                </tr>

                <tr>
                  <td className="px-4 py-3 font-medium text-slate-700">Move-in score (inside target)</td>
                  <td className="px-4 py-3">
                    <input
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
                      type="number"
                      aria-label="Move-in score inside target"
                      title="Move-in score inside target"
                      value={formState.screeningScoreConfig.moveInWithinTargetScore}
                      onChange={(event) =>
                        updateScreeningField("moveInWithinTargetScore", parseNumericInput(event.target.value))
                      }
                    />
                  </td>
                </tr>

                <tr>
                  <td className="px-4 py-3 font-medium text-slate-700">Move-in score (outside target)</td>
                  <td className="px-4 py-3">
                    <input
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
                      type="number"
                      aria-label="Move-in score outside target"
                      title="Move-in score outside target"
                      value={formState.screeningScoreConfig.moveInOutsideTargetScore}
                      onChange={(event) =>
                        updateScreeningField("moveInOutsideTargetScore", parseNumericInput(event.target.value))
                      }
                    />
                  </td>
                </tr>

                <tr>
                  <td className="px-4 py-3 font-medium text-slate-700">Score per preferred contact method</td>
                  <td className="px-4 py-3">
                    <input
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
                      type="number"
                      aria-label="Score per preferred contact method"
                      title="Score per preferred contact method"
                      value={formState.screeningScoreConfig.perPreferredContactMethodScore}
                      onChange={(event) =>
                        updateScreeningField("perPreferredContactMethodScore", parseNumericInput(event.target.value))
                      }
                    />
                  </td>
                </tr>

                <tr>
                  <td className="px-4 py-3 font-medium text-slate-700">Pets score</td>
                  <td className="px-4 py-3">
                    <input
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
                      type="number"
                      aria-label="Pets score"
                      title="Pets score"
                      value={formState.screeningScoreConfig.hasPetsScore}
                      onChange={(event) => updateScreeningField("hasPetsScore", parseNumericInput(event.target.value))}
                    />
                  </td>
                </tr>

                <tr>
                  <td className="px-4 py-3 font-medium text-slate-700">Smoking score</td>
                  <td className="px-4 py-3">
                    <input
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
                      type="number"
                      aria-label="Smoking score"
                      title="Smoking score"
                      value={formState.screeningScoreConfig.smokesScore}
                      onChange={(event) => updateScreeningField("smokesScore", parseNumericInput(event.target.value))}
                    />
                  </td>
                </tr>

                <tr>
                  <td className="px-4 py-3 font-medium text-slate-700">Adverse credit score</td>
                  <td className="px-4 py-3">
                    <input
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
                      type="number"
                      aria-label="Adverse credit score"
                      title="Adverse credit score"
                      value={formState.screeningScoreConfig.adverseCreditScore}
                      onChange={(event) =>
                        updateScreeningField("adverseCreditScore", parseNumericInput(event.target.value))
                      }
                    />
                  </td>
                </tr>

                <tr>
                  <td className="px-4 py-3 font-medium text-slate-700">Credit consent score</td>
                  <td className="px-4 py-3">
                    <input
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
                      type="number"
                      aria-label="Credit consent score"
                      title="Credit consent score"
                      value={formState.screeningScoreConfig.creditConsentScore}
                      onChange={(event) =>
                        updateScreeningField("creditConsentScore", parseNumericInput(event.target.value))
                      }
                    />
                  </td>
                </tr>

                <tr>
                  <td className="px-4 py-3 font-medium text-slate-700">Additional occupant score (per occupant above 1)</td>
                  <td className="px-4 py-3">
                    <input
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
                      type="number"
                      aria-label="Additional occupant score"
                      title="Additional occupant score"
                      value={formState.screeningScoreConfig.additionalOccupantScore}
                      onChange={(event) =>
                        updateScreeningField("additionalOccupantScore", parseNumericInput(event.target.value))
                      }
                    />
                  </td>
                </tr>

                <tr>
                  <td className="px-4 py-3 font-medium text-slate-700">Guarantor signed-off score</td>
                  <td className="px-4 py-3">
                    <input
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
                      type="number"
                      aria-label="Guarantor signed-off score"
                      title="Guarantor signed-off score"
                      value={formState.screeningScoreConfig.guarantorSignedOffScore}
                      onChange={(event) =>
                        updateScreeningField("guarantorSignedOffScore", parseNumericInput(event.target.value))
                      }
                    />
                  </td>
                </tr>

                <tr>
                  <td className="px-4 py-3 font-medium text-slate-700">Guarantor declined score</td>
                  <td className="px-4 py-3">
                    <input
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
                      type="number"
                      aria-label="Guarantor declined score"
                      title="Guarantor declined score"
                      value={formState.screeningScoreConfig.guarantorDeclinedScore}
                      onChange={(event) =>
                        updateScreeningField("guarantorDeclinedScore", parseNumericInput(event.target.value))
                      }
                    />
                  </td>
                </tr>

                <tr>
                  <td className="px-4 py-3 font-medium text-slate-700">Site visit scheduled score</td>
                  <td className="px-4 py-3">
                    <input
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
                      type="number"
                      aria-label="Site visit scheduled score"
                      title="Site visit scheduled score"
                      value={formState.screeningScoreConfig.siteVisitScheduledScore}
                      onChange={(event) =>
                        updateScreeningField("siteVisitScheduledScore", parseNumericInput(event.target.value))
                      }
                    />
                  </td>
                </tr>

                <tr>
                  <td className="px-4 py-3 font-medium text-slate-700">Site visit completed score</td>
                  <td className="px-4 py-3">
                    <input
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
                      type="number"
                      aria-label="Site visit completed score"
                      title="Site visit completed score"
                      value={formState.screeningScoreConfig.siteVisitCompletedScore}
                      onChange={(event) =>
                        updateScreeningField("siteVisitCompletedScore", parseNumericInput(event.target.value))
                      }
                    />
                  </td>
                </tr>

                <tr>
                  <td className="px-4 py-3 font-medium text-slate-700">Site visit issue score (no access/cancelled)</td>
                  <td className="px-4 py-3">
                    <input
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
                      type="number"
                      aria-label="Site visit issue score"
                      title="Site visit issue score"
                      value={formState.screeningScoreConfig.siteVisitIssueScore}
                      onChange={(event) =>
                        updateScreeningField("siteVisitIssueScore", parseNumericInput(event.target.value))
                      }
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white"
              onClick={() => updateField("screeningScoreConfig", DEFAULT_APPLICANT_SCREENING_SCORE_CONFIG)}
            >
              Reset scoring defaults
            </button>
          </div>
        </section>
        ) : null}

        <div className="lg:col-span-2 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
            disabled={isPending}
          >
            {isPending ? "Saving..." : mode === "screening" ? "Save screening settings" : "Save landlord profile"}
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700 transition-colors hover:bg-white"
            onClick={handleReset}
            disabled={isPending}
          >
            Reset changes
          </button>
        </div>
      </form>
      ) : null}

      {mode === "team" ? (
      <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-lg font-semibold text-slate-900">Landlord team logins</h2>
        <p className="mt-2 text-sm text-slate-600">
          Add additional landlord users under this account. All team members have full landlord access.
        </p>

        {teamFeedback ? (
          <div
            className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
              teamFeedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-rose-200 bg-rose-50 text-rose-900"
            }`}
          >
            {teamFeedback.message}
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Current team members</div>
          {teamUsers.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No team members found.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {teamUsers.map((user) => (
                <div key={user.id} className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 md:flex-row md:items-center md:justify-between">
                  <div className="font-medium text-slate-900">{`${user.first_name} ${user.last_name}`.trim() || user.email}</div>
                  <div>{user.email}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleCreateTeamMember}>
          <label className="block text-sm font-medium text-slate-700">
            First name
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
              value={teamMemberForm.firstName}
              onChange={(event) => updateTeamMemberField("firstName", event.target.value)}
              required
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Last name
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
              value={teamMemberForm.lastName}
              onChange={(event) => updateTeamMemberField("lastName", event.target.value)}
              required
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
              type="email"
              value={teamMemberForm.email}
              onChange={(event) => updateTeamMemberField("email", event.target.value)}
              required
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Mobile (optional)
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
              value={teamMemberForm.mobile}
              onChange={(event) => updateTeamMemberField("mobile", event.target.value)}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700 md:col-span-2">
            Temporary password
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
              type="password"
              value={teamMemberForm.password}
              onChange={(event) => updateTeamMemberField("password", event.target.value)}
              required
              minLength={8}
            />
            <span className="mt-2 block text-xs text-slate-500">
              Share this securely with the new user.
            </span>
          </label>

          <div className="md:col-span-2 flex items-center gap-3">
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
              disabled={isPending}
            >
              {isPending ? "Creating..." : "Add landlord team user"}
            </button>
          </div>
        </form>
      </section>
      ) : null}
    </section>
  )
}
