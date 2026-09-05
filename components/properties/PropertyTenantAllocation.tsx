"use client"

import { useState, useTransition } from "react"

import PropertyTabs from "@/components/properties/PropertyTabs"
import type { PropertyRecord, TenancyApplicationRecord } from "@/lib/auth"

type PropertyTenantAllocationProps = {
  property: PropertyRecord
  initialApplications: TenancyApplicationRecord[]
}

const allocatableStatuses = new Set([
  "approved",
  "approved_with_guarantor",
  "agreement_in_progress",
  "pre_move_in_ready",
  "move_in_ready",
  "deposit_protected",
])

export default function PropertyTenantAllocation({ property: initialProperty, initialApplications }: PropertyTenantAllocationProps) {
  const [property] = useState(initialProperty)
  const [applications, setApplications] = useState(initialApplications)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const activeTenant = applications.find((application) => application.status === "active_tenant")
  const candidates = applications.filter((application) => allocatableStatuses.has(application.status))

  function allocateTenant(application: TenancyApplicationRecord) {
    if (activeTenant) {
      setError("This property already has an allocated tenant.")
      return
    }

    if (!window.confirm(`Allocate ${application.applicantName} to ${property.address}?`)) {
      return
    }

    setError(null)
    startTransition(async () => {
      const response = await fetch(`/api/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentStage: "post_move_in" }),
      })
      const payload = (await response.json()) as { application?: TenancyApplicationRecord; error?: string }

      if (!response.ok || !payload.application) {
        setError(payload.error || "Unable to allocate this tenant.")
        return
      }

      setApplications((current) => current.map((entry) => (entry.id === payload.application?.id ? payload.application : entry)))
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Property</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">{property.address}</h1>
        <p className="mt-2 text-sm text-slate-600">Allocate an approved applicant to this property.</p>
      </div>

      <PropertyTabs propertyId={property.id} />

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Current tenant</h2>
            <p className="mt-2 text-sm text-slate-600">Only one active tenant allocation is allowed for this property.</p>
          </div>
          <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900">{activeTenant ? "Allocated" : "Unallocated"}</div>
        </div>

        {activeTenant ? (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="font-semibold text-emerald-950">{activeTenant.applicantName}</div>
            <div className="mt-1 text-sm text-emerald-900">{activeTenant.applicantEmail}</div>
            <div className="mt-2 text-sm text-emerald-900">Allocated from application submitted {new Date(activeTenant.submittedAt).toLocaleDateString("en-GB")}.</div>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">No tenant is currently allocated.</div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Applicant applications</h2>
        <p className="mt-2 text-sm text-slate-600">Select an approved application to mark the applicant as the active tenant for this property.</p>
        {candidates.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">No eligible applicant applications are linked to this property.</div>
        ) : (
          <div className="mt-5 space-y-3">
            {candidates.map((application) => (
              <div key={application.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <div className="font-semibold text-slate-900">{application.applicantName}</div>
                  <div className="mt-1 text-sm text-slate-600">{application.applicantEmail}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">{application.status.replaceAll("_", " ")}</div>
                </div>
                <button
                  type="button"
                  disabled={isPending || Boolean(activeTenant)}
                  onClick={() => allocateTenant(application)}
                  className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? "Allocating..." : "Allocate tenant"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}