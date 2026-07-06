"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"

import type {
  ApplicantProfileDefaults,
  EmploymentStatus,
  PreferredContactMethod,
  PropertyRecord,
  TenancyApplicationRecord,
} from "@/lib/auth"

type ApplicantTenancyWorkflowProps = {
  availableProperties: PropertyRecord[]
  initialApplications: TenancyApplicationRecord[]
  initialApplicantProfile?: ApplicantProfileDefaults
  preselectedPropertyId?: string
}

type FormState = {
  propertyId: string
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
  creditCheckConsentGiven: boolean
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

function createInitialFormState(preselectedPropertyId?: string, applicantProfile?: ApplicantProfileDefaults): FormState {
  return {
    propertyId: preselectedPropertyId ?? "",
    employmentStatus: applicantProfile?.employmentStatus ?? "employed_full_time",
    annualIncome: applicantProfile?.annualIncome ? String(applicantProfile.annualIncome) : "",
    moveInDate: applicantProfile?.moveInDate ?? "",
    preferredContactMethods:
      applicantProfile?.preferredContactMethods && applicantProfile.preferredContactMethods.length > 0
        ? applicantProfile.preferredContactMethods
        : ["email"],
    hasPets: applicantProfile?.hasPets ?? false,
    petDetails: applicantProfile?.petDetails ?? "",
    smokes: applicantProfile?.smokes ?? false,
    occupantCount: String(applicantProfile?.occupantCount ?? 1),
    hasAdverseCredit: applicantProfile?.hasAdverseCredit ?? false,
    adverseCreditDetails: applicantProfile?.adverseCreditDetails ?? "",
    creditCheckConsentGiven: false,
  }
}

function buildApplicantProfileFromFormState(formState: FormState): ApplicantProfileDefaults {
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

function createFormStateFromApplication(application: TenancyApplicationRecord): FormState {
  return {
    propertyId: application.propertyId,
    employmentStatus: application.preScreening.employmentStatus,
    annualIncome: String(application.preScreening.annualIncome || ""),
    moveInDate: application.preScreening.moveInDate,
    preferredContactMethods: application.preScreening.preferredContactMethods ?? [],
    hasPets: application.preScreening.hasPets,
    petDetails: application.preScreening.petDetails,
    smokes: application.preScreening.smokes,
    occupantCount: String(application.preScreening.occupantCount || 1),
    hasAdverseCredit: application.preScreening.hasAdverseCredit,
    adverseCreditDetails: application.preScreening.adverseCreditDetails,
    creditCheckConsentGiven: application.preScreening.creditCheckConsentGiven,
  }
}

function getStatusTone(status: TenancyApplicationRecord["status"]) {
  switch (status) {
    case "approved":
    case "approved_with_guarantor":
    case "active_tenant":
      return "bg-emerald-100 text-emerald-900"
    case "declined":
    case "pre_screen_failed":
      return "bg-rose-100 text-rose-900"
    default:
      return "bg-amber-100 text-amber-900"
  }
}

function formatPreferredContactMethods(methods: PreferredContactMethod[] | undefined) {
  return methods && methods.length > 0 ? methods.join(", ") : "Not provided"
}

function canApplicantEditApplication(application: TenancyApplicationRecord) {
  return application.approvalDecision.outcome === "pending"
}

function hasActiveApplicationForProperty(
  applications: TenancyApplicationRecord[],
  propertyId: string,
  editingApplicationId?: string | null,
) {
  if (!propertyId) {
    return false
  }

  return applications.some(
    (application) =>
      application.propertyId === propertyId && application.status !== "declined" && application.id !== editingApplicationId,
  )
}

export default function ApplicantTenancyWorkflow({
  availableProperties,
  initialApplications,
  initialApplicantProfile,
  preselectedPropertyId,
}: ApplicantTenancyWorkflowProps) {
  const [applications, setApplications] = useState(initialApplications)
  const [savedApplicantProfile, setSavedApplicantProfile] = useState<ApplicantProfileDefaults | undefined>(initialApplicantProfile)
  const [formState, setFormState] = useState<FormState>(() => createInitialFormState(preselectedPropertyId, initialApplicantProfile))
  const [editingApplicationId, setEditingApplicationId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [profileFeedback, setProfileFeedback] = useState<FeedbackState>(null)
  const [expandedApplicationId, setExpandedApplicationId] = useState<string | null>(initialApplications[0]?.id ?? null)
  const [isPending, startTransition] = useTransition()

  const selectedProperty = useMemo(
    () => availableProperties.find((property) => property.id === formState.propertyId) ?? null,
    [availableProperties, formState.propertyId],
  )

  const propertyIdsWithActiveApplications = useMemo(
    () =>
      new Set(
        applications.filter((application) => application.status !== "declined").map((application) => application.propertyId),
      ),
    [applications],
  )

  const duplicateSelectedProperty = useMemo(
    () => hasActiveApplicationForProperty(applications, formState.propertyId, editingApplicationId),
    [applications, editingApplicationId, formState.propertyId],
  )

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
        const response = await fetch(editingApplicationId ? `/api/applications/${editingApplicationId}` : "/api/applications", {
          method: editingApplicationId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            propertyId: formState.propertyId,
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
            creditCheckConsentGiven: formState.creditCheckConsentGiven,
            creditCheckConsentGivenAt: new Date().toISOString(),
            creditCheckConsentVersion: "tenant-credit-check-consent-v1",
          }),
        })

        const payload = (await response.json()) as {
          application?: TenancyApplicationRecord
          error?: string
        }

        if (!response.ok || !payload.application) {
          throw new Error(payload.error || "Unable to submit your application.")
        }

        setApplications((current) =>
          editingApplicationId
            ? current.map((application) => (application.id === payload.application?.id ? payload.application : application))
            : [payload.application!, ...current],
        )
        setFeedback({
          type: "success",
          message: editingApplicationId
            ? "Application updated. Your pre-screening summary has been refreshed."
            : "Application submitted. Your pre-screening summary has been created.",
        })
        setExpandedApplicationId(payload.application.id)
        setFormState(createInitialFormState(preselectedPropertyId, savedApplicantProfile))
        setEditingApplicationId(null)
      } catch (error) {
        setFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Unable to save your application.",
        })
      }
    })
  }

  function handleEditApplication(application: TenancyApplicationRecord) {
    setFeedback(null)
    setProfileFeedback(null)
    setEditingApplicationId(application.id)
    setExpandedApplicationId(application.id)
    setFormState(createFormStateFromApplication(application))
  }

  function handleCancelEdit() {
    setFeedback(null)
    setEditingApplicationId(null)
    setFormState(createInitialFormState(preselectedPropertyId, savedApplicantProfile))
  }

  function handleToggleApplication(applicationId: string) {
    setExpandedApplicationId((current) => (current === applicationId ? null : applicationId))
  }

  function handleSaveProfile() {
    setProfileFeedback(null)

    startTransition(async () => {
      try {
        const response = await fetch("/api/applicant/profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildApplicantProfileFromFormState(formState)),
        })

        const payload = (await response.json()) as {
          applicantProfile?: ApplicantProfileDefaults | null
          error?: string
        }

        if (!response.ok || !payload.applicantProfile) {
          throw new Error(payload.error || "Unable to save your profile defaults.")
        }

        setSavedApplicantProfile(payload.applicantProfile)
        setProfileFeedback({
          type: "success",
          message: "Profile defaults saved. New applications will start with these answers.",
        })
      } catch (error) {
        setProfileFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Unable to save your profile defaults.",
        })
      }
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Applicant</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Tenancy applications</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Start your pre-screening, then track referencing, approval, agreement, and move-in stages in one place.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Available homes</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{availableProperties.length}</div>
            </div>
            <div className="rounded-xl bg-sky-50 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-sky-700">Applications</div>
              <div className="mt-2 text-2xl font-semibold text-sky-900">{applications.length}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Your applications</h2>
            <p className="mt-2 text-sm text-slate-600">
              Review every application at a glance, expand one when you need the detail, and edit any application that is still pending decision.
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {applications.length === 0
              ? "No applications started yet."
              : `${applications.length} application${applications.length === 1 ? "" : "s"} in your pipeline.`}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {applications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600 shadow-sm">
              You have not started an application yet.
            </div>
          ) : (
            <div className="space-y-4" role="presentation">
              {applications.map((application) => {
              const isExpanded = expandedApplicationId === application.id
              const canEdit = canApplicantEditApplication(application)
              const panelId = `application-panel-${application.id}`
              const triggerId = `application-trigger-${application.id}`

              return (
                <article key={application.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <details open={isExpanded} className="min-w-0 flex-1">
                      <summary
                        id={triggerId}
                        className="list-none rounded-xl text-left transition-colors hover:bg-white/60 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
                        onClick={(event) => {
                          event.preventDefault()
                          handleToggleApplication(application.id)
                        }}
                      >
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">
                          <span>{application.currentStage.replaceAll("_", " ")}</span>
                          <span className={`inline-flex rounded-full px-3 py-1 text-[11px] ${getStatusTone(application.status)}`}>
                            {application.status.replaceAll("_", " ")}
                          </span>
                          <span className="text-slate-500">{isExpanded ? "Collapse" : "Expand"}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7.5h16a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 18.5H4A1.5 1.5 0 0 1 2.5 17V9A1.5 1.5 0 0 1 4 7.5Z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5 9 5.5h6l1.5 2" />
                              <circle cx="8.5" cy="12" r="1.25" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="m11 15 2.3-2.6a1 1 0 0 1 1.5 0l2.2 2.6" />
                            </svg>
                          </div>
                          <h3 className="truncate text-lg font-semibold text-slate-900">{application.propertyAddress}</h3>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                          <span>{application.propertyCity}</span>
                          <span>£{application.monthlyRent.toLocaleString()}/month</span>
                          <span>Pre-screening: {application.preScreeningSummary.outcome}</span>
                        </div>
                      </summary>
                    </details>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/applicant/${application.id}`}
                        className="rounded-md border border-sky-300 px-3 py-2 text-sm font-semibold text-sky-700 transition-colors hover:bg-sky-50"
                      >
                        Checklist
                      </Link>
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => handleEditApplication(application)}
                        disabled={!canEdit}
                        title={canEdit ? "Edit this application" : "Editing is locked after a final decision is made."}
                      >
                        {canEdit ? "Edit application" : "Editing locked"}
                      </button>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div id={panelId} role="region" aria-labelledby={triggerId} className="mt-4 border-t border-slate-200 pt-4">
                      <div className="grid gap-4 lg:grid-cols-3">
                        <div className="rounded-xl bg-white p-4">
                          <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Pre-screening</div>
                          <div className="mt-2 text-sm font-semibold text-slate-900">{application.preScreeningSummary.outcome}</div>
                          <p className="mt-2 text-sm text-slate-600">
                            Income ratio: {application.preScreeningSummary.affordabilityRatio.toFixed(2)}x target
                          </p>
                          <p className="mt-2 text-sm text-slate-600">
                            Preferred contact: {formatPreferredContactMethods(application.preScreening.preferredContactMethods)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white p-4">
                          <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Referencing</div>
                          <div className="mt-2 text-sm font-semibold text-slate-900">{application.referencingReport.outcome.replaceAll("_", " ")}</div>
                          <p className="mt-2 text-sm text-slate-600">
                            SharePoint-ready file: {application.referencingInstruction.sharePointFileStatus.replaceAll("_", " ")}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white p-4">
                          <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Decision</div>
                          <div className="mt-2 text-sm font-semibold text-slate-900">{application.approvalDecision.outcome.replaceAll("_", " ")}</div>
                          <p className="mt-2 text-sm text-slate-600">
                            Agreement signed: {application.tenancyAgreement.agreementSigned ? "Yes" : "No"}
                          </p>
                        </div>
                      </div>

                      {application.preScreeningSummary.reasons.length > 0 ? (
                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                          <div className="font-semibold">Pre-screening notes</div>
                          <ul className="mt-2 list-disc pl-5">
                            {application.preScreeningSummary.reasons.map((reason) => (
                              <li key={reason}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {!canEdit ? (
                        <p className="mt-4 text-sm text-slate-500">
                          This application can no longer be edited because a decision has already been recorded.
                        </p>
                      ) : null}

                      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                        {application.preScreening.creditCheckConsentGivenAt
                          ? `Credit check consent recorded at ${new Date(application.preScreening.creditCheckConsentGivenAt).toLocaleString()}.`
                          : "Credit check consent has not been recorded on this application yet."}
                      </div>
                    </div>
                  ) : null}
                </article>
              )
            })}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">{editingApplicationId ? "Edit your application" : "Start an application"}</h2>
        <p className="mt-2 text-sm text-slate-600">
          {editingApplicationId
            ? "Update your pre-screening answers while the application is still in its early review stages."
            : "This creates the pre-screening summary and opens the referencing workflow if the initial checks pass."}
        </p>

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

        {profileFeedback ? (
          <div
            className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
              profileFeedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-rose-200 bg-rose-50 text-rose-900"
            }`}
          >
            {profileFeedback.message}
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          {savedApplicantProfile
            ? "Saved profile defaults are active. New applications will start with your stored answers, but you will still need to give fresh consent for each submission."
            : "You can save the answers below to your applicant profile so future applications start pre-filled."}
        </div>

        <form className="mt-6 grid gap-4 lg:grid-cols-2" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700 lg:col-span-2">
            Property
            <select
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
              value={formState.propertyId}
              onChange={(event) => updateField("propertyId", event.target.value)}
              required
              disabled={Boolean(editingApplicationId)}
              aria-label="Select a property for your application"
              title="Select a property for your application"
            >
              <option value="">Select a property</option>
              {availableProperties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.address} · £{property.monthlyRent.toLocaleString()}/month
                  {propertyIdsWithActiveApplications.has(property.id) ? " · already applied" : ""}
                </option>
              ))}
            </select>
          </label>

          {duplicateSelectedProperty ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 lg:col-span-2">
              You already have an active application for this property. Open it from the applications accordion above instead of submitting a second one.
            </div>
          ) : null}

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
              required
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
              Select every channel you are happy for the lettings team to use during pre-screening, referencing, and move-in coordination.
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

          <label className="lg:col-span-2 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={formState.creditCheckConsentGiven}
              onChange={(event) => updateField("creditCheckConsentGiven", event.target.checked)}
              required
            />
            <span>
              I explicitly consent to RentSimple and its referencing partners carrying out identity, fraud, landlord, affordability, and credit checks for this tenancy application.
            </span>
          </label>

          <div className="lg:col-span-2 flex flex-col gap-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 lg:flex-row lg:items-center lg:justify-between">
            <div>
              {selectedProperty
                ? `Affordability target: £${Math.round(selectedProperty.monthlyRent * 12 * selectedProperty.affordabilityMultiple).toLocaleString()} annual income at ${selectedProperty.affordabilityMultiple.toFixed(1)}x`
                : "Select a property to see the affordability target."}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700 transition-colors hover:bg-white disabled:opacity-60"
                onClick={handleSaveProfile}
                disabled={isPending}
              >
                Save to profile
              </button>
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
                disabled={isPending || !formState.creditCheckConsentGiven || duplicateSelectedProperty}
              >
                {isPending ? "Saving..." : editingApplicationId ? "Save changes" : "Submit application"}
              </button>
              {editingApplicationId ? (
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700 transition-colors hover:bg-white"
                  onClick={handleCancelEdit}
                  disabled={isPending}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
          {!formState.creditCheckConsentGiven ? <div className="lg:col-span-2 text-sm text-amber-700">You must agree to the credit and referencing checks before you can submit.</div> : null}
          {duplicateSelectedProperty ? <div className="lg:col-span-2 text-sm text-amber-700">This property already has an active application under your account.</div> : null}
        </form>
      </section>
    </div>
  )
}