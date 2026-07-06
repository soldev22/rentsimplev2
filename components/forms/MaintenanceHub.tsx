"use client"

import { useMemo, useState, useTransition } from "react"

import type {
  BuilderProfileDefaults,
  MaintenanceIssueCategory,
  MaintenanceIssueRecord,
  MaintenanceIssueStatus,
  MaintenancePriority,
  UserRole,
} from "@/lib/auth"

type ReportableProperty = {
  id: string
  address: string
}

type MaintenanceHubProps = {
  initialIssues: MaintenanceIssueRecord[]
  reportableProperties: ReportableProperty[]
  role: UserRole
  currentUser: {
    id: string
    email: string
    displayName: string
    builderProfile?: BuilderProfileDefaults
  }
}

type FeedbackState = {
  type: "success" | "error"
  message: string
} | null

type TenantIssueFormState = {
  propertyId: string
  title: string
  description: string
  category: MaintenanceIssueCategory
  priority: MaintenancePriority
  responseDueAt: string
  resolutionDueAt: string
}

const categoryOptions: Array<{ value: MaintenanceIssueCategory; label: string }> = [
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "heating", label: "Heating" },
  { value: "security", label: "Security" },
  { value: "appliances", label: "Appliances" },
  { value: "damp_mould", label: "Damp or mould" },
  { value: "general", label: "General maintenance" },
]

const priorityOptions: Array<{ value: MaintenancePriority; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
]

const statusOptions: Array<{ value: MaintenanceIssueStatus; label: string }> = [
  { value: "reported", label: "Reported" },
  { value: "triaged", label: "Triaged" },
  { value: "bidding_open", label: "Bidding open" },
  { value: "builder_selected", label: "Builder selected" },
  { value: "accreditation_pending", label: "Accreditation pending" },
  { value: "ready_to_start", label: "Ready to start" },
  { value: "in_progress", label: "In progress" },
  { value: "awaiting_signoff", label: "Awaiting sign-off" },
  { value: "completed", label: "Completed" },
  { value: "closed", label: "Closed" },
]

function createEmptyIssueForm(reportableProperties: ReportableProperty[]): TenantIssueFormState {
  return {
    propertyId: reportableProperties[0]?.id ?? "",
    title: "",
    description: "",
    category: "general",
    priority: "medium",
    responseDueAt: "",
    resolutionDueAt: "",
  }
}

function getStatusTone(status: MaintenanceIssueStatus) {
  switch (status) {
    case "completed":
    case "closed":
      return "bg-emerald-100 text-emerald-900"
    case "reported":
      return "bg-rose-100 text-rose-900"
    default:
      return "bg-amber-100 text-amber-900"
  }
}

function getPriorityTone(priority: MaintenancePriority) {
  switch (priority) {
    case "urgent":
      return "bg-rose-100 text-rose-900"
    case "high":
      return "bg-orange-100 text-orange-900"
    case "low":
      return "bg-slate-100 text-slate-700"
    default:
      return "bg-sky-100 text-sky-900"
  }
}

export default function MaintenanceHub({ initialIssues, reportableProperties, role, currentUser }: MaintenanceHubProps) {
  const [issues, setIssues] = useState(initialIssues)
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [issueForm, setIssueForm] = useState<TenantIssueFormState>(() => createEmptyIssueForm(reportableProperties))
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(initialIssues[0]?.id ?? null)
  const [isPending, startTransition] = useTransition()

  const sortedIssues = useMemo(
    () => [...issues].sort((left, right) => Date.parse(right.reportedAt) - Date.parse(left.reportedAt)),
    [issues],
  )

  const builderProfileChecks = useMemo(() => {
    const profile = currentUser.builderProfile

    return {
      hasCompanyName: Boolean(profile?.companyName?.trim()),
      hasServiceAreas: Boolean(profile?.serviceAreas?.trim()),
      hasInsuranceDate: Boolean(profile?.insuranceExpiryDate?.trim()),
      hasContactMethods: Boolean(profile?.preferredContactMethods?.length),
      hasTrade: Boolean(profile?.primaryTrade),
    }
  }, [currentUser.builderProfile])

  const builderProfileReadyCount = Object.values(builderProfileChecks).filter(Boolean).length
  const builderOpenForBidCount = sortedIssues.filter((issue) => issue.status === "bidding_open").length
  const builderSubmittedBidCount = sortedIssues.filter((issue) => issue.bids.some((bid) => bid.builderId === currentUser.id)).length
  const builderAwardedCount = sortedIssues.filter((issue) => issue.selectedBuilderId === currentUser.id).length

  function updateIssue(issueId: string, updater: (issue: MaintenanceIssueRecord) => MaintenanceIssueRecord) {
    setIssues((current) => current.map((issue) => (issue.id === issueId ? updater(issue) : issue)))
  }

  function saveStaffIssue(issue: MaintenanceIssueRecord) {
    setFeedback(null)

    startTransition(async () => {
      try {
        const response = await fetch(`/api/maintenance/${issue.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            priority: issue.priority,
            status: issue.status,
            responseDueAt: issue.responseDueAt,
            resolutionDueAt: issue.resolutionDueAt,
            biddingClosesAt: issue.biddingClosesAt,
            selectedBuilderId: issue.selectedBuilderId,
            selectedBuilderName: issue.selectedBuilderName,
            selectedBuilderEmail: issue.selectedBuilderEmail,
            accreditationChecklist: issue.accreditationChecklist,
          }),
        })

        const payload = (await response.json()) as { issue?: MaintenanceIssueRecord; error?: string }

        if (!response.ok || !payload.issue) {
          throw new Error(payload.error || "Unable to save maintenance issue.")
        }

        setIssues((current) => current.map((candidate) => (candidate.id === payload.issue?.id ? payload.issue : candidate)))
        setFeedback({ type: "success", message: "Maintenance issue updated." })
      } catch (error) {
        setFeedback({ type: "error", message: error instanceof Error ? error.message : "Unable to save maintenance issue." })
      }
    })
  }

  function submitTenantIssue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)

    startTransition(async () => {
      try {
        const response = await fetch("/api/maintenance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(issueForm),
        })

        const payload = (await response.json()) as { issue?: MaintenanceIssueRecord; error?: string }

        if (!response.ok || !payload.issue) {
          throw new Error(payload.error || "Unable to report fault.")
        }

        setIssues((current) => [payload.issue as MaintenanceIssueRecord, ...current])
        setExpandedIssueId(payload.issue.id)
        setIssueForm(createEmptyIssueForm(reportableProperties))
        setFeedback({ type: "success", message: "Fault reported. The maintenance case is now in the workflow." })
      } catch (error) {
        setFeedback({ type: "error", message: error instanceof Error ? error.message : "Unable to report fault." })
      }
    })
  }

  function submitBuilderBid(issueId: string, formData: FormData) {
    setFeedback(null)

    startTransition(async () => {
      try {
        const response = await fetch(`/api/maintenance/${issueId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: Number(formData.get("amount") ?? 0),
            availabilityDate: String(formData.get("availabilityDate") ?? ""),
            estimatedDurationDays: Number(formData.get("estimatedDurationDays") ?? 1),
            notes: String(formData.get("notes") ?? ""),
          }),
        })

        const payload = (await response.json()) as { issue?: MaintenanceIssueRecord; error?: string }

        if (!response.ok || !payload.issue) {
          throw new Error(payload.error || "Unable to submit builder bid.")
        }

        setIssues((current) => current.map((candidate) => (candidate.id === payload.issue?.id ? payload.issue : candidate)))
        setFeedback({ type: "success", message: "Builder bid submitted." })
      } catch (error) {
        setFeedback({ type: "error", message: error instanceof Error ? error.message : "Unable to submit builder bid." })
      }
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Maintenance</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Faults, bids, and accreditation</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Track maintenance issues from tenant report through builder bidding, accreditation checks, and delivery dates.
        </p>
      </section>

      {role === "builder" ? (
        <section className="grid gap-4 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Open for bid</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{builderOpenForBidCount}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Your bids</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{builderSubmittedBidCount}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Awarded jobs</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{builderAwardedCount}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Profile readiness</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{builderProfileReadyCount}/5</div>
          </div>
        </section>
      ) : null}

      {role === "builder" && builderProfileReadyCount < 5 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">Builder readiness</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Complete your builder profile</h2>
          <p className="mt-2 text-sm text-slate-700">
            Add company, coverage, contact, trade, and insurance details in Settings so the operations team can review bids and accreditation faster.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              [builderProfileChecks.hasCompanyName, "Company"],
              [builderProfileChecks.hasTrade, "Trade"],
              [builderProfileChecks.hasServiceAreas, "Coverage"],
              [builderProfileChecks.hasContactMethods, "Contact"],
              [builderProfileChecks.hasInsuranceDate, "Insurance"],
            ].map(([complete, label]) => (
              <div key={String(label)} className={`rounded-xl border px-4 py-3 text-sm ${complete ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-white text-slate-700"}`}>
                {label}: {complete ? "Ready" : "Missing"}
              </div>
            ))}
          </div>
          <a href="/dashboard/settings" className="mt-5 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Open builder settings
          </a>
        </section>
      ) : null}

      {feedback ? (
        <div className={`rounded-xl border px-4 py-3 text-sm ${feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"}`}>
          {feedback.message}
        </div>
      ) : null}

      {role === "tenant" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Report a fault</h2>
          {reportableProperties.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              No active tenancy properties are linked to this account yet.
            </div>
          ) : (
            <form className="mt-6 grid gap-4 lg:grid-cols-2" onSubmit={submitTenantIssue}>
              <label className="text-sm font-medium text-slate-700 lg:col-span-2">
                Property
                <select className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" value={issueForm.propertyId} onChange={(event) => setIssueForm((current) => ({ ...current, propertyId: event.target.value }))} aria-label="Select property" title="Select a property for this maintenance issue">
                  {reportableProperties.map((property) => (
                    <option key={property.id} value={property.id}>{property.address}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700 lg:col-span-2">
                Fault title
                <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" value={issueForm.title} onChange={(event) => setIssueForm((current) => ({ ...current, title: event.target.value }))} required />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Category
                <select className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" value={issueForm.category} onChange={(event) => setIssueForm((current) => ({ ...current, category: event.target.value as MaintenanceIssueCategory }))} aria-label="Select category" title="Select maintenance issue category">
                  {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Priority
                <select className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" value={issueForm.priority} onChange={(event) => setIssueForm((current) => ({ ...current, priority: event.target.value as MaintenancePriority }))}>
                  {priorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Response target date
                <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" type="date" value={issueForm.responseDueAt} onChange={(event) => setIssueForm((current) => ({ ...current, responseDueAt: event.target.value }))} />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Resolution target date
                <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" type="date" value={issueForm.resolutionDueAt} onChange={(event) => setIssueForm((current) => ({ ...current, resolutionDueAt: event.target.value }))} />
              </label>
              <label className="text-sm font-medium text-slate-700 lg:col-span-2">
                Fault description
                <textarea className="mt-2 min-h-32 w-full rounded-md border border-slate-300 px-3 py-2" value={issueForm.description} onChange={(event) => setIssueForm((current) => ({ ...current, description: event.target.value }))} required />
              </label>
              <div className="lg:col-span-2 flex justify-end">
                <button type="submit" disabled={isPending} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isPending ? "Submitting..." : "Report fault"}</button>
              </div>
            </form>
          )}
        </section>
      ) : null}

      {sortedIssues.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600 shadow-sm">
          No maintenance issues are in scope for this account yet.
        </section>
      ) : (
        sortedIssues.map((issue) => {
          const isExpanded = expandedIssueId === issue.id
          const selectedBid = issue.selectedBuilderId ? issue.bids.find((bid) => bid.builderId === issue.selectedBuilderId) : undefined
          const myBid = issue.bids.find((bid) => bid.builderId === currentUser.id)

          return (
            <section key={issue.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">{issue.propertyAddress}</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">{issue.title}</h2>
                  <p className="mt-2 text-sm text-slate-600">Reported by {issue.tenantName} on {new Date(issue.reportedAt).toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getStatusTone(issue.status)}`}>{issue.status.replaceAll("_", " ")}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getPriorityTone(issue.priority)}`}>{issue.priority}</span>
                  <button type="button" className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => setExpandedIssueId((current) => current === issue.id ? null : issue.id)}>
                    {isExpanded ? "Collapse" : "Expand"}
                  </button>
                </div>
              </div>

              {isExpanded ? (
                <div className="mt-6 space-y-6">
                  <div className="grid gap-4 lg:grid-cols-3">
                    <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Description</div>
                      <p className="mt-2 whitespace-pre-wrap">{issue.description}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">SLA targets</div>
                      <div className="mt-2">Response: {issue.responseDueAt || "Not set"}</div>
                      <div className="mt-1">Resolution: {issue.resolutionDueAt || "Not set"}</div>
                      <div className="mt-1">Bidding closes: {issue.biddingClosesAt || "Not set"}</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Selected builder</div>
                      <div className="mt-2 font-semibold text-slate-900">{issue.selectedBuilderName || "Not selected"}</div>
                      <div className="mt-1">{issue.selectedBuilderEmail || ""}</div>
                      {selectedBid ? <div className="mt-2">Accepted bid: £{selectedBid.amount.toLocaleString()}</div> : null}
                    </div>
                  </div>

                  {role === "builder" ? (
                    <form key={`${issue.id}-${myBid?.updatedAt ?? "new"}`} className="grid gap-4 rounded-xl border border-slate-200 p-4 lg:grid-cols-2" onSubmit={(event) => { event.preventDefault(); submitBuilderBid(issue.id, new FormData(event.currentTarget)); }}>
                      <h3 className="lg:col-span-2 text-lg font-semibold text-slate-900">Submit bid</h3>
                      <div className="lg:col-span-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                        <div className="font-semibold text-slate-900">Your builder status</div>
                        <div className="mt-2">{myBid ? `Current bid: £${myBid.amount.toLocaleString()} · ${myBid.status}` : "No bid submitted on this issue yet."}</div>
                        <div className="mt-1">{issue.selectedBuilderId === currentUser.id ? "You are currently the selected builder on this issue." : issue.status === "bidding_open" ? "Bidding is open for this issue." : "This issue is not currently open for new bids."}</div>
                      </div>
                      <label className="text-sm font-medium text-slate-700">Bid amount<input name="amount" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" type="number" min="0" defaultValue={myBid?.amount ?? currentUser.builderProfile?.hourlyRateGuidance ?? 0} /></label>
                      <label className="text-sm font-medium text-slate-700">Availability date<input name="availabilityDate" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" type="date" defaultValue={myBid?.availabilityDate ?? ""} /></label>
                      <label className="text-sm font-medium text-slate-700">Estimated duration (days)<input name="estimatedDurationDays" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" type="number" min="1" defaultValue={myBid?.estimatedDurationDays ?? 1} /></label>
                      <label className="text-sm font-medium text-slate-700 lg:col-span-2">Notes<textarea name="notes" className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2" defaultValue={myBid?.notes ?? currentUser.builderProfile?.availabilityNotes ?? ""} /></label>
                      <div className="lg:col-span-2 flex justify-end"><button type="submit" disabled={isPending || issue.status !== "bidding_open"} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{issue.status === "bidding_open" ? (isPending ? "Submitting..." : "Submit bid") : "Bidding closed"}</button></div>
                    </form>
                  ) : null}

                  {role === "admin" || role === "agent" || role === "landlord" ? (
                    <div className="grid gap-6 xl:grid-cols-2">
                      <section className="rounded-xl border border-slate-200 p-4">
                        <h3 className="text-lg font-semibold text-slate-900">Triage and delivery</h3>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <label className="text-sm font-medium text-slate-700">Priority<select className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" value={issue.priority} onChange={(event) => updateIssue(issue.id, (current) => ({ ...current, priority: event.target.value as MaintenancePriority }))}>{priorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                          <label className="text-sm font-medium text-slate-700">Status<select className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" value={issue.status} onChange={(event) => updateIssue(issue.id, (current) => ({ ...current, status: event.target.value as MaintenanceIssueStatus }))}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                          <label className="text-sm font-medium text-slate-700">Response due<input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" type="date" value={issue.responseDueAt ?? ""} onChange={(event) => updateIssue(issue.id, (current) => ({ ...current, responseDueAt: event.target.value || undefined }))} /></label>
                          <label className="text-sm font-medium text-slate-700">Resolution due<input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" type="date" value={issue.resolutionDueAt ?? ""} onChange={(event) => updateIssue(issue.id, (current) => ({ ...current, resolutionDueAt: event.target.value || undefined }))} /></label>
                          <label className="text-sm font-medium text-slate-700">Bidding closes<input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" type="date" value={issue.biddingClosesAt ?? ""} onChange={(event) => updateIssue(issue.id, (current) => ({ ...current, biddingClosesAt: event.target.value || undefined }))} /></label>
                          <label className="text-sm font-medium text-slate-700">
                            Select builder
                            <select
                              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                              value={issue.selectedBuilderId ?? ""}
                              onChange={(event) => updateIssue(issue.id, (current) => ({ ...current, selectedBuilderId: event.target.value || undefined }))}
                              aria-label="Select builder for this maintenance issue"
                              title="Select a builder to assign this maintenance issue to"
                            >
                              <option value="">Unassigned</option>
                              {issue.bids.map((bid) => <option key={bid.id} value={bid.builderId}>{bid.builderName} · £{bid.amount.toLocaleString()}</option>)}
                            </select>
                          </label>
                        </div>
                      </section>

                      <section className="rounded-xl border border-slate-200 p-4">
                        <h3 className="text-lg font-semibold text-slate-900">Accreditation checklist</h3>
                        <div className="mt-4 grid gap-3">
                          {[
                            ["insuranceChecked", "Insurance checked"],
                            ["gasSafeChecked", "Gas Safe checked"],
                            ["electricalCertificationChecked", "Electrical certification checked"],
                            ["dbsChecked", "DBS checked"],
                            ["methodStatementReceived", "Method statement received"],
                          ].map(([key, label]) => (
                            <label key={key} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                              <input type="checkbox" checked={Boolean(issue.accreditationChecklist[key as keyof typeof issue.accreditationChecklist])} onChange={(event) => updateIssue(issue.id, (current) => ({ ...current, accreditationChecklist: { ...current.accreditationChecklist, [key]: event.target.checked } }))} />
                              <span>{label}</span>
                            </label>
                          ))}
                          <label className="text-sm font-medium text-slate-700">Target start date<input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" type="date" value={issue.accreditationChecklist.targetStartDate} onChange={(event) => updateIssue(issue.id, (current) => ({ ...current, accreditationChecklist: { ...current.accreditationChecklist, targetStartDate: event.target.value } }))} /></label>
                          <label className="text-sm font-medium text-slate-700">Target completion date<input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" type="date" value={issue.accreditationChecklist.targetCompletionDate} onChange={(event) => updateIssue(issue.id, (current) => ({ ...current, accreditationChecklist: { ...current.accreditationChecklist, targetCompletionDate: event.target.value } }))} /></label>
                          <label className="text-sm font-medium text-slate-700">Checklist notes<textarea className="mt-2 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2" value={issue.accreditationChecklist.notes} onChange={(event) => updateIssue(issue.id, (current) => ({ ...current, accreditationChecklist: { ...current.accreditationChecklist, notes: event.target.value } }))} /></label>
                        </div>
                      </section>

                      <section className="xl:col-span-2 rounded-xl border border-slate-200 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <h3 className="text-lg font-semibold text-slate-900">Builder bids</h3>
                          <button type="button" disabled={isPending} onClick={() => saveStaffIssue(issue)} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isPending ? "Saving..." : "Save issue"}</button>
                        </div>
                        {issue.bids.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">No builder bids submitted yet.</div> : (
                          <div className="mt-4 space-y-3">
                            {issue.bids.map((bid) => (
                              <article key={bid.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                  <div>
                                    <div className="text-sm font-semibold text-slate-900">{bid.builderName}</div>
                                    <div className="mt-1 text-sm text-slate-600">{bid.builderEmail}</div>
                                    <div className="mt-2 text-sm text-slate-600">Available {bid.availabilityDate || "TBC"} · {bid.estimatedDurationDays} day estimate</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-lg font-semibold text-slate-900">£{bid.amount.toLocaleString()}</div>
                                    <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">{bid.status}</div>
                                  </div>
                                </div>
                                {bid.notes ? <p className="mt-3 text-sm text-slate-600">{bid.notes}</p> : null}
                              </article>
                            ))}
                          </div>
                        )}
                      </section>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          )
        })
      )}
    </div>
  )
}