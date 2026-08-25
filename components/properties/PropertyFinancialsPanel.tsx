"use client"

import { useState, useTransition } from "react"

import type { PropertyFinancials, PropertyRecord } from "@/lib/auth"

type FinancialsFormState = {
  propertyValue: string
  annualAppreciationRate: string
  estimatedAnnualCosts: string
  purchaseCost: string
  mortgageLender: string
  mortgageBalance: string
  mortgageInterestRate: string
  mortgageMonthlyPayment: string
  mortgageRenewalDate: string
  depositAmount: string
  depositProtectionScheme: string
  depositReference: string
  paymentFrequency: "weekly" | "monthly" | "quarterly"
  paymentDueDay: string
  latePaymentPolicy: string
}

function toFormState(financials: PropertyFinancials | undefined): FinancialsFormState {
  return {
    propertyValue: String(financials?.propertyValue ?? ""),
    annualAppreciationRate: String(financials?.annualAppreciationRate ?? "3"),
    estimatedAnnualCosts: String(financials?.estimatedAnnualCosts ?? ""),
    purchaseCost: String(financials?.purchaseCost ?? ""),
    mortgageLender: financials?.mortgageLender ?? "",
    mortgageBalance: String(financials?.mortgageBalance ?? ""),
    mortgageInterestRate: String(financials?.mortgageInterestRate ?? ""),
    mortgageMonthlyPayment: String(financials?.mortgageMonthlyPayment ?? ""),
    mortgageRenewalDate: financials?.mortgageRenewalDate ?? "",
    depositAmount: String(financials?.depositAmount ?? ""),
    depositProtectionScheme: financials?.depositProtectionScheme ?? "",
    depositReference: financials?.depositReference ?? "",
    paymentFrequency: financials?.paymentFrequency ?? "monthly",
    paymentDueDay: String(financials?.paymentDueDay ?? "1"),
    latePaymentPolicy: financials?.latePaymentPolicy ?? "",
  }
}

function toOptionalNumber(value: string) {
  return value.trim() ? Number(value) : undefined
}

function getMortgageRenewalStatus(renewalDate: string | undefined) {
  if (!renewalDate) return null
  const renewal = new Date(`${renewalDate}T00:00:00`)
  if (Number.isNaN(renewal.getTime())) return null

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const daysUntilRenewal = Math.floor((renewal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (daysUntilRenewal < 0) return "overdue"
  if (daysUntilRenewal <= 90) return "soon"
  return "ok"
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
  const mortgageRenewalStatus = getMortgageRenewalStatus(property.financials?.mortgageRenewalDate)

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
    const purchaseCost = toOptionalNumber(form.purchaseCost)
    const mortgageBalance = toOptionalNumber(form.mortgageBalance)
    const mortgageInterestRate = toOptionalNumber(form.mortgageInterestRate)
    const mortgageMonthlyPayment = toOptionalNumber(form.mortgageMonthlyPayment)
    const depositAmount = toOptionalNumber(form.depositAmount)
    const paymentDueDay = toOptionalNumber(form.paymentDueDay)

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

    if ([purchaseCost, mortgageBalance, mortgageInterestRate, mortgageMonthlyPayment, depositAmount].some((value) => value !== undefined && (!Number.isFinite(value) || value < 0))) {
      setError("Purchase and mortgage amounts must be valid non-negative numbers.")
      return
    }

    if (paymentDueDay !== undefined && (!Number.isInteger(paymentDueDay) || paymentDueDay < 1 || paymentDueDay > 31)) {
      setError("Payment due date must be a day between 1 and 31.")
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
          purchaseCost,
          mortgageLender: form.mortgageLender.trim() || undefined,
          mortgageBalance,
          mortgageInterestRate,
          mortgageMonthlyPayment,
          mortgageRenewalDate: form.mortgageRenewalDate || undefined,
          depositAmount,
          depositProtectionScheme: form.depositProtectionScheme.trim() || undefined,
          depositReference: form.depositReference.trim() || undefined,
          paymentFrequency: form.paymentFrequency,
          paymentDueDay,
          latePaymentPolicy: form.latePaymentPolicy.trim() || undefined,
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
          <h3 className="text-base font-semibold text-slate-900">Financials</h3>
          <p className="mt-1 text-sm text-slate-500">
            Track purchase, value growth, mortgage details, and rental return.
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
              Annual value increment (%)
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

          <div className="border-t border-slate-200 pt-4">
            <h4 className="text-sm font-semibold text-slate-900">Purchase and mortgage</h4>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">
                Purchase cost (£)
                <input type="number" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900" value={form.purchaseCost} onChange={(e) => updateField("purchaseCost", e.target.value)} min="0" step="1000" placeholder="200000" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Mortgage lender
                <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900" value={form.mortgageLender} onChange={(e) => updateField("mortgageLender", e.target.value)} placeholder="e.g. Nationwide" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Mortgage balance (£)
                <input type="number" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900" value={form.mortgageBalance} onChange={(e) => updateField("mortgageBalance", e.target.value)} min="0" step="1000" placeholder="150000" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Interest rate (%)
                <input type="number" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900" value={form.mortgageInterestRate} onChange={(e) => updateField("mortgageInterestRate", e.target.value)} min="0" step="0.01" placeholder="4.25" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Monthly payment (£)
                <input type="number" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900" value={form.mortgageMonthlyPayment} onChange={(e) => updateField("mortgageMonthlyPayment", e.target.value)} min="0" step="1" placeholder="850" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Mortgage renewal date
                <input type="date" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900" value={form.mortgageRenewalDate} onChange={(e) => updateField("mortgageRenewalDate", e.target.value)} />
              </label>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <h4 className="text-sm font-semibold text-slate-900">Financial Information</h4>
            <p className="mt-1 text-xs text-slate-500">Monthly rent is managed in the property details. Record the tenancy payment and deposit terms here.</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">
                Deposit amount (£)
                <input type="number" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900" value={form.depositAmount} onChange={(e) => updateField("depositAmount", e.target.value)} min="0" step="1" placeholder="545" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Deposit protection scheme
                <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900" value={form.depositProtectionScheme} onChange={(e) => updateField("depositProtectionScheme", e.target.value)} placeholder="e.g. Safe Deposits Scotland" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Deposit reference
                <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900" value={form.depositReference} onChange={(e) => updateField("depositReference", e.target.value)} placeholder="e.g. DAN1064599" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Payment frequency
                <select className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900" value={form.paymentFrequency} onChange={(e) => updateField("paymentFrequency", e.target.value)}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Payment due date
                <input type="number" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900" value={form.paymentDueDay} onChange={(e) => updateField("paymentDueDay", e.target.value)} min="1" max="31" step="1" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Late payment policy
                <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900" value={form.latePaymentPolicy} onChange={(e) => updateField("latePaymentPolicy", e.target.value)} placeholder="e.g. N/A" />
              </label>
            </div>
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
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-sm font-semibold text-slate-900">Financial Information</h4>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div><dt className="text-xs font-medium text-slate-500">Monthly rent</dt><dd className="mt-1 font-semibold text-slate-900">£{property.monthlyRent.toLocaleString("en-GB")}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">Deposit amount</dt><dd className="mt-1 font-semibold text-slate-900">{property.financials?.depositAmount !== undefined ? `£${property.financials.depositAmount.toLocaleString("en-GB")}` : "Not recorded"}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">Deposit protection scheme</dt><dd className="mt-1 font-semibold text-slate-900">{property.financials?.depositProtectionScheme ?? "Not recorded"}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">Deposit reference</dt><dd className="mt-1 font-semibold text-slate-900">{property.financials?.depositReference ?? "Not recorded"}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">Payment frequency</dt><dd className="mt-1 font-semibold capitalize text-slate-900">{property.financials?.paymentFrequency ?? "Not recorded"}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">Payment due date</dt><dd className="mt-1 font-semibold text-slate-900">{property.financials?.paymentDueDay ? `${property.financials.paymentDueDay}${property.financials.paymentDueDay === 1 ? "st" : property.financials.paymentDueDay === 2 ? "nd" : property.financials.paymentDueDay === 3 ? "rd" : "th"}` : "Not recorded"}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">Late payment policy</dt><dd className="mt-1 font-semibold text-slate-900">{property.financials?.latePaymentPolicy ?? "Not recorded"}</dd></div>
            </dl>
          </div>
          {!isComplete ? (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span className="text-base">ℹ</span>
              <span>Add property value and costs to see ROI calculations.</span>
            </div>
          ) : metrics.length > 0 ? (
            <div className="space-y-3">
              {property.financials?.purchaseCost || property.financials?.mortgageBalance || property.financials?.mortgageRenewalDate ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {property.financials.purchaseCost ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm"><div className="text-xs font-medium uppercase tracking-wide text-slate-500">Purchase cost</div><div className="mt-2 text-lg font-bold text-slate-900">£{property.financials.purchaseCost.toLocaleString("en-GB")}</div></div> : null}
                  {property.financials.mortgageBalance !== undefined ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm"><div className="text-xs font-medium uppercase tracking-wide text-slate-500">Mortgage balance</div><div className="mt-2 text-lg font-bold text-slate-900">£{property.financials.mortgageBalance.toLocaleString("en-GB")}</div></div> : null}
                  {property.financials.mortgageRenewalDate ? <div className={`rounded-xl border p-4 text-sm ${mortgageRenewalStatus === "overdue" ? "border-red-300 bg-red-100" : mortgageRenewalStatus === "soon" ? "border-amber-300 bg-amber-100" : "border-green-300 bg-green-100"}`}><div className="text-xs font-medium uppercase tracking-wide text-slate-500">Mortgage renewal</div><div className="mt-2 font-bold text-slate-900">{new Date(`${property.financials.mortgageRenewalDate}T00:00:00`).toLocaleDateString("en-GB")}</div><div className="mt-1 text-xs font-semibold text-slate-700">{mortgageRenewalStatus === "overdue" ? "Overdue" : mortgageRenewalStatus === "soon" ? "Due within 90 days" : "More than 90 days"}</div></div> : null}
                </div>
              ) : null}
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
