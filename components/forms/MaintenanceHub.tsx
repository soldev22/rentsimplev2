"use client"

import { useEffect, useMemo, useState, useTransition } from "react"

import type {
  BuilderProfileDefaults,
  MaintenanceIssueCategory,
  MaintenanceIssueRecord,
  MaintenanceIssueStatus,
  MaintenanceIssueUpdate,
  MaintenancePriority,
  UserRole,
} from "@/lib/auth"
import {
  MAX_MAINTENANCE_UPDATE_NOTE_LENGTH,
  MAX_MAINTENANCE_UPDATE_PHOTOS,
  MAX_MAINTENANCE_UPDATE_PHOTO_SIZE,
} from "@/lib/types/maintenance"
import { PhotoGallery } from "@/components/maintenance/PhotoGallery"

type ReportableProperty = {
  id: string
  address: string
}

type MaintenanceHubProps = {
  initialIssues: MaintenanceIssueRecord[]
  reportableProperties: ReportableProperty[]
  initialPropertyId?: string
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

function createEmptyIssueForm(reportableProperties: ReportableProperty[], initialPropertyId?: string): TenantIssueFormState {
  const initialProperty = reportableProperties.find((property) => property.id === initialPropertyId)

  return {
    propertyId: initialProperty?.id ?? reportableProperties[0]?.id ?? "",
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

export default function MaintenanceHub({ initialIssues, reportableProperties, initialPropertyId, role, currentUser }: MaintenanceHubProps) {
  const [issues, setIssues] = useState(initialIssues)
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [issueForm, setIssueForm] = useState<TenantIssueFormState>(() => createEmptyIssueForm(reportableProperties, initialPropertyId))
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [capturedPhotos, setCapturedPhotos] = useState<Array<{ blob: Blob; preview: string }>>([])
  const [updatePhotoFiles, setUpdatePhotoFiles] = useState<Record<string, File[]>>({})

  useEffect(() => {
    return () => {
      capturedPhotos.forEach((photo) => URL.revokeObjectURL(photo.preview))
    }
  }, [capturedPhotos])

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

  function submitIssue(event: React.FormEvent<HTMLFormElement>) {
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

        const issue = payload.issue
        setIssues((current) => [issue, ...current])
        setExpandedIssueId(issue.id)
        setIssueForm(createEmptyIssueForm(reportableProperties, initialPropertyId))
        clearCapturedPhotos()
        const failedPhotoCount = capturedPhotos.length > 0
          ? await uploadPhotosForIssue(issue.id, capturedPhotos)
          : 0
        const issueLabel = role === "tenant" ? "repair request" : "maintenance issue"
        setFeedback(failedPhotoCount > 0
          ? { type: "error", message: `Your ${issueLabel} was sent, but ${failedPhotoCount} photo${failedPhotoCount === 1 ? "" : "s"} could not be uploaded. Add them in the report updates below.` }
          : { type: "success", message: `Your ${issueLabel} was sent.` })
      } catch (error) {
        setFeedback({ type: "error", message: error instanceof Error ? error.message : "Unable to report fault." })
      }
    })
  }

  function submitTenantUpdate(issueId: string, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)

    const form = event.currentTarget
    const formData = new FormData(form)
    const note = String(formData.get("note") ?? "").trim()
    const photos = formData.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0)

    if (!note && photos.length === 0) {
      setFeedback({ type: "error", message: "Add a note or at least one photo to post an update." })
      return
    }

    if (photos.length > MAX_MAINTENANCE_UPDATE_PHOTOS || photos.some((photo) =>
      !["image/jpeg", "image/png", "image/webp"].includes(photo.type)
      || photo.size > MAX_MAINTENANCE_UPDATE_PHOTO_SIZE
    )) {
      setFeedback({ type: "error", message: `Choose up to ${MAX_MAINTENANCE_UPDATE_PHOTOS} JPEG, PNG, or WebP photos under 10 MB each.` })
      return
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/maintenance/${issueId}/updates`, {
          method: "POST",
          body: formData,
        })
        const payload = (await response.json()) as { update?: MaintenanceIssueUpdate; error?: string }

        if (!response.ok || !payload.update) {
          throw new Error(payload.error || "Unable to post update.")
        }

        const update = payload.update
        setIssues((current) =>
          current.map((issue) =>
            issue.id === issueId
              ? { ...issue, updates: [...(issue.updates ?? []), update] }
              : issue,
          ),
        )
        form.reset()
        setUpdatePhotoFiles((current) => {
          const next = { ...current }
          delete next[issueId]
          return next
        })
        setFeedback({ type: "success", message: "Your update was posted." })
      } catch (error) {
        setFeedback({ type: "error", message: error instanceof Error ? error.message : "Unable to post update." })
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

  function handlePhotoSelection(files: FileList | null) {
    if (!files || files.length === 0) {
      return
    }

    const selectedFiles = Array.from(files)
    if (selectedFiles.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > MAX_MAINTENANCE_UPDATE_PHOTO_SIZE || file.size === 0)) {
      setFeedback({ type: "error", message: "Choose JPEG, PNG, or WebP photos smaller than 10 MB each." })
      return
    }

    if (capturedPhotos.length + selectedFiles.length > MAX_MAINTENANCE_UPDATE_PHOTOS) {
      setFeedback({ type: "error", message: `Choose up to ${MAX_MAINTENANCE_UPDATE_PHOTOS} photos.` })
      return
    }

    const nextPhotos = selectedFiles.map((file) => ({
      blob: file,
      preview: URL.createObjectURL(file),
    }))

    setCapturedPhotos((current) => [...current, ...nextPhotos])
  }

  function clearCapturedPhotos() {
    setCapturedPhotos((current) => {
      current.forEach((photo) => URL.revokeObjectURL(photo.preview))
      return []
    })
  }

  function removePhoto(index: number) {
    setCapturedPhotos((current) => {
      const updated = current.filter((_, i) => i !== index)
      URL.revokeObjectURL(current[index].preview)
      return updated
    })
  }

  async function uploadPhotosForIssue(issueId: string, photos: Array<{ blob: Blob }>) {
    const results = await Promise.all(photos.map(async ({ blob }, index) => {
      try {
        const formData = new FormData()
        formData.append("file", blob, `photo-${index}.jpg`)

        const response = await fetch(`/api/maintenance/${issueId}/photos`, {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          throw new Error("Failed to upload photo")
        }

        const payload = (await response.json()) as {
          photo?: { id: string; url: string; uploadedAt: string }
        }

        if (!payload.photo) {
          throw new Error("Photo upload response is invalid")
        }

        return payload.photo
      } catch (error) {
        console.error("Photo upload failed:", error)
        return null
      }
    }))
    const uploadedPhotos = results.filter((photo): photo is NonNullable<typeof photo> => photo !== null)
    const failedPhotoCount = results.length - uploadedPhotos.length

    if (uploadedPhotos.length > 0) {
      setIssues((current) =>
        current.map((issue) =>
          issue.id === issueId
            ? { ...issue, photoUrls: [...(issue.photoUrls || []), ...uploadedPhotos] }
            : issue,
        ),
      )
    }

    return failedPhotoCount
  }

  function deletePhoto(issueId: string, photoId: string) {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/maintenance/${issueId}/photos`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoId }),
        })

        if (!response.ok) {
          throw new Error("Failed to delete photo")
        }

        setIssues((current) =>
          current.map((issue) =>
            issue.id === issueId
              ? { ...issue, photoUrls: (issue.photoUrls || []).filter((p) => p.id !== photoId) }
              : issue,
          ),
        )
      } catch {
        setFeedback({ type: "error", message: "Failed to delete photo" })
      }
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Maintenance</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          {role === "tenant" ? "Your home, looked after" : "Faults, bids, and accreditation"}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          {role === "tenant"
            ? "Report a repair with a few details and photos, then keep up with progress here."
            : "Track maintenance issues from tenant report through builder bidding, accreditation checks, and delivery dates."}
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
          <a href="/dashboard/settings" className="brand-button mt-5 inline-flex rounded-md px-4 py-2 text-sm font-semibold">
            Open builder settings
          </a>
        </section>
      ) : null}

      {feedback ? (
        <div className={`rounded-xl border px-4 py-3 text-sm ${feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"}`}>
          {feedback.message}
        </div>
      ) : null}

      {role === "tenant" || role === "admin" || role === "agent" || role === "landlord" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
              {role === "tenant" ? "New repair request" : "New maintenance issue"}
            </p>
            <h2 id="new-issue" className="mt-1 text-xl font-semibold text-slate-900">
              {role === "tenant" ? "What needs fixing?" : "Raise an issue"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">Add a note and photos so the property team can understand what is happening.</p>
          </div>
          {reportableProperties.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              {role === "tenant"
                ? "No active tenancy properties are linked to this account yet."
                : "No properties are available to this account for maintenance reporting."}
            </div>
          ) : (
            <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submitIssue}>
              {reportableProperties.length > 1 ? (
                <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                  {role === "tenant" ? "Which home?" : "Property"}
                  <select className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 py-3" value={issueForm.propertyId} onChange={(event) => setIssueForm((current) => ({ ...current, propertyId: event.target.value }))} aria-label="Select property" title="Select a property for this maintenance issue">
                  {reportableProperties.map((property) => (
                    <option key={property.id} value={property.id}>{property.address}</option>
                  ))}
                  </select>
                </label>
              ) : (
                <p className="text-sm text-slate-700 sm:col-span-2">
                  Property: <span className="font-semibold">{reportableProperties[0].address}</span>
                </p>
              )}
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                Short title
                <input className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-3 py-3" placeholder="For example, leak under the kitchen sink" value={issueForm.title} onChange={(event) => setIssueForm((current) => ({ ...current, title: event.target.value }))} required />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Category
                <select className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 py-3" value={issueForm.category} onChange={(event) => setIssueForm((current) => ({ ...current, category: event.target.value as MaintenanceIssueCategory }))} aria-label="Select category" title="Select maintenance issue category">
                  {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Priority
                <select className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 py-3" value={issueForm.priority} onChange={(event) => setIssueForm((current) => ({ ...current, priority: event.target.value as MaintenancePriority }))}>
                  {priorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                Tell us what happened
                <textarea className="mt-2 min-h-32 w-full rounded-xl border border-slate-300 px-3 py-3" placeholder="Where is the problem? When did you first notice it? Is anything getting worse?" value={issueForm.description} onChange={(event) => setIssueForm((current) => ({ ...current, description: event.target.value }))} required />
              </label>

              <div className="space-y-3 sm:col-span-2">
                <div>
                  <p className="text-sm font-medium text-slate-700">Photos (optional)</p>
                  <p className="mt-1 text-xs text-slate-500">Add up to {MAX_MAINTENANCE_UPDATE_PHOTOS} JPEG, PNG, or WebP images. Each can be up to 10 MB.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="brand-button inline-flex min-h-12 cursor-pointer items-center rounded-xl px-4 py-3 text-sm font-semibold">
                    Choose photos
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="sr-only"
                      onChange={(event) => {
                        handlePhotoSelection(event.target.files)
                        event.currentTarget.value = ""
                      }}
                    />
                  </label>
                  {capturedPhotos.length > 0 && (
                    <span className="text-sm text-slate-600">{capturedPhotos.length} photo{capturedPhotos.length !== 1 ? "s" : ""} ready to upload</span>
                  )}
                </div>

                {/* Photo Preview Thumbnails */}
                {capturedPhotos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {capturedPhotos.map((photo, index) => (
                      <div key={index} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element -- local blob: preview URL, not optimisable by next/image */}
                        <img src={photo.preview} alt={`Captured ${index + 1}`} className="h-20 w-20 rounded-lg object-cover border border-slate-200" />
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute -right-2 -top-2 rounded-full bg-red-600 w-6 h-6 flex items-center justify-center text-white text-xs hover:bg-red-700"
                          title="Remove photo"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="sm:col-span-2">
                <button type="submit" disabled={isPending} className="brand-button min-h-12 w-full rounded-xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">{isPending ? "Submitting..." : role === "tenant" ? "Send repair request" : "Raise maintenance issue"}</button>
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
          const canPostUpdate =
            role === "tenant"
            || role === "admin"
            || role === "agent"
            || role === "landlord"
            || (role === "builder" && issue.selectedBuilderId === currentUser.id)
          const selectedBid = issue.selectedBuilderId ? issue.bids.find((bid) => bid.builderId === issue.selectedBuilderId) : undefined
          const myBid = issue.bids.find((bid) => bid.builderId === currentUser.id)

          return (
            <section key={issue.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">{issue.propertyAddress}</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">{issue.title}</h2>
                  <p className="mt-2 text-sm text-slate-600">Reported by {issue.reportedByName || issue.tenantName} on {new Date(issue.reportedAt).toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getStatusTone(issue.status)}`}>{issue.status.replaceAll("_", " ")}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getPriorityTone(issue.priority)}`}>{issue.priority}</span>
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                    aria-label={isExpanded ? "Hide report details" : canPostUpdate ? "Open report and add update" : "View report details"}
                    onClick={() => setExpandedIssueId((current) => current === issue.id ? null : issue.id)}
                  >
                    <span>{isExpanded ? "Hide details" : canPostUpdate ? "Open report & add update" : "View details"}</span>
                    <span aria-hidden="true" className={`inline-block text-lg leading-none transition-transform ${isExpanded ? "rotate-180" : ""}`}>⌄</span>
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

                  {/* Photo Gallery */}
                  {issue.photoUrls && issue.photoUrls.length > 0 && (
                    <PhotoGallery 
                      photos={issue.photoUrls}
                      onDeletePhoto={(photoId) => deletePhoto(issue.id, photoId)}
                      isLoading={isPending}
                    />
                  )}

                  {role !== "builder" || issue.selectedBuilderId === currentUser.id ? (
                    <section className="rounded-xl border border-slate-200 p-4 sm:p-5">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">Updates</h3>
                        <p className="mt-1 text-sm text-slate-600">Notes and photos are shared with the tenant, property management team, and assigned builder.</p>
                      </div>

                      {issue.updates && issue.updates.length > 0 ? (
                        <ol className="mt-5 space-y-4">
                          {issue.updates.map((update) => (
                            <li key={update.id} className="rounded-xl bg-slate-50 p-4">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <p className="text-sm font-semibold text-slate-900">{update.authorName}</p>
                                <time className="text-xs text-slate-500" dateTime={update.createdAt}>{new Date(update.createdAt).toLocaleString()}</time>
                              </div>
                              {update.note ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{update.note}</p> : null}
                              {update.photos.length > 0 ? (
                                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                  {update.photos.map((photo, index) => (
                                    <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                                      {/* eslint-disable-next-line @next/next/no-img-element -- stored maintenance photos use the existing blob URLs */}
                                      <img src={photo.url} alt={`Update photo ${index + 1}`} className="aspect-square w-full object-cover" />
                                    </a>
                                  ))}
                                </div>
                              ) : null}
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No updates have been added yet.</p>
                      )}

                      {canPostUpdate ? (
                        <form className="mt-5 space-y-4 border-t border-slate-200 pt-5" onSubmit={(event) => submitTenantUpdate(issue.id, event)}>
                          <label htmlFor={`maintenance-update-note-${issue.id}`} className="block text-sm font-medium text-slate-700">
                            Add a note or progress update
                            <textarea
                              id={`maintenance-update-note-${issue.id}`}
                              name="note"
                              rows={3}
                              maxLength={MAX_MAINTENANCE_UPDATE_NOTE_LENGTH}
                              placeholder="Share anything new about this repair..."
                              className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 px-3 py-3"
                            />
                          </label>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <label className="brand-button inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold">
                              Add photos
                              <input
                                name="photos"
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                multiple
                                className="sr-only"
                                onChange={(event) => setUpdatePhotoFiles((current) => ({
                                  ...current,
                                  [issue.id]: Array.from(event.target.files ?? []),
                                }))}
                              />
                            </label>
                            {updatePhotoFiles[issue.id]?.length ? (
                              <span className="text-sm text-slate-600">
                                {updatePhotoFiles[issue.id].length} photo{updatePhotoFiles[issue.id].length === 1 ? "" : "s"} selected
                              </span>
                            ) : null}
                            <span className="text-xs text-slate-500">Up to {MAX_MAINTENANCE_UPDATE_PHOTOS} JPEG, PNG, or WebP photos, 10 MB each.</span>
                            <button type="submit" disabled={isPending} className="brand-button min-h-12 rounded-xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
                              {isPending ? "Posting..." : "Post update"}
                            </button>
                          </div>
                        </form>
                      ) : null}
                    </section>
                  ) : null}

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
                      <div className="lg:col-span-2 flex justify-end"><button type="submit" disabled={isPending || issue.status !== "bidding_open"} className="brand-button rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60">{issue.status === "bidding_open" ? (isPending ? "Submitting..." : "Submit bid") : "Bidding closed"}</button></div>
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
                          <button type="button" disabled={isPending} onClick={() => saveStaffIssue(issue)} className="brand-button rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60">{isPending ? "Saving..." : "Save issue"}</button>
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