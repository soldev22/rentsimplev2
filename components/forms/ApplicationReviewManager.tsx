"use client"

import { useState, useTransition } from "react"

import type {
  ReferencingOutcome,
  TenancyApplicationRecord,
  TenancyApplicationStage,
  TenancyApplicationStatus,
  TenantDecisionOutcome,
} from "@/lib/auth"

type ApplicationReviewManagerProps = {
  initialApplications: TenancyApplicationRecord[]
}

type FeedbackState = Record<string, { type: "success" | "error"; message: string } | null>

const stageOptions: Array<{ value: TenancyApplicationStage; label: string }> = [
  { value: "pre_screening", label: "Pre-screening" },
  { value: "referencing_instruction", label: "Referencing instruction" },
  { value: "full_referencing", label: "Full referencing" },
  { value: "decision", label: "Decision" },
  { value: "agreement", label: "Agreement" },
  { value: "pre_move_in", label: "Pre-move-in" },
  { value: "move_in", label: "Move-in" },
  { value: "deposit_protection", label: "Deposit protection" },
  { value: "post_move_in", label: "Post move-in" },
]

const statusOptions: Array<{ value: TenancyApplicationStatus; label: string }> = [
  { value: "submitted", label: "Submitted" },
  { value: "pre_screen_failed", label: "Pre-screen failed" },
  { value: "pre_screen_passed", label: "Pre-screen passed" },
  { value: "referencing_in_progress", label: "Referencing in progress" },
  { value: "referencing_complete", label: "Referencing complete" },
  { value: "approved", label: "Approved" },
  { value: "approved_with_guarantor", label: "Approved with guarantor" },
  { value: "declined", label: "Declined" },
  { value: "agreement_in_progress", label: "Agreement in progress" },
  { value: "pre_move_in_ready", label: "Pre-move-in ready" },
  { value: "move_in_ready", label: "Move-in ready" },
  { value: "deposit_protected", label: "Deposit protected" },
  { value: "active_tenant", label: "Active tenant" },
]

const referencingOutcomeOptions: Array<{ value: ReferencingOutcome; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "pass", label: "Pass" },
  { value: "fail", label: "Fail" },
  { value: "guarantor_required", label: "Guarantor required" },
]

const decisionOptions: Array<{ value: TenantDecisionOutcome; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approve" },
  { value: "approved_with_guarantor", label: "Approve with guarantor" },
  { value: "declined", label: "Decline" },
]

function getStatusTone(status: TenancyApplicationStatus) {
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

function formatPreferredContactMethods(methods: TenancyApplicationRecord["preScreening"]["preferredContactMethods"] | undefined) {
  return methods && methods.length > 0 ? methods.join(", ") : "Not provided"
}

export default function ApplicationReviewManager({ initialApplications }: ApplicationReviewManagerProps) {
  const [applications, setApplications] = useState(initialApplications)
  const [feedback, setFeedback] = useState<FeedbackState>({})
  const [isPending, startTransition] = useTransition()

  function updateApplication(applicationId: string, updater: (application: TenancyApplicationRecord) => TenancyApplicationRecord) {
    setApplications((current) =>
      current.map((application) => (application.id === applicationId ? updater(application) : application)),
    )
  }

  function saveApplication(application: TenancyApplicationRecord) {
    setFeedback((current) => ({ ...current, [application.id]: null }))

    startTransition(async () => {
      try {
        const response = await fetch(`/api/applications/${application.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currentStage: application.currentStage,
            status: application.status,
            referencingInstruction: application.referencingInstruction,
            referencingReport: application.referencingReport,
            approvalDecision: application.approvalDecision,
            tenancyAgreement: application.tenancyAgreement,
            preMoveInCompliance: application.preMoveInCompliance,
            moveInChecklist: application.moveInChecklist,
            depositProtection: application.depositProtection,
            postMoveInManagement: application.postMoveInManagement,
          }),
        })

        const payload = (await response.json()) as {
          application?: TenancyApplicationRecord
          error?: string
        }

        if (!response.ok || !payload.application) {
          throw new Error(payload.error || "Unable to save the application.")
        }

        setApplications((current) =>
          current.map((candidate) => (candidate.id === payload.application?.id ? payload.application : candidate)),
        )
        setFeedback((current) => ({
          ...current,
          [application.id]: { type: "success", message: "Application workflow updated." },
        }))
      } catch (error) {
        setFeedback((current) => ({
          ...current,
          [application.id]: {
            type: "error",
            message: error instanceof Error ? error.message : "Unable to save the application.",
          },
        }))
      }
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Applications</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Tenancy pipeline review</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Review pre-screening, collect referencing evidence, document the decision, and carry the tenancy through to deposit protection and post move-in logging.
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Applications in pipeline</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{applications.length}</div>
          </div>
        </div>
      </section>

      {applications.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600 shadow-sm">
          No applications have been submitted yet.
        </section>
      ) : (
        applications.map((application) => (
          <section key={application.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">{application.applicantName}</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">{application.propertyAddress}</h2>
                <p className="mt-2 text-sm text-slate-600">
                  {application.applicantEmail} · £{application.monthlyRent.toLocaleString()}/month · submitted {new Date(application.submittedAt).toLocaleDateString()}
                </p>
              </div>
              <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getStatusTone(application.status)}`}>
                {application.status.replaceAll("_", " ")}
              </div>
            </div>

            {feedback[application.id] ? (
              <div
                className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                  feedback[application.id]?.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-rose-200 bg-rose-50 text-rose-900"
                }`}
              >
                {feedback[application.id]?.message}
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              <label className="block text-sm font-medium text-slate-700">
                Current stage
                <select
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
                  value={application.currentStage}
                  onChange={(event) =>
                    updateApplication(application.id, (current) => ({ ...current, currentStage: event.target.value as TenancyApplicationStage }))
                  }
                >
                  {stageOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Pipeline status
                <select
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
                  value={application.status}
                  onChange={(event) =>
                    updateApplication(application.id, (current) => ({ ...current, status: event.target.value as TenancyApplicationStatus }))
                  }
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Pre-screening summary</div>
                <div className="mt-2 font-semibold text-slate-900">{application.preScreeningSummary.outcome}</div>
                <div className="mt-2">Income: £{application.preScreening.annualIncome.toLocaleString()} annual</div>
                <div className="mt-1">Occupants: {application.preScreening.occupantCount}</div>
                <div className="mt-1">Preferred contact: {formatPreferredContactMethods(application.preScreening.preferredContactMethods)}</div>
                <div className="mt-1">Credit consent: {application.preScreening.creditCheckConsentGiven ? "Yes" : "No"}</div>
              </div>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <section className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-lg font-semibold text-slate-900">Referencing instruction</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Provider status
                    <select
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      value={application.referencingInstruction.providerStatus}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          referencingInstruction: {
                            ...current.referencingInstruction,
                            providerStatus: event.target.value as TenancyApplicationRecord["referencingInstruction"]["providerStatus"],
                          },
                        }))
                      }
                    >
                      <option value="pending">Pending</option>
                      <option value="sent">Sent</option>
                      <option value="documents_received">Documents received</option>
                    </select>
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    SharePoint file
                    <select
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      value={application.referencingInstruction.sharePointFileStatus}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          referencingInstruction: {
                            ...current.referencingInstruction,
                            sharePointFileStatus: event.target.value as TenancyApplicationRecord["referencingInstruction"]["sharePointFileStatus"],
                          },
                        }))
                      }
                    >
                      <option value="pending">Pending</option>
                      <option value="created">Created</option>
                    </select>
                  </label>

                  <label className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={application.referencingInstruction.photoIdReceived}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          referencingInstruction: {
                            ...current.referencingInstruction,
                            photoIdReceived: event.target.checked,
                          },
                        }))
                      }
                    />
                    Photo ID received
                  </label>

                  <label className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={application.referencingInstruction.proofOfAddressReceived}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          referencingInstruction: {
                            ...current.referencingInstruction,
                            proofOfAddressReceived: event.target.checked,
                          },
                        }))
                      }
                    />
                    Proof of address received
                  </label>

                  <label className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 md:col-span-2">
                    <input
                      type="checkbox"
                      checked={application.referencingInstruction.incomeEvidenceReceived}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          referencingInstruction: {
                            ...current.referencingInstruction,
                            incomeEvidenceReceived: event.target.checked,
                          },
                        }))
                      }
                    />
                    Payslips or SA302 received
                  </label>

                  <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                    Employer contact details
                    <textarea
                      className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2"
                      value={application.referencingInstruction.employerContactDetails}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          referencingInstruction: {
                            ...current.referencingInstruction,
                            employerContactDetails: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                    Previous landlord contact details
                    <textarea
                      className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2"
                      value={application.referencingInstruction.previousLandlordContactDetails}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          referencingInstruction: {
                            ...current.referencingInstruction,
                            previousLandlordContactDetails: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-lg font-semibold text-slate-900">Full referencing</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                    Referencing outcome
                    <select
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      value={application.referencingReport.outcome}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          referencingReport: {
                            ...current.referencingReport,
                            outcome: event.target.value as ReferencingOutcome,
                          },
                        }))
                      }
                    >
                      {referencingOutcomeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {[
                    ["identityDocumentVerified", "Identity document verified"],
                    ["addressVerified", "Address verified"],
                    ["fraudMarkersClear", "Fraud markers clear"],
                    ["creditFileReviewed", "Credit file reviewed"],
                    ["creditIssuesClear", "Credit issues clear"],
                    ["linkedAddressesReviewed", "Linked addresses reviewed"],
                    ["affordabilityVerified", "Affordability verified"],
                    ["employmentReferenceVerified", "Employment reference verified"],
                    ["previousLandlordReferenceVerified", "Landlord reference verified"],
                    ["guarantorRequired", "Guarantor required"],
                    ["guarantorVerified", "Guarantor verified"],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(application.referencingReport.checks[key as keyof typeof application.referencingReport.checks])}
                        onChange={(event) =>
                          updateApplication(application.id, (current) => ({
                            ...current,
                            referencingReport: {
                              ...current.referencingReport,
                              checks: {
                                ...current.referencingReport.checks,
                                [key]: event.target.checked,
                              },
                            },
                          }))
                        }
                      />
                      {label}
                    </label>
                  ))}

                  <label className="block text-sm font-medium text-slate-700">
                    Credit score
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      value={application.referencingReport.checks.creditScore}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          referencingReport: {
                            ...current.referencingReport,
                            checks: {
                              ...current.referencingReport.checks,
                              creditScore: event.target.value,
                            },
                          },
                        }))
                      }
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Guarantor annual income
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      type="number"
                      min="0"
                      value={application.referencingReport.checks.guarantorAnnualIncome}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          referencingReport: {
                            ...current.referencingReport,
                            checks: {
                              ...current.referencingReport.checks,
                              guarantorAnnualIncome: Number(event.target.value),
                            },
                          },
                        }))
                      }
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                    Referencing summary
                    <textarea
                      className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2"
                      value={application.referencingReport.summary}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          referencingReport: {
                            ...current.referencingReport,
                            summary: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                </div>
              </section>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <section className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-lg font-semibold text-slate-900">Decision and approval</h3>
                <div className="mt-4 grid gap-4">
                  <label className="block text-sm font-medium text-slate-700">
                    Decision
                    <select
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      value={application.approvalDecision.outcome}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          approvalDecision: {
                            ...current.approvalDecision,
                            outcome: event.target.value as TenantDecisionOutcome,
                          },
                        }))
                      }
                    >
                      {decisionOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Decision rationale
                    <textarea
                      className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2"
                      value={application.approvalDecision.rationale}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          approvalDecision: {
                            ...current.approvalDecision,
                            rationale: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Affordability calculation
                    <textarea
                      className="mt-2 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2"
                      value={application.approvalDecision.affordabilityCalculation}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          approvalDecision: {
                            ...current.approvalDecision,
                            affordabilityCalculation: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Exceptions and notes
                    <textarea
                      className="mt-2 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2"
                      value={application.approvalDecision.exceptionNotes}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          approvalDecision: {
                            ...current.approvalDecision,
                            exceptionNotes: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-lg font-semibold text-slate-900">Agreement and move-in readiness</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Tenancy type
                    <select
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      value={application.tenancyAgreement.tenancyType}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          tenancyAgreement: {
                            ...current.tenancyAgreement,
                            tenancyType: event.target.value as TenancyApplicationRecord["tenancyAgreement"]["tenancyType"],
                          },
                        }))
                      }
                    >
                      <option value="">Select</option>
                      <option value="AST">AST</option>
                      <option value="PRT">PRT</option>
                    </select>
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Rent due date
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      value={application.tenancyAgreement.rentDueDate}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          tenancyAgreement: {
                            ...current.tenancyAgreement,
                            rentDueDate: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Deposit amount
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      type="number"
                      min="0"
                      value={application.tenancyAgreement.depositAmount}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          tenancyAgreement: {
                            ...current.tenancyAgreement,
                            depositAmount: Number(event.target.value),
                          },
                        }))
                      }
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Term length (months)
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      type="number"
                      min="0"
                      value={application.tenancyAgreement.termLengthMonths}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          tenancyAgreement: {
                            ...current.tenancyAgreement,
                            termLengthMonths: Number(event.target.value),
                          },
                        }))
                      }
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                    Agreement provider
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      value={application.tenancyAgreement.agreementProvider}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          tenancyAgreement: {
                            ...current.tenancyAgreement,
                            agreementProvider: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Agreement reference
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      value={application.tenancyAgreement.agreementReference}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          tenancyAgreement: {
                            ...current.tenancyAgreement,
                            agreementReference: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Signing link
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      value={application.tenancyAgreement.agreementSigningUrl}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          tenancyAgreement: {
                            ...current.tenancyAgreement,
                            agreementSigningUrl: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>

                  <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 md:col-span-2">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Agreement audit trail</div>
                    <div className="mt-2">Sent: {application.tenancyAgreement.agreementSentAt ? new Date(application.tenancyAgreement.agreementSentAt).toLocaleString() : "Not recorded"}</div>
                    <div className="mt-1">Signed: {application.tenancyAgreement.agreementSignedAt ? new Date(application.tenancyAgreement.agreementSignedAt).toLocaleString() : "Not recorded"}</div>
                    <div className="mt-1">Applicant sign-off: {application.applicantChecklist.signedAt ? `${application.applicantChecklist.signedFullName || application.applicantName} on ${new Date(application.applicantChecklist.signedAt).toLocaleString()}` : "Pending"}</div>
                  </div>

                  {[
                    ["agreementSentForSignature", "Agreement sent for signature"],
                    ["agreementSigned", "Signed agreement received"],
                    ["guarantorDeedRequired", "Guarantor deed required"],
                    ["epcIssued", "EPC issued"],
                    ["gasSafetyIssued", "Gas safety issued"],
                    ["eicrIssued", "EICR issued"],
                    ["howToRentIssued", "How to Rent issued"],
                    ["depositLeafletIssued", "Deposit leaflet issued"],
                    ["checkInScheduled", "Check-in scheduled"],
                    ["inventoryPrepared", "Inventory prepared"],
                    ["inspectionCompleted", "Check-in inspection completed"],
                    ["inventoryCompletedWithPhotos", "Inventory with photos completed"],
                    ["meterReadingsRecorded", "Meter readings recorded"],
                    ["smokeAlarmsTested", "Smoke alarms tested"],
                    ["keysIssued", "Keys issued"],
                    ["tenantContactConfirmed", "Tenant contact confirmed"],
                    ["protectedWithinThirtyDays", "Deposit protected within 30 days"],
                    ["prescribedInformationIssued", "Prescribed information issued"],
                    ["certificateUploaded", "Deposit certificate uploaded"],
                  ].map(([key, label]) => {
                    const section =
                      key in application.tenancyAgreement
                        ? "tenancyAgreement"
                        : key in application.preMoveInCompliance
                          ? "preMoveInCompliance"
                          : key in application.moveInChecklist
                            ? "moveInChecklist"
                            : "depositProtection"

                    return (
                      <label key={key} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 md:col-span-2">
                        <input
                          type="checkbox"
                          checked={Boolean(application[section][key as never])}
                          onChange={(event) =>
                            updateApplication(application.id, (current) => ({
                              ...current,
                              [section]: {
                                ...current[section],
                                [key]: event.target.checked,
                              },
                            }))
                          }
                        />
                        {label}
                      </label>
                    )
                  })}

                  <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                    Key numbers
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      value={application.moveInChecklist.keyNumbers}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          moveInChecklist: {
                            ...current.moveInChecklist,
                            keyNumbers: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                    Deposit certificate reference
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      value={application.depositProtection.certificateReference}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          depositProtection: {
                            ...current.depositProtection,
                            certificateReference: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                    First inspection date
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      type="date"
                      value={application.postMoveInManagement.firstInspectionDate}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          postMoveInManagement: {
                            ...current.postMoveInManagement,
                            firstInspectionDate: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                    Maintenance log notes
                    <textarea
                      className="mt-2 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2"
                      value={application.postMoveInManagement.maintenanceLogNotes}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          postMoveInManagement: {
                            ...current.postMoveInManagement,
                            maintenanceLogNotes: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                    Communication log notes
                    <textarea
                      className="mt-2 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2"
                      value={application.postMoveInManagement.communicationLogNotes}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          postMoveInManagement: {
                            ...current.postMoveInManagement,
                            communicationLogNotes: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                </div>
              </section>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
                onClick={() => saveApplication(application)}
                disabled={isPending}
              >
                {isPending ? "Saving..." : "Save workflow"}
              </button>
            </div>
          </section>
        ))
      )}
    </div>
  )
}