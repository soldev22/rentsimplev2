"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"

import type { ApplicantChecklistSignOff, TenancyApplicationRecord } from "@/lib/auth"
import type { AuditEventRecord } from "@/lib/types/audit"

type ApplicantTenancyChecklistProps = {
  initialApplication: TenancyApplicationRecord
  initialAuditEvents: AuditEventRecord[]
}

type FeedbackState =
  | {
      type: "success" | "error"
      message: string
    }
  | null

type SignOffFormState = ApplicantChecklistSignOff & {
  agreementSigningCompleted: boolean
}

type JourneyEvent = {
  key: string
  label: string
  at?: string
  detail: string
  status: "complete" | "pending"
}

function formatDateTime(value?: string) {
  if (!value) {
    return "Not recorded"
  }

  return new Date(value).toLocaleString()
}

function formatAuditAction(action: string) {
  return action.replace(/_/g, " ")
}

function formatAuditValue(value: AuditEventRecord["oldValue"] | AuditEventRecord["newValue"]) {
  if (value === undefined) {
    return "Not recorded"
  }

  if (value === null) {
    return "Cleared"
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  return JSON.stringify(value)
}

function getJourneyTone(status: JourneyEvent["status"]) {
  return status === "complete"
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : "border-slate-200 bg-slate-50 text-slate-700"
}

function getJourneyBadge(status: JourneyEvent["status"]) {
  return status === "complete" ? "Complete" : "Pending"
}

function createSignOffFormState(application: TenancyApplicationRecord): SignOffFormState {
  return {
    ...application.applicantChecklist,
    agreementSigningCompleted: application.tenancyAgreement.agreementSigned,
  }
}

function getStatusTone(status: TenancyApplicationRecord["status"]) {
  switch (status) {
    case "approved":
    case "approved_with_guarantor":
    case "active_tenant":
      return "bg-emerald-100 text-emerald-900"
    case "declined":
      return "bg-rose-100 text-rose-900"
    default:
      return "bg-amber-100 text-amber-900"
  }
}

function getApplicantFacingStatus(application: TenancyApplicationRecord) {
  if (application.status === "active_tenant") {
    return "Tenant active"
  }

  if (application.approvalDecision.outcome === "approved" || application.approvalDecision.outcome === "approved_with_guarantor") {
    return "Approved"
  }

  if (application.approvalDecision.outcome === "declined" || application.status === "declined") {
    return "Review complete"
  }

  return "Under review"
}

function isApplicantApprovalReady(application: TenancyApplicationRecord) {
  return application.approvalDecision.outcome === "approved" || application.approvalDecision.outcome === "approved_with_guarantor"
}

function areRequiredTenancyDocumentsIssued(application: TenancyApplicationRecord) {
  return (
    application.tenancyAgreement.offerLetter.sent &&
    application.tenancyAgreement.leaseDocument.sent &&
    application.tenancyAgreement.supportingLegalDocuments.sent
  )
}

export default function ApplicantTenancyChecklist({ initialApplication, initialAuditEvents }: ApplicantTenancyChecklistProps) {
  const [application, setApplication] = useState(initialApplication)
  const [auditEvents, setAuditEvents] = useState(initialAuditEvents)
  const [formState, setFormState] = useState<SignOffFormState>(() => createSignOffFormState(initialApplication))
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [isOverviewOpen, setIsOverviewOpen] = useState(false)
  const [isChecklistOpen, setIsChecklistOpen] = useState(false)
  const [isSignOffOpen, setIsSignOffOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const canAccessSignOff = isApplicantApprovalReady(application)
  const canSubmitSignOff = canAccessSignOff && areRequiredTenancyDocumentsIssued(application) && application.tenancyAgreement.agreementSentForSignature
  const workflowChecklist = useMemo(
    () => [
      {
        label: "Application approved",
        complete: canAccessSignOff,
        detail:
          application.approvalDecision.outcome === "approved_with_guarantor"
            ? "Approved subject to guarantor requirements."
            : application.approvalDecision.outcome === "approved"
              ? "Approval decision recorded."
              : "Waiting for the landlord or reviewer to approve the tenancy.",
      },
      {
        label: "Offer letter issued",
        complete: application.tenancyAgreement.offerLetter.sent,
        detail: application.tenancyAgreement.offerLetter.sentAt
          ? `Issued ${new Date(application.tenancyAgreement.offerLetter.sentAt).toLocaleString()}.`
          : "The letter of offer has not been issued yet.",
      },
      {
        label: "Lease sent for signature",
        complete: application.tenancyAgreement.leaseDocument.sent,
        detail: application.tenancyAgreement.leaseDocument.sentAt
          ? `Issued ${new Date(application.tenancyAgreement.leaseDocument.sentAt).toLocaleString()}.`
          : "The lease has not been sent yet.",
      },
      {
        label: "Supporting legal documents issued",
        complete: application.tenancyAgreement.supportingLegalDocuments.sent,
        detail: application.tenancyAgreement.supportingLegalDocuments.sentAt
          ? `Issued ${new Date(application.tenancyAgreement.supportingLegalDocuments.sentAt).toLocaleString()}.`
          : "Supporting legal documents have not been issued yet.",
      },
      {
        label: "Signed lease returned",
        complete: application.tenancyAgreement.leaseDocument.signedCopyReceived,
        detail: application.tenancyAgreement.leaseDocument.signedCopyReceivedAt
          ? `Signed copy received ${new Date(application.tenancyAgreement.leaseDocument.signedCopyReceivedAt).toLocaleString()}.`
          : "Awaiting the signed lease copy.",
      },
      {
        label: "Pre-move-in documents issued",
        complete:
          application.preMoveInCompliance.epcIssued &&
          application.preMoveInCompliance.gasSafetyIssued &&
          application.preMoveInCompliance.eicrIssued &&
          application.preMoveInCompliance.howToRentIssued &&
          application.preMoveInCompliance.depositLeafletIssued,
        detail: "EPC, gas safety, EICR, How to Rent guide, and deposit leaflet.",
      },
      {
        label: "Check-in arranged",
        complete: application.preMoveInCompliance.checkInScheduled && application.preMoveInCompliance.inventoryPrepared,
        detail: "Check-in date agreed and inventory prepared.",
      },
      {
        label: "Deposit protection recorded",
        complete:
          application.depositProtection.protectedWithinThirtyDays &&
          application.depositProtection.prescribedInformationIssued,
        detail: "Deposit protected and prescribed information issued.",
      },
    ],
    [application, canAccessSignOff],
  )

  const journeyEvents = useMemo<JourneyEvent[]>(() => {
    const events: JourneyEvent[] = [
      {
        key: "submitted",
        label: "Application submitted",
        at: application.submittedAt,
        detail: "Applicant submission recorded for manual review.",
        status: application.submittedAt ? "complete" : "pending",
      },
      {
        key: "queued-for-review",
        label: "Application queued for review",
        at: application.submittedAt,
        detail: "Application moved into manual review by the lettings team.",
        status: application.submittedAt ? "complete" : "pending",
      },
      {
        key: "decision",
        label: "Application review",
        at: application.approvalDecision.certificateIssuedAt,
        detail:
          application.approvalDecision.outcome === "pending"
            ? "Review in progress."
            : `Decision: ${application.approvalDecision.outcome.replaceAll("_", " ")}.`,
        status: application.approvalDecision.outcome === "pending" ? "pending" : "complete",
      },
      {
        key: "offer-letter",
        label: "Offer letter issued",
        at: application.tenancyAgreement.offerLetter.sentAt,
        detail: application.tenancyAgreement.offerLetter.reference
          ? `Reference: ${application.tenancyAgreement.offerLetter.reference}.`
          : "Offer reference not set.",
        status: application.tenancyAgreement.offerLetter.sent ? "complete" : "pending",
      },
      {
        key: "lease-issued",
        label: "Lease issued",
        at: application.tenancyAgreement.leaseDocument.sentAt,
        detail: `Legal framework: ${application.tenancyAgreement.legalFramework === "england_wales" ? "England and Wales" : application.tenancyAgreement.legalFramework === "scotland" ? "Scotland" : "Not selected"}. Tenancy type: ${application.tenancyAgreement.tenancyType || "Not selected"}.`,
        status: application.tenancyAgreement.leaseDocument.sent ? "complete" : "pending",
      },
      {
        key: "lease-signed",
        label: "Lease signed",
        at: application.tenancyAgreement.leaseDocument.signedCopyReceivedAt || application.tenancyAgreement.agreementSignedAt,
        detail: "Signed lease confirmation and agreement completion.",
        status: application.tenancyAgreement.leaseDocument.signedCopyReceived || application.tenancyAgreement.agreementSigned ? "complete" : "pending",
      },
      {
        key: "applicant-signoff",
        label: "Applicant sign-off",
        at: application.applicantChecklist.signedAt,
        detail: application.applicantChecklist.signedFullName
          ? `Signed by ${application.applicantChecklist.signedFullName}.`
          : "Applicant sign-off not completed yet.",
        status: application.applicantChecklist.signedAt ? "complete" : "pending",
      },
      {
        key: "deposit-protected",
        label: "Deposit protection",
        at: application.depositProtection.certificateUploaded ? application.updatedAt : undefined,
        detail: application.depositProtection.protectedWithinThirtyDays
          ? "Deposit protection marked complete."
          : "Deposit protection still pending.",
        status: application.depositProtection.protectedWithinThirtyDays ? "complete" : "pending",
      },
      {
        key: "tenant-active",
        label: "Tenant activated",
        at: application.status === "active_tenant" ? application.updatedAt : undefined,
        detail: application.status === "active_tenant"
          ? "Applicant transitioned to active tenant."
          : "Applicant has not transitioned to tenant yet.",
        status: application.status === "active_tenant" ? "complete" : "pending",
      },
    ]

    return events
  }, [application])

  const signOffReady =
    formState.applicationInformationConfirmed &&
    formState.moveInFundsConfirmed &&
    formState.agreementTermsAccepted &&
    formState.documentsReadyConfirmed &&
    Boolean(formState.signedFullName.trim()) &&
    formState.agreementSigningCompleted

  function updateField<Key extends keyof SignOffFormState>(field: Key, value: SignOffFormState[Key]) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)

    startTransition(async () => {
      try {
        const response = await fetch(`/api/applications/${application.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            applicantChecklist: {
              applicationInformationConfirmed: formState.applicationInformationConfirmed,
              moveInFundsConfirmed: formState.moveInFundsConfirmed,
              agreementTermsAccepted: formState.agreementTermsAccepted,
              documentsReadyConfirmed: formState.documentsReadyConfirmed,
              signedFullName: formState.signedFullName,
            },
            agreementSigned: formState.agreementSigningCompleted,
          }),
        })

        const payload = (await response.json()) as {
          application?: TenancyApplicationRecord
          auditEvents?: AuditEventRecord[]
          error?: string
        }

        if (!response.ok || !payload.application) {
          throw new Error(payload.error || "Unable to submit applicant sign-off.")
        }

        setApplication(payload.application)
        if (payload.auditEvents) {
          setAuditEvents(payload.auditEvents)
        }
        setFormState(createSignOffFormState(payload.application))
        setFeedback({
          type: "success",
          message: "Applicant sign-off recorded. The tenancy agreement and checklist status are now updated.",
        })
      } catch (error) {
        setFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Unable to submit applicant sign-off.",
        })
      }
    })
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link href="/dashboard/applicant" className="text-sm font-semibold text-sky-700 hover:underline">
              Back to applications
            </Link>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Applicant sign-off</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Tenancy checklist</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Review the tenancy workflow, open the agreement when it has been issued, and record a named applicant sign-off once everything is ready.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getStatusTone(application.status)}`}>
              {getApplicantFacingStatus(application)}
            </span>
            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
              Application
            </span>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700"
              aria-label={isOverviewOpen ? "Collapse panel" : "Expand panel"}
              onClick={() => setIsOverviewOpen((current) => !current)}
            >
              <span className={`inline-block text-[2.5rem] leading-none transition-transform ${isOverviewOpen ? "rotate-0" : "-rotate-90"}`}>▾</span>
            </button>
          </div>
        </div>

        {isOverviewOpen ? (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Property</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{application.propertyAddress}</div>
            <div className="mt-1 text-sm text-slate-600">{application.propertyCity}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Agreement</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">
              {application.tenancyAgreement.leaseDocument.sent ? "Lease issued" : "Not issued yet"}
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {application.tenancyAgreement.agreementProvider || "Provider not set yet"}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {application.tenancyAgreement.legalFramework === "england_wales"
                ? "England and Wales"
                : application.tenancyAgreement.legalFramework === "scotland"
                  ? "Scotland"
                  : "Legal framework not selected"}
              {application.tenancyAgreement.tenancyType ? ` · ${application.tenancyAgreement.tenancyType}` : ""}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Applicant sign-off</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">
              {application.applicantChecklist.signedAt ? "Recorded" : "Pending"}
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {application.applicantChecklist.signedAt
                ? new Date(application.applicantChecklist.signedAt).toLocaleString()
                : "Waiting for your confirmation."}
            </div>
          </div>
        </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Journey timeline</h2>
        <p className="mt-2 text-sm text-slate-600">
          Timestamped history of your progress from application through tenancy, including lease and document milestones.
        </p>

        <div className="mt-6 space-y-3">
          {journeyEvents.map((event) => (
            <article key={event.key} className={`rounded-xl border p-4 ${getJourneyTone(event.status)}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em]">{event.label}</h3>
                <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]">
                  {getJourneyBadge(event.status)}
                </span>
              </div>
              <p className="mt-2 text-sm">{event.detail}</p>
              <p className="mt-1 text-xs opacity-80">{formatDateTime(event.at)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Detailed activity log</h2>
        <p className="mt-2 text-sm text-slate-600">
          Immutable audit events with actor, timestamp, and before/after values.
        </p>

        {auditEvents.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            No activity has been recorded yet.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {auditEvents.map((event) => (
              <article key={event.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-sm font-semibold capitalize text-slate-900">{formatAuditAction(event.action)}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
                      {event.fieldPath ?? "application"}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatDateTime(event.timestamp)} · {event.performedBy}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 lg:grid-cols-2">
                  <div className="rounded-md bg-white px-3 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Before</div>
                    <div className="mt-1 whitespace-pre-wrap wrap-break-word text-xs text-slate-700">{formatAuditValue(event.oldValue)}</div>
                  </div>
                  <div className="rounded-md bg-emerald-50 px-3 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">After</div>
                    <div className="mt-1 whitespace-pre-wrap wrap-break-word text-xs text-emerald-900">{formatAuditValue(event.newValue)}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Checklist status</h2>
            <p className="mt-2 text-sm text-slate-600">
              This page gives you a defensible record of what is still outstanding before move-in.
            </p>
          </div>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
            aria-label={isChecklistOpen ? "Collapse panel" : "Expand panel"}
            onClick={() => setIsChecklistOpen((current) => !current)}
          >
            <span className={`inline-block text-[2.5rem] leading-none transition-transform ${isChecklistOpen ? "rotate-0" : "-rotate-90"}`}>▾</span>
          </button>
        </div>

        {isChecklistOpen ? (
        <>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {workflowChecklist.map((item) => (
            <div
              key={item.label}
              className={`rounded-2xl border p-4 ${item.complete ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${item.complete ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-700"}`}>
                  {item.complete ? "Complete" : "Pending"}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{item.detail}</p>
            </div>
          ))}
        </div>

        {areRequiredTenancyDocumentsIssued(application) ? (
          <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
            <div className="font-semibold">Issued tenancy documents</div>
            <p className="mt-2">
              Offer letter: {application.tenancyAgreement.offerLetter.reference || "Reference not specified"}
            </p>
            {application.tenancyAgreement.offerLetter.url ? (
              <a
                href={application.tenancyAgreement.offerLetter.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-900"
              >
                Open offer letter
              </a>
            ) : null}
            <p className="mt-2">
              Provider: {application.tenancyAgreement.agreementProvider || "Not specified"}
              {application.tenancyAgreement.agreementReference ? ` · Reference: ${application.tenancyAgreement.agreementReference}` : ""}
            </p>
            {application.tenancyAgreement.agreementSigningUrl ? (
              <a
                href={application.tenancyAgreement.agreementSigningUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex rounded-md bg-slate-900 px-4 py-2 font-semibold text-white"
              >
                Open agreement signing
              </a>
            ) : (
              <p className="mt-2">Your landlord or agent has marked the agreement as issued, but no signing link has been attached yet.</p>
            )}
            {application.tenancyAgreement.leaseDocument.url ? (
              <a
                href={application.tenancyAgreement.leaseDocument.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 ml-3 inline-flex rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-900"
              >
                Open lease copy
              </a>
            ) : null}
            {application.tenancyAgreement.supportingLegalDocuments.url ? (
              <a
                href={application.tenancyAgreement.supportingLegalDocuments.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 ml-3 inline-flex rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-900"
              >
                Open legal documents
              </a>
            ) : null}
            {application.tenancyAgreement.supportingLegalDocuments.summary ? (
              <p className="mt-3">Supporting legal documents: {application.tenancyAgreement.supportingLegalDocuments.summary}</p>
            ) : null}
          </div>
        ) : null}
        </>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Applicant sign-off</h2>
            <p className="mt-2 text-sm text-slate-600">
              Complete this after approval and once the offer letter, lease, and supporting legal documents have all been issued.
            </p>
          </div>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
            aria-label={isSignOffOpen ? "Collapse panel" : "Expand panel"}
            onClick={() => setIsSignOffOpen((current) => !current)}
          >
            <span className={`inline-block text-[2.5rem] leading-none transition-transform ${isSignOffOpen ? "rotate-0" : "-rotate-90"}`}>▾</span>
          </button>
        </div>

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

        {!canAccessSignOff ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Applicant sign-off becomes available once the landlord or agent approves this application.
          </div>
        ) : !areRequiredTenancyDocumentsIssued(application) ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Your offer letter, lease, and supporting legal documents must all be issued before final sign-off becomes available.
          </div>
        ) : !application.tenancyAgreement.agreementSentForSignature ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            The agreement has not been sent for signature yet, so your final sign-off is still locked.
          </div>
        ) : null}

        {isSignOffOpen ? (
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={formState.applicationInformationConfirmed}
              onChange={(event) => updateField("applicationInformationConfirmed", event.target.checked)}
              disabled={!canSubmitSignOff || isPending}
            />
            <span>I confirm that my application details are still accurate and I will notify RentSimple if anything changes before move-in.</span>
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={formState.moveInFundsConfirmed}
              onChange={(event) => updateField("moveInFundsConfirmed", event.target.checked)}
              disabled={!canSubmitSignOff || isPending}
            />
            <span>I confirm that my rent, deposit, and move-in funds are available for the agreed tenancy start.</span>
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={formState.documentsReadyConfirmed}
              onChange={(event) => updateField("documentsReadyConfirmed", event.target.checked)}
              disabled={!canSubmitSignOff || isPending}
            />
            <span>I confirm that my identification and supporting move-in documents are ready if the landlord or agent requests them again.</span>
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={formState.agreementTermsAccepted}
              onChange={(event) => updateField("agreementTermsAccepted", event.target.checked)}
              disabled={!canSubmitSignOff || isPending}
            />
            <span>I have reviewed the tenancy terms and I am ready to proceed on the basis of the agreement issued for this property.</span>
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={formState.agreementSigningCompleted}
              onChange={(event) => updateField("agreementSigningCompleted", event.target.checked)}
              disabled={!canSubmitSignOff || isPending}
            />
            <span>I confirm that I have completed the tenancy agreement signing step for this application.</span>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Full name for sign-off
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
              value={formState.signedFullName}
              onChange={(event) => updateField("signedFullName", event.target.value)}
              disabled={!canSubmitSignOff || isPending}
              placeholder="Type your full name"
            />
          </label>

          {application.applicantChecklist.signedAt ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Sign-off already recorded as {application.applicantChecklist.signedFullName || "the applicant"} on {new Date(application.applicantChecklist.signedAt).toLocaleString()}.
            </div>
          ) : null}

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={!canSubmitSignOff || !signOffReady || isPending}
            >
              {isPending ? "Submitting..." : application.applicantChecklist.signedAt ? "Update sign-off" : "Submit sign-off"}
            </button>
          </div>
        </form>
        ) : null}
      </section>
    </div>
  )
}