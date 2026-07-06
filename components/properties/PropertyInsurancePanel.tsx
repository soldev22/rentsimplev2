"use client"

import { useState, useTransition } from "react"

import type { PropertyInsurance, PropertyRecord } from "@/lib/auth"

type InsuranceFormState = {
  isInsured: boolean
  insurerName: string
  policyNumber: string
  renewalDate: string
  notes: string
}

function toFormState(insurance: PropertyInsurance | undefined): InsuranceFormState {
  return {
    isInsured: insurance?.isInsured ?? false,
    insurerName: insurance?.insurerName ?? "",
    policyNumber: insurance?.policyNumber ?? "",
    renewalDate: insurance?.renewalDate ?? "",
    notes: insurance?.notes ?? "",
  }
}

function getRenewalStatus(renewalDate: string | undefined): "expired" | "soon" | "ok" | null {
  if (!renewalDate) {
    return null
  }

  const renewal = new Date(renewalDate)

  if (Number.isNaN(renewal.getTime())) {
    return null
  }

  const now = new Date()
  const msUntilRenewal = renewal.getTime() - now.getTime()
  const daysUntilRenewal = msUntilRenewal / (1000 * 60 * 60 * 24)

  if (daysUntilRenewal < 0) {
    return "expired"
  }

  if (daysUntilRenewal <= 30) {
    return "soon"
  }

  return "ok"
}

type PropertyInsurancePanelProps = {
  property: PropertyRecord
  canManage: boolean
  onPropertyUpdate: (updated: PropertyRecord) => void
}

export default function PropertyInsurancePanel({
  property,
  canManage,
  onPropertyUpdate,
}: PropertyInsurancePanelProps) {
  const [form, setForm] = useState<InsuranceFormState>(() => toFormState(property.insurance))
  const [isEditMode, setIsEditMode] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const renewalStatus = getRenewalStatus(property.insurance?.renewalDate)

  function updateField(name: keyof InsuranceFormState, value: string | boolean) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  function handleEdit() {
    setForm(toFormState(property.insurance))
    setError(null)
    setMessage(null)
    setIsEditMode(true)
  }

  function handleCancel() {
    setForm(toFormState(property.insurance))
    setError(null)
    setMessage(null)
    setIsEditMode(false)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    startTransition(async () => {
      const response = await fetch(`/api/properties/${property.id}/insurance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isInsured: form.isInsured,
          insurerName: form.isInsured ? form.insurerName.trim() || undefined : undefined,
          policyNumber: form.isInsured ? form.policyNumber.trim() || undefined : undefined,
          renewalDate: form.isInsured ? form.renewalDate.trim() || undefined : undefined,
          notes: form.isInsured ? form.notes.trim() || undefined : undefined,
        }),
      })

      const payload = (await response.json()) as { property?: PropertyRecord; error?: string }

      if (!response.ok || !payload.property) {
        setError(payload.error || "Unable to save insurance details.")
        return
      }

      onPropertyUpdate(payload.property)
      setIsEditMode(false)
      setMessage("Insurance details saved.")
    })
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Insurance</h3>
          <p className="mt-1 text-sm text-slate-500">
            Record whether this property is insured and track the renewal date.
          </p>
        </div>

        {!isEditMode && canManage ? (
          <button
            type="button"
            className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={handleEdit}
          >
            Edit
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
      ) : null}

      {message ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}

      {isEditMode ? (
        <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
          <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 accent-slate-900"
              checked={form.isInsured}
              onChange={(e) => updateField("isInsured", e.target.checked)}
            />
            Property is insured
          </label>

          {form.isInsured ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Insurer name
                  <input
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    value={form.insurerName}
                    onChange={(e) => updateField("insurerName", e.target.value)}
                    placeholder="e.g. Aviva, AXA"
                  />
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Policy number
                  <input
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    value={form.policyNumber}
                    onChange={(e) => updateField("policyNumber", e.target.value)}
                    placeholder="POL-123456"
                  />
                </label>
              </div>

              <label className="text-sm font-medium text-slate-700">
                Renewal date
                <input
                  type="date"
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 sm:w-56"
                  value={form.renewalDate}
                  onChange={(e) => updateField("renewalDate", e.target.value)}
                />
              </label>

              <label className="text-sm font-medium text-slate-700">
                Notes
                <textarea
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  placeholder="Optional notes about cover, excess, or contact details"
                />
              </label>
            </>
          ) : null}

          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={isPending}
            >
              {isPending ? "Saving…" : "Save insurance"}
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              disabled={isPending}
              onClick={handleCancel}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4">
          {!property.insurance || !property.insurance.isInsured ? (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span className="text-base">⚠</span>
              <span>No insurance recorded for this property.</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                  <span>✓</span> Insured
                </span>

                {renewalStatus === "expired" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                    Policy expired
                  </span>
                ) : renewalStatus === "soon" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                    Renewal due soon
                  </span>
                ) : null}
              </div>

              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                {property.insurance.insurerName ? (
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Insurer</dt>
                    <dd className="mt-0.5 text-slate-900">{property.insurance.insurerName}</dd>
                  </div>
                ) : null}

                {property.insurance.policyNumber ? (
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Policy number</dt>
                    <dd className="mt-0.5 font-mono text-slate-900">{property.insurance.policyNumber}</dd>
                  </div>
                ) : null}

                {property.insurance.renewalDate ? (
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Renewal date</dt>
                    <dd
                      className={`mt-0.5 ${
                        renewalStatus === "expired"
                          ? "font-semibold text-rose-700"
                          : renewalStatus === "soon"
                            ? "font-semibold text-amber-700"
                            : "text-slate-900"
                      }`}
                    >
                      {new Date(property.insurance.renewalDate).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </dd>
                  </div>
                ) : null}

                {property.insurance.notes ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium text-slate-500">Notes</dt>
                    <dd className="mt-0.5 text-slate-900">{property.insurance.notes}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
