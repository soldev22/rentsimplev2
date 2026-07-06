"use client"

import { useState, useTransition } from "react"

import type { PropertyFinancials, PropertyRecord } from "@/lib/auth"

type FinancialsFormState = {
  propertyValue: string
  annualAppreciationRate: string
  estimatedAnnualCosts: string
}

function toFormState(financials: PropertyFinancials | undefined): FinancialsFormState {
  return {
    propertyValue: String(financials?.propertyValue ?? ""),
    annualAppreciationRate: String(financials?.annualAppreciationRate ?? "3"),
    estimatedAnnualCosts: String(financials?.estimatedAnnualCosts ?? ""),
  }
}

type FinancialMetric = {
  label: string
  value: number | string
  suffix?: string
  highlighted?: boolean
}

function calculateROI(property: PropertyRecord, form: FinancialsFormState): FinancialMetric[] {
  const propertyValue = Number(form.propertyValue) || 0
  const appreciationRate = Number(form.annualAppreciationRate) || 0
  const annualCosts = Number(form.estimatedAnnualCosts) || 0

  if (propertyValue <= 0) {
    return []
  }

  const annualRentalIncome = property.monthlyRent * 12
  const grossRentalReturn = annualRentalIncome - annualCosts
  const rentalYield = (grossRentalReturn / propertyValue) * 100
  const propertyAppreciation = propertyValue * (appreciationRate / 100)
  const totalAnnualReturn = grossRentalReturn + propertyAppreciation
  const totalReturnPercent = (totalAnnualReturn / propertyValue) * 100

  return [
    {
      label: "Annual rental income",
      value: `£${annualRentalIncome.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`,
    },
    {
      label: "Less: Annual costs",
      value: `£${annualCosts.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`,
    },
    {
      label: "Gross rental return",
      value: `£${grossRentalReturn.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`,
      highlighted: true,
    },
    {
      label: "Rental yield",
      value: `${rentalYield.toFixed(2)}`,
      suffix: "%",
      highlighted: true,
    },
    {
      label: "Annual property appreciation",
      value: `£${propertyAppreciation.toLocaleString("en-GB", { maximumFractionDigits: 0 })} (@ ${appreciationRate.toFixed(2)}%)`,
    },
    {
      label: "Total annual return",
      value: `£${totalAnnualReturn.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`,
      highlighted: true,
    },
    {
      label: "Total return %",
      value: `${totalReturnPercent.toFixed(2)}`,
      suffix: "%",
      highlighted: true,
    },
  ]
}

type PropertyFinancialsPanelProps = {
  property: PropertyRecord
  canManage: boolean
  onPropertyUpdate: (updated: PropertyRecord) => void
}

export default function PropertyFinancialsPanel({
  property,
  canManage,
  onPropertyUpdate,
}: PropertyFinancialsPanelProps) {
  const [form, setForm] = useState<FinancialsFormState>(() => toFormState(property.financials))
  const [isEditMode, setIsEditMode] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const metrics = calculateROI(property, form)
  const isComplete = form.propertyValue && form.estimatedAnnualCosts !== undefined

  function updateField(name: keyof FinancialsFormState, value: string) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  function handleEdit() {
    setForm(toFormState(property.financials))
    setError(null)
    setMessage(null)
    setIsEditMode(true)
  }

  function handleCancel() {
    setForm(toFormState(property.financials))
    setError(null)
    setMessage(null)
    setIsEditMode(false)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    const propertyValue = Number(form.propertyValue)
    const appreciationRate = Number(form.annualAppreciationRate)
    const costs = Number(form.estimatedAnnualCosts)

    if (!Number.isFinite(propertyValue) || propertyValue < 0) {
      setError("Property value must be a valid positive number.")
      return
    }

    if (!Number.isFinite(appreciationRate) || appreciationRate < -100 || appreciationRate > 100) {
      setError("Annual appreciation rate must be between -100 and 100%.")
      return
    }

    if (!Number.isFinite(costs) || costs < 0) {
      setError("Annual costs must be a valid positive number.")
      return
    }

    startTransition(async () => {
      const response = await fetch(`/api/properties/${property.id}/financials`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyValue,
          annualAppreciationRate: appreciationRate,
          estimatedAnnualCosts: costs,
        }),
      })

      const payload = (await response.json()) as { property?: PropertyRecord; error?: string }

      if (!response.ok || !payload.property) {
        setError(payload.error || "Unable to save financials.")
        return
      }

      onPropertyUpdate(payload.property)
      setIsEditMode(false)
      setMessage("Financials saved.")
    })
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Return on Investment</h3>
          <p className="mt-1 text-sm text-slate-500">
            Track property value and calculate rental yield plus appreciation returns.
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
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">
              Property value (£)
              <input
                type="number"
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                value={form.propertyValue}
                onChange={(e) => updateField("propertyValue", e.target.value)}
                placeholder="250000"
                min="0"
                step="1000"
                required
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Annual appreciation rate (%)
              <input
                type="number"
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                value={form.annualAppreciationRate}
                onChange={(e) => updateField("annualAppreciationRate", e.target.value)}
                placeholder="3"
                min="-100"
                max="100"
                step="0.1"
                required
              />
              <div className="mt-1 text-xs text-slate-500">Typical UK growth: 2–4%</div>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Estimated annual costs (£)
              <input
                type="number"
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                value={form.estimatedAnnualCosts}
                onChange={(e) => updateField("estimatedAnnualCosts", e.target.value)}
                placeholder="2400"
                min="0"
                step="100"
                required
              />
              <div className="mt-1 text-xs text-slate-500">Maintenance, tax, insurance</div>
            </label>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={isPending}
            >
              {isPending ? "Saving…" : "Save financials"}
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
          {!isComplete ? (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span className="text-base">ℹ</span>
              <span>Add property value and costs to see ROI calculations.</span>
            </div>
          ) : metrics.length > 0 ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {metrics.map((metric, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl p-4 ${
                      metric.highlighted
                        ? "border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100"
                        : "border border-dashed border-slate-300 bg-slate-50"
                    }`}
                  >
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{metric.label}</div>
                    <div className={`mt-2 text-lg font-bold ${metric.highlighted ? "text-slate-900" : "text-slate-700"}`}>
                      {metric.value}
                      {metric.suffix && <span className="ml-1 text-sm font-semibold">{metric.suffix}</span>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border-l-4 border-slate-900 bg-slate-50 p-4 text-sm text-slate-700">
                <div className="font-semibold text-slate-900">How this works:</div>
                <ul className="mt-2 space-y-1 text-xs">
                  <li>• <span className="font-medium">Rental yield</span> = (Monthly rent × 12 − Costs) ÷ Property value</li>
                  <li>• <span className="font-medium">Appreciation</span> = Property value × Annual growth rate</li>
                  <li>• <span className="font-medium">Total return</span> = Rental income − Costs + Appreciation</li>
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
