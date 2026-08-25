"use client"

import { useState, useTransition } from "react"

import PropertyTabs from "@/components/properties/PropertyTabs"
import type { PropertyLettingPreferences, PropertyRecord } from "@/lib/auth"

type PropertyLettingPreferencesPageClientProps = {
  initialProperty: PropertyRecord
  canManage: boolean
}

function toPreferences(preferences: PropertyLettingPreferences | undefined): PropertyLettingPreferences {
  return {
    petsAllowed: preferences?.petsAllowed ?? false,
    smokingAllowed: preferences?.smokingAllowed ?? false,
    studentsAccepted: preferences?.studentsAccepted ?? false,
    universalCreditConsidered: preferences?.universalCreditConsidered ?? false,
    guarantorRequired: preferences?.guarantorRequired ?? false,
    maximumOccupants: preferences?.maximumOccupants,
    minimumTenancyLengthMonths: preferences?.minimumTenancyLengthMonths,
  }
}

export default function PropertyLettingPreferencesPageClient({ initialProperty, canManage }: PropertyLettingPreferencesPageClientProps) {
  const [property, setProperty] = useState(initialProperty)
  const [preferences, setPreferences] = useState(() => toPreferences(initialProperty.lettingPreferences))
  const [isEditMode, setIsEditMode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const toggleFields: Array<[keyof Pick<PropertyLettingPreferences, "petsAllowed" | "smokingAllowed" | "studentsAccepted" | "universalCreditConsidered" | "guarantorRequired">, string]> = [
    ["petsAllowed", "Pets allowed"],
    ["smokingAllowed", "Smoking allowed"],
    ["studentsAccepted", "Students accepted"],
    ["universalCreditConsidered", "DSS / Universal Credit considered"],
    ["guarantorRequired", "Guarantor required"],
  ]

  const savePreferences = () => {
    setError(null)
    startTransition(async () => {
      const response = await fetch(`/api/properties/${property.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lettingPreferences: preferences }),
      })
      const payload = (await response.json()) as { property?: PropertyRecord; error?: string }
      if (!response.ok || !payload.property) {
        setError(payload.error || "Unable to save letting preferences.")
        return
      }
      setProperty(payload.property)
      setPreferences(toPreferences(payload.property.lettingPreferences))
      setIsEditMode(false)
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Property</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{property.address}</h1>
          <p className="mt-2 text-sm text-slate-600">Set applicant and tenancy acceptance terms for this property.</p>
        </div>
      </div>

      <PropertyTabs propertyId={property.id} />

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="text-lg font-semibold text-slate-900">Letting Preferences</h2><p className="mt-1 text-sm text-slate-600">Applicant suitability and tenancy limits.</p></div>
          {canManage && !isEditMode ? <button type="button" onClick={() => setIsEditMode(true)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Edit</button> : null}
        </div>
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        {isEditMode ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {toggleFields.map(([field, label]) => (
                <label key={field} className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800">
                  {label}
                  <input type="checkbox" checked={preferences[field]} onChange={(event) => setPreferences((current) => ({ ...current, [field]: event.target.checked }))} className="h-4 w-4 rounded border-slate-300" />
                </label>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">Maximum occupants<input type="number" min="0" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" value={preferences.maximumOccupants ?? ""} onChange={(event) => setPreferences((current) => ({ ...current, maximumOccupants: event.target.value ? Number(event.target.value) : undefined }))} /></label>
              <label className="text-sm font-medium text-slate-700">Minimum tenancy length (months)<input type="number" min="0" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" value={preferences.minimumTenancyLengthMonths ?? ""} onChange={(event) => setPreferences((current) => ({ ...current, minimumTenancyLengthMonths: event.target.value ? Number(event.target.value) : undefined }))} /></label>
            </div>
            <div className="flex gap-3"><button type="button" disabled={isPending} onClick={savePreferences} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isPending ? "Saving..." : "Save preferences"}</button><button type="button" disabled={isPending} onClick={() => { setPreferences(toPreferences(property.lettingPreferences)); setIsEditMode(false) }} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button></div>
          </div>
        ) : (
          <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {toggleFields.map(([field, label]) => <div key={field} className="rounded-md bg-slate-50 p-4"><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</dt><dd className="mt-2 font-semibold text-slate-900">{preferences[field] ? "Yes" : "No"}</dd></div>)}
            <div className="rounded-md bg-slate-50 p-4"><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Maximum occupants</dt><dd className="mt-2 font-semibold text-slate-900">{preferences.maximumOccupants ?? "Not recorded"}</dd></div>
            <div className="rounded-md bg-slate-50 p-4"><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Minimum tenancy length</dt><dd className="mt-2 font-semibold text-slate-900">{preferences.minimumTenancyLengthMonths !== undefined ? `${preferences.minimumTenancyLengthMonths} months` : "Not recorded"}</dd></div>
          </dl>
        )}
      </section>
    </div>
  )
}