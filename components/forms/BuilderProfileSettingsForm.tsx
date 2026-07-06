"use client"

import { useState, useTransition } from "react"

import type { BuilderProfileDefaults, BuilderTrade, PreferredContactMethod } from "@/lib/auth"

type BuilderProfileSettingsFormProps = {
  initialBuilderProfile?: BuilderProfileDefaults
}

type FormState = {
  companyName: string
  primaryTrade: BuilderTrade
  serviceAreas: string
  preferredContactMethods: PreferredContactMethod[]
  emergencyCalloutAvailable: boolean
  hourlyRateGuidance: string
  availabilityNotes: string
  insuranceExpiryDate: string
  gasSafeRegistered: boolean
  gasSafeNumber: string
  electricalCertified: boolean
  electricalCertificationScheme: string
  dbsChecked: boolean
  dbsExpiryDate: string
  accreditationNotes: string
}

type FeedbackState = {
  type: "success" | "error"
  message: string
} | null

const tradeOptions: Array<{ value: BuilderTrade; label: string }> = [
  { value: "general_builder", label: "General builder" },
  { value: "multi_trade", label: "Multi-trade" },
  { value: "plumber", label: "Plumber" },
  { value: "electrician", label: "Electrician" },
  { value: "heating_engineer", label: "Heating engineer" },
  { value: "roofer", label: "Roofer" },
  { value: "other", label: "Other" },
]

const preferredContactMethodOptions: Array<{ value: PreferredContactMethod; label: string }> = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone call" },
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
]

function createInitialFormState(builderProfile?: BuilderProfileDefaults): FormState {
  return {
    companyName: builderProfile?.companyName ?? "",
    primaryTrade: builderProfile?.primaryTrade ?? "general_builder",
    serviceAreas: builderProfile?.serviceAreas ?? "",
    preferredContactMethods:
      builderProfile?.preferredContactMethods && builderProfile.preferredContactMethods.length > 0
        ? builderProfile.preferredContactMethods
        : ["email"],
    emergencyCalloutAvailable: builderProfile?.emergencyCalloutAvailable ?? false,
    hourlyRateGuidance: builderProfile?.hourlyRateGuidance ? String(builderProfile.hourlyRateGuidance) : "",
    availabilityNotes: builderProfile?.availabilityNotes ?? "",
    insuranceExpiryDate: builderProfile?.insuranceExpiryDate ?? "",
    gasSafeRegistered: builderProfile?.gasSafeRegistered ?? false,
    gasSafeNumber: builderProfile?.gasSafeNumber ?? "",
    electricalCertified: builderProfile?.electricalCertified ?? false,
    electricalCertificationScheme: builderProfile?.electricalCertificationScheme ?? "",
    dbsChecked: builderProfile?.dbsChecked ?? false,
    dbsExpiryDate: builderProfile?.dbsExpiryDate ?? "",
    accreditationNotes: builderProfile?.accreditationNotes ?? "",
  }
}

function buildBuilderProfile(formState: FormState): BuilderProfileDefaults {
  return {
    companyName: formState.companyName,
    primaryTrade: formState.primaryTrade,
    serviceAreas: formState.serviceAreas,
    preferredContactMethods: formState.preferredContactMethods,
    emergencyCalloutAvailable: formState.emergencyCalloutAvailable,
    hourlyRateGuidance: Number(formState.hourlyRateGuidance),
    availabilityNotes: formState.availabilityNotes,
    insuranceExpiryDate: formState.insuranceExpiryDate,
    gasSafeRegistered: formState.gasSafeRegistered,
    gasSafeNumber: formState.gasSafeNumber,
    electricalCertified: formState.electricalCertified,
    electricalCertificationScheme: formState.electricalCertificationScheme,
    dbsChecked: formState.dbsChecked,
    dbsExpiryDate: formState.dbsExpiryDate,
    accreditationNotes: formState.accreditationNotes,
  }
}

export default function BuilderProfileSettingsForm({ initialBuilderProfile }: BuilderProfileSettingsFormProps) {
  const [formState, setFormState] = useState<FormState>(() => createInitialFormState(initialBuilderProfile))
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [isPending, startTransition] = useTransition()

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
        const response = await fetch("/api/builder/profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildBuilderProfile(formState)),
        })

        const payload = (await response.json()) as {
          builderProfile?: BuilderProfileDefaults | null
          error?: string
        }

        if (!response.ok || !payload.builderProfile) {
          throw new Error(payload.error || "Unable to save your builder profile.")
        }

        setFormState(createInitialFormState(payload.builderProfile))
        setFeedback({
          type: "success",
          message: "Builder profile saved. Your maintenance workspace will use these trade and accreditation details.",
        })
      } catch (error) {
        setFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Unable to save your builder profile.",
        })
      }
    })
  }

  function handleReset() {
    setFeedback(null)
    setFormState(createInitialFormState(initialBuilderProfile))
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Builder profile</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Trade, coverage, and accreditation</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Keep your company details, service coverage, certifications, and contact preferences current so bidding and compliance checks move faster.
          </p>
        </div>
      </div>

      {feedback ? (
        <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"}`}>
          {feedback.message}
        </div>
      ) : null}

      <form className="mt-6 grid gap-4 lg:grid-cols-2" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-slate-700">
          Company name
          <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500" value={formState.companyName} onChange={(event) => updateField("companyName", event.target.value)} required />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Primary trade
          <select className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500" value={formState.primaryTrade} onChange={(event) => updateField("primaryTrade", event.target.value as BuilderTrade)} aria-label="Select your primary trade" title="Select your primary trade">
            {tradeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-slate-700 lg:col-span-2">
          Service areas
          <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500" value={formState.serviceAreas} onChange={(event) => updateField("serviceAreas", event.target.value)} placeholder="Cities, boroughs, or postcodes you cover" />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Guide hourly rate
          <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500" type="number" min="0" value={formState.hourlyRateGuidance} onChange={(event) => updateField("hourlyRateGuidance", event.target.value)} />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Insurance expiry date
          <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500" type="date" value={formState.insuranceExpiryDate} onChange={(event) => updateField("insuranceExpiryDate", event.target.value)} />
        </label>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 lg:col-span-2">
          <div className="font-medium text-slate-900">Preferred contact methods</div>
          <p className="mt-2 text-sm text-slate-600">Choose the channels you want the maintenance team to use first.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {preferredContactMethodOptions.map((option) => (
              <label key={option.value} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={formState.preferredContactMethods.includes(option.value)} onChange={(event) => togglePreferredContactMethod(option.value, event.target.checked)} />
                {option.label}
              </label>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={formState.emergencyCalloutAvailable} onChange={(event) => updateField("emergencyCalloutAvailable", event.target.checked)} />
          Emergency callout available
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={formState.dbsChecked} onChange={(event) => updateField("dbsChecked", event.target.checked)} />
          DBS checked
        </label>

        <label className="block text-sm font-medium text-slate-700">
          DBS expiry date
          <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500" type="date" value={formState.dbsExpiryDate} onChange={(event) => updateField("dbsExpiryDate", event.target.value)} />
        </label>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <label className="flex items-center gap-3 font-medium text-slate-700">
            <input type="checkbox" checked={formState.gasSafeRegistered} onChange={(event) => updateField("gasSafeRegistered", event.target.checked)} />
            Gas Safe registered
          </label>
          <label className="mt-4 block text-sm font-medium text-slate-700">
            Gas Safe number
            <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500" value={formState.gasSafeNumber} onChange={(event) => updateField("gasSafeNumber", event.target.value)} />
          </label>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <label className="flex items-center gap-3 font-medium text-slate-700">
            <input type="checkbox" checked={formState.electricalCertified} onChange={(event) => updateField("electricalCertified", event.target.checked)} />
            Electrical certification held
          </label>
          <label className="mt-4 block text-sm font-medium text-slate-700">
            Certification scheme
            <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500" value={formState.electricalCertificationScheme} onChange={(event) => updateField("electricalCertificationScheme", event.target.value)} placeholder="NICEIC, NAPIT, or equivalent" />
          </label>
        </div>

        <label className="block text-sm font-medium text-slate-700 lg:col-span-2">
          Availability notes
          <textarea className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500" value={formState.availabilityNotes} onChange={(event) => updateField("availabilityNotes", event.target.value)} placeholder="Typical lead time, team size, weekends, out-of-hours coverage" />
        </label>

        <label className="block text-sm font-medium text-slate-700 lg:col-span-2">
          Accreditation notes
          <textarea className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500" value={formState.accreditationNotes} onChange={(event) => updateField("accreditationNotes", event.target.value)} placeholder="Insurance broker, document storage, specialist approvals, or anything staff should know" />
        </label>

        <div className="lg:col-span-2 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60" disabled={isPending}>
            {isPending ? "Saving..." : "Save builder profile"}
          </button>
          <button type="button" className="rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700 transition-colors hover:bg-white" onClick={handleReset} disabled={isPending}>
            Reset changes
          </button>
        </div>
      </form>
    </section>
  )
}