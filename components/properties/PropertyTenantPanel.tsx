"use client"

import { useState } from "react"

import TenantCommunicationThread from "@/components/forms/TenantCommunicationThread"
import type { TenancyApplicationRecord } from "@/lib/auth"

type PropertyTenantPanelProps = {
  activeTenancies: TenancyApplicationRecord[]
}

export default function PropertyTenantPanel({ activeTenancies }: PropertyTenantPanelProps) {
  const [selectedApplicationId, setSelectedApplicationId] = useState(activeTenancies[0]?.id ?? "")
  const selectedTenancy = activeTenancies.find((application) => application.id === selectedApplicationId) ?? activeTenancies[0]

  if (!selectedTenancy) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
        No active tenant is attached to this property yet.
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Tenant</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Current tenant details</h2>
          <p className="mt-2 text-sm text-slate-600">Review the active tenancy and recent recorded communication for this property.</p>
        </div>
        <label className="block text-sm font-medium text-slate-700">
          Select tenant
          <select
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 md:w-72"
            value={selectedTenancy.id}
            onChange={(event) => setSelectedApplicationId(event.target.value)}
          >
            {activeTenancies.map((application) => (
              <option key={application.id} value={application.id}>{application.applicantName}</option>
            ))}
          </select>
        </label>
      </div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tenant name</dt><dd className="mt-2 font-semibold text-slate-900">{selectedTenancy.applicantName}</dd></div>
        <div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Email</dt><dd className="mt-2 break-words font-semibold text-slate-900">{selectedTenancy.applicantEmail}</dd></div>
        <div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Monthly rent</dt><dd className="mt-2 font-semibold text-slate-900">£{selectedTenancy.monthlyRent.toLocaleString("en-GB")}</dd></div>
        <div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Application received</dt><dd className="mt-2 font-semibold text-slate-900">{new Date(selectedTenancy.submittedAt).toLocaleDateString("en-GB")}</dd></div>
        <div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">First inspection</dt><dd className="mt-2 font-semibold text-slate-900">{selectedTenancy.postMoveInManagement.firstInspectionDate ? new Date(selectedTenancy.postMoveInManagement.firstInspectionDate).toLocaleDateString("en-GB") : "Not recorded"}</dd></div>
      </dl>

      <div className="mt-6">
        <TenantCommunicationThread
          entries={selectedTenancy.postMoveInManagement.communicationEntries.slice(0, 3)}
          title="Recent conversation"
          description="Latest recorded contact with this tenant across calls, messages, and notes."
          emptyMessage="No communication has been recorded yet."
        />
      </div>
    </section>
  )
}