"use client"

import { useState, useTransition } from "react"

import type { ApplicantProfileDefaults, EmploymentStatus, PreferredContactMethod } from "@/lib/auth"

type ApplicantProfileSettingsFormProps = {
  initialApplicantProfile?: ApplicantProfileDefaults
}

type FormState = {
  employmentStatus: EmploymentStatus
  annualIncome: string
  moveInDate: string
  preferredContactMethods: PreferredContactMethod[]
  hasPets: boolean
  petDetails: string
  smokes: boolean
  occupantCount: string
  hasAdverseCredit: boolean
  adverseCreditDetails: string
}

type FeedbackState = {
  type: "success" | "error"
  message: string
} | null

const employmentOptions: Array<{ value: EmploymentStatus; label: string }> = [
  { value: "employed_full_time", label: "Employed full-time" },
  { value: "employed_part_time", label: "Employed part-time" },
  { value: "self_employed", label: "Self-employed" },
  { value: "contractor", label: "Contractor" },
  { value: "student", label: "Student" },
  { value: "retired", label: "Retired" },
  { value: "unemployed", label: "Unemployed" },
  { value: "other", label: "Other" },
]

const preferredContactMethodOptions: Array<{ value: PreferredContactMethod; label: string }> = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone call" },
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
]

function createInitialFormState(applicantProfile?: ApplicantProfileDefaults): FormState {
  return {
    employmentStatus: applicantProfile?.employmentStatus ?? "employed_full_time",
    annualIncome: applicantProfile?.annualIncome != null ? String(applicantProfile.annualIncome) : "",
    moveInDate: applicantProfile?.moveInDate ?? "",
    preferredContactMethods: applicantProfile?.preferredContactMethods ?? [],
    hasPets: applicantProfile?.hasPets ?? false,
    petDetails: applicantProfile?.petDetails ?? "",
    smokes: applicantProfile?.smokes ?? false,
    occupantCount: String(applicantProfile?.occupantCount ?? 1),
    hasAdverseCredit: applicantProfile?.hasAdverseCredit ?? false,
    adverseCreditDetails: applicantProfile?.adverseCreditDetails ?? "",
  }
}

function buildApplicantProfile(formState: FormState): ApplicantProfileDefaults {
  return {
    employmentStatus: formState.employmentStatus,
    annualIncome: Number(formState.annualIncome),
    moveInDate: formState.moveInDate,
    preferredContactMethods: formState.preferredContactMethods,
    hasPets: formState.hasPets,
    petDetails: formState.petDetails,
    smokes: formState.smokes,
    occupantCount: Number(formState.occupantCount),
    hasAdverseCredit: formState.hasAdverseCredit,
    adverseCreditDetails: formState.adverseCreditDetails,
  }
}

export default function ApplicantProfileSettingsForm({ initialApplicantProfile }: ApplicantProfileSettingsFormProps) {
  const [formState, setFormState] = useState<FormState>(() => createInitialFormState(initialApplicantProfile))
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [isPending, startTransition] = useTransition()
  const [isErasureRequested, setIsErasureRequested] = useState(false)

  function updateField<Key extends keyof FormState>(field: Key, value: FormState[Key]) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function togglePreferredContactMethod(value: PreferredContactMethod, checked: boolean) {
    setFormState((current) => ({
      ...current,
      preferredContactMethods: checked
        ? current.preferredContactMethods.includes(value)
          ? current.preferredContactMethods
          : [...current.preferredContactMethods, value]
        : current.preferredContactMethods.filter((method) => method !== value),
    }))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)

    startTransition(async () => {
      try {
        const response = await fetch("/api/applicant/profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildApplicantProfile(formState)),
        })

        const payload = (await response.json()) as {
          applicantProfile?: ApplicantProfileDefaults | null
          error?: string
        }

        if (!response.ok || !payload.applicantProfile) {
          throw new Error(payload.error || "Unable to save your applicant profile.")
        }

        setFormState(createInitialFormState(payload.applicantProfile))
        setFeedback({
          type: "success",
          message: "Applicant profile saved. New applications will start with these answers.",
        })
      } catch (error) {
        setFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Unable to save your applicant profile.",
        })
      }
    })
  }

  function handleReset() {
    setFeedback(null)
    setFormState(createInitialFormState(initialApplicantProfile))
  }

  function requestAccountErasure() {
    if (!window.confirm("Request permanent deletion of your account and application data? A Global admin will review whether you have ever held an active tenancy before completing the request.")) {
      return
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/applicant/account-erasure-request", { method: "POST" })
        const payload = (await response.json()) as { error?: string }

        if (!response.ok) throw new Error(payload.error || "Unable to request account erasure.")

        setIsErasureRequested(true)
      } catch (error) {
        setFeedback({ type: "error", message: error instanceof Error ? error.message : "Unable to request account erasure." })
      }
    })
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Applicant profile</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Reusable application defaults</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Save the information you use repeatedly so each new tenancy application starts mostly complete. Credit and referencing consent is still collected per application.
          </p>
        </div>
      </div>

      {feedback ? (
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

      <form className="mt-6 grid gap-4 lg:grid-cols-2" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-slate-700">
          Employment status
          <select
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
            value={formState.employmentStatus}
            onChange={(event) => updateField("employmentStatus", event.target.value as EmploymentStatus)}
            aria-label="Select your employment status"
            title="Select your employment status"
          >
            {employmentOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Annual income
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
            type="number"
            min="0"
            value={formState.annualIncome}
            onChange={(event) => updateField("annualIncome", event.target.value)}
            required
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Preferred move-in date
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
            type="date"
            value={formState.moveInDate}
            onChange={(event) => updateField("moveInDate", event.target.value)}
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Number of occupants
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
            type="number"
            min="1"
            value={formState.occupantCount}
            onChange={(event) => updateField("occupantCount", event.target.value)}
            required
          />
        </label>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 lg:col-span-2">
          <div className="font-medium text-slate-900">Preferred contact methods</div>
          <p className="mt-2 text-sm text-slate-600">
            Choose every channel you are happy for the lettings team to use by default.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {preferredContactMethodOptions.map((option) => (
              <label key={option.value} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={formState.preferredContactMethods.includes(option.value)}
                  onChange={(event) => togglePreferredContactMethod(option.value, event.target.checked)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={formState.hasPets} onChange={(event) => updateField("hasPets", event.target.checked)} />
          I have pets
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={formState.smokes} onChange={(event) => updateField("smokes", event.target.checked)} />
          I smoke
        </label>

        <label className="block text-sm font-medium text-slate-700 lg:col-span-2">
          Pet details
          <textarea
            className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
            value={formState.petDetails}
            onChange={(event) => updateField("petDetails", event.target.value)}
            placeholder="Breed, count, and any relevant information"
          />
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 lg:col-span-2">
          <input
            type="checkbox"
            checked={formState.hasAdverseCredit}
            onChange={(event) => updateField("hasAdverseCredit", event.target.checked)}
          />
          I need to disclose CCJs or adverse credit history
        </label>

        <label className="block text-sm font-medium text-slate-700 lg:col-span-2">
          Adverse credit details
          <textarea
            className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
            value={formState.adverseCreditDetails}
            onChange={(event) => updateField("adverseCreditDetails", event.target.value)}
            placeholder="Explain any CCJs, defaults, or related history"
          />
        </label>

        <div className="lg:col-span-2 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
            disabled={isPending}
          >
            {isPending ? "Saving..." : "Save applicant profile"}
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

      <section className="mt-8 border-t border-rose-200 pt-6">
        <h2 className="text-lg font-semibold text-slate-900">Account erasure</h2>
        <p className="mt-2 text-sm text-slate-600">Request permanent removal of your account and application data. A Global admin must review and complete this request.</p>
        {isErasureRequested ? (
          <p className="mt-4 text-sm font-medium text-amber-800">Your account-erasure request has been sent to the Global admin.</p>
        ) : (
          <button type="button" onClick={requestAccountErasure} disabled={isPending} className="mt-4 rounded-md border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60">
            Request account erasure
          </button>
        )}
      </section>
    </section>
  )
}