"use client"

import { useRef, useState, useTransition, type ChangeEvent } from "react"

import TenantCommunicationThread from "@/components/forms/TenantCommunicationThread"
import type {
  ApplicantScreeningScoreConfig,
  DepositDocumentCategory,
  RefereeRequestChannel,
  TenantCommunicationChannel,
  TenantCommunicationDirection,
  TenantCommunicationEntry,
  TenancyApplicationRecord,
  TenancyRefereeContact,
  TenancyReferenceRequest,
  TenancyApplicationStatus,
  TenantDecisionOutcome,
} from "@/lib/auth"
import type { AuditEventRecord } from "@/lib/types/audit"
import { calculateApplicantScreeningScore, normalizeApplicantScreeningScoreConfig } from "@/lib/utils/applicant-screening-score"
import { downloadTenancyLogPdf, downloadTenancyLogTxt } from "@/lib/utils/tenancy-log-export"

type ApplicationReviewManagerProps = {
  initialApplications: TenancyApplicationRecord[]
  initialAuditEventsByApplicationId: Record<string, AuditEventRecord[]>
  currentUserDisplayName: string
  isAdmin?: boolean
  screeningScoreConfig?: ApplicantScreeningScoreConfig
  canRequestCreditReport?: boolean
}

type FeedbackState = Record<string, { type: "success" | "error"; message: string } | null>

type ApplicationTab = "applicant" | "application" | "siteVisit" | "deposit" | "offer" | "lease" | "correspondence"

const applicationTabs: Array<{ id: ApplicationTab; label: string }> = [
  { id: "applicant", label: "Applicant details" },
  { id: "application", label: "Application information" },
  { id: "siteVisit", label: "Site visit" },
  { id: "deposit", label: "Deposit and financials" },
  { id: "offer", label: "Offer" },
  { id: "lease", label: "Lease" },
  { id: "correspondence", label: "Correspondence" },
]

type CommunicationDraft = {
  occurredAt: string
  channel: TenantCommunicationChannel
  direction: TenantCommunicationDirection
  subject: string
  summary: string
}

type VerificationChecklistKey =
  | "noIdRequired"
  | "photoIdReceived"
  | "proofOfAddressReceived"
  | "creditReferenceCheckReceived"
  | "previousLandlordReferenceReceived"
  | "incomeEvidenceReceived"

const verificationChecklistOptions: Array<{ key: VerificationChecklistKey; label: string }> = [
  { key: "noIdRequired", label: "No ID required" },
  { key: "photoIdReceived", label: "Government photo ID" },
  { key: "proofOfAddressReceived", label: "Proof of current address" },
  { key: "creditReferenceCheckReceived", label: "Credit/reference check" },
  { key: "previousLandlordReferenceReceived", label: "Previous landlord reference" },
  { key: "incomeEvidenceReceived", label: "Employment verification" },
]

const statusOptions: Array<{ value: TenancyApplicationStatus; label: string }> = [
  { value: "submitted", label: "Submitted" },
  { value: "referencing_in_progress", label: "Referencing in progress" },
  { value: "referencing_complete", label: "Referencing complete" },
  { value: "approved", label: "Approved" },
  { value: "approved_with_guarantor", label: "Approved with guarantor" },
  { value: "declined", label: "Declined" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "agreement_in_progress", label: "Agreement in progress" },
  { value: "pre_move_in_ready", label: "Pre-move-in ready" },
  { value: "move_in_ready", label: "Move-in ready" },
  { value: "deposit_protected", label: "Deposit protected" },
  { value: "active_tenant", label: "Active tenant" },
]

const pipelineSteps: Array<{ id: string; label: string; statuses: TenancyApplicationStatus[] }> = [
  { id: "submitted", label: "Submitted", statuses: ["submitted"] },
  { id: "referencing", label: "Referencing", statuses: ["referencing_in_progress", "referencing_complete"] },
  { id: "decision", label: "Decision", statuses: ["approved", "approved_with_guarantor", "declined"] },
  { id: "agreement", label: "Agreement", statuses: ["agreement_in_progress"] },
  { id: "move_in", label: "Move-in", statuses: ["pre_move_in_ready", "move_in_ready"] },
  { id: "active", label: "Active tenant", statuses: ["deposit_protected", "active_tenant"] },
]

function getPipelineStepIndex(status: TenancyApplicationStatus) {
  const stepIndex = pipelineSteps.findIndex((step) => step.statuses.includes(status))
  return stepIndex >= 0 ? stepIndex : 0
}

const decisionOptions: Array<{ value: TenantDecisionOutcome; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approve" },
  { value: "approved_with_guarantor", label: "Approve with guarantor" },
  { value: "declined", label: "Decline" },
]

const refereeChannelOptions: Array<{ value: RefereeRequestChannel; label: string }> = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "sms", label: "SMS" },
  { value: "postal", label: "Postal" },
  { value: "manual", label: "Manual follow-up" },
]

function createCommunicationDraft(): CommunicationDraft {
  return {
    occurredAt: toDateTimeLocalInputValue(new Date().toISOString()),
    channel: "email",
    direction: "outbound",
    subject: "",
    summary: "",
  }
}

function getStatusTone(status: TenancyApplicationStatus) {
  switch (status) {
    case "approved":
    case "approved_with_guarantor":
    case "active_tenant":
      return "bg-emerald-100 text-emerald-900"
    case "declined":
    case "withdrawn":
      return "bg-rose-100 text-rose-900"
    default:
      return "bg-amber-100 text-amber-900"
  }
}

function formatPreferredContactMethods(methods: TenancyApplicationRecord["applicantProfile"]["preferredContactMethods"] | undefined) {
  return methods && methods.length > 0 ? methods.join(", ") : "Not provided"
}

function formatAuditTimestamp(value?: string) {
  return value ? new Date(value).toLocaleString() : "Not recorded"
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

function formatDepositStatus(status: TenancyApplicationRecord["depositRecord"]["status"]) {
  return status.replaceAll("_", " ")
}

function AuditEventCard({ event }: { event: AuditEventRecord }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="font-semibold capitalize text-slate-900">{formatAuditAction(event.action)}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">{event.fieldPath ?? "application"}</div>
        </div>
        <div className="text-xs text-slate-500">
          {new Date(event.timestamp).toLocaleString()} · {event.performedBy}
        </div>
      </div>
      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        <div className="rounded-md bg-slate-50 px-3 py-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Before</div>
          <div className="mt-1 whitespace-pre-wrap wrap-break-word text-xs text-slate-700">{formatAuditValue(event.oldValue)}</div>
        </div>
        <div className="rounded-md bg-emerald-50 px-3 py-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">After</div>
          <div className="mt-1 whitespace-pre-wrap wrap-break-word text-xs text-emerald-900">{formatAuditValue(event.newValue)}</div>
        </div>
      </div>
    </article>
  )
}

export default function ApplicationReviewManager({
  initialApplications,
  initialAuditEventsByApplicationId,
  currentUserDisplayName,
  isAdmin = false,
  screeningScoreConfig,
  canRequestCreditReport = false,
}: ApplicationReviewManagerProps) {
  const [applications, setApplications] = useState(initialApplications)
  const [auditEventsByApplicationId, setAuditEventsByApplicationId] = useState(initialAuditEventsByApplicationId)
  const [feedback, setFeedback] = useState<FeedbackState>({})
  const [globalFeedback, setGlobalFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [communicationDrafts, setCommunicationDrafts] = useState<Record<string, CommunicationDraft>>({})
  const [siteVisitInviteLinksByApplicationId, setSiteVisitInviteLinksByApplicationId] = useState<Record<string, string>>({})
  const [expandedApplicationId, setExpandedApplicationId] = useState<string | null>(null)
  const [activeTabByApplicationId, setActiveTabByApplicationId] = useState<Record<string, ApplicationTab>>({})
  const [fullAuditApplicationId, setFullAuditApplicationId] = useState<string | null>(null)
  const [verificationUploadStateBySlot, setVerificationUploadStateBySlot] = useState<Record<string, boolean>>({})
  const [depositUploadStateBySlot, setDepositUploadStateBySlot] = useState<Record<string, boolean>>({})
  const verificationFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const depositFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [isPending, startTransition] = useTransition()
  const effectiveScreeningScoreConfig = normalizeApplicantScreeningScoreConfig(screeningScoreConfig)

  function getVerificationUploadSlot(applicationId: string, checklistKey: VerificationChecklistKey, documentId?: string) {
    return `${applicationId}:${checklistKey}:${documentId ?? "new"}`
  }

  function getVerificationDocumentDownloadHref(applicationId: string, documentId: string) {
    return `/api/applications/${applicationId}/verification-documents/${documentId}`
  }

  function getDepositUploadSlot(applicationId: string, category: DepositDocumentCategory, documentId?: string) {
    return `${applicationId}:${category}:${documentId ?? "new"}`
  }

  function getDepositDocumentDownloadHref(applicationId: string, documentId: string) {
    return `/api/applications/${applicationId}/deposit-documents/${documentId}`
  }

  async function runDepositAction(
    applicationId: string,
    body: Record<string, string | number | boolean | null | undefined>,
    fallbackMessage: string,
  ) {
    setFeedback((current) => ({ ...current, [applicationId]: null }))

    try {
      const response = await fetch(`/api/applications/${applicationId}/deposit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      const payload = (await response.json().catch(() => null)) as
        | {
            application?: TenancyApplicationRecord
            auditEvents?: AuditEventRecord[]
            error?: string
          }
        | null

      if (!response.ok || !payload?.application) {
        throw new Error(payload?.error || fallbackMessage)
      }

      const updatedApplication = payload.application

      setApplications((current) => current.map((candidate) => (candidate.id === updatedApplication.id ? updatedApplication : candidate)))

      if (payload.auditEvents) {
        setAuditEventsByApplicationId((current) => ({
          ...current,
          [updatedApplication.id]: payload.auditEvents ?? [],
        }))
      }

      setFeedback((current) => ({
        ...current,
        [applicationId]: { type: "success", message: fallbackMessage },
      }))
    } catch (error) {
      setFeedback((current) => ({
        ...current,
        [applicationId]: {
          type: "error",
          message: error instanceof Error ? error.message : fallbackMessage,
        },
      }))
    }
  }

  async function uploadDepositDocument(
    applicationId: string,
    category: DepositDocumentCategory,
    event: ChangeEvent<HTMLInputElement>,
    replaceDocumentId?: string,
  ) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const slot = getDepositUploadSlot(applicationId, category, replaceDocumentId)
    setDepositUploadStateBySlot((current) => ({ ...current, [slot]: true }))
    setFeedback((current) => ({ ...current, [applicationId]: null }))

    try {
      const formData = new FormData()
      formData.append("category", category)
      formData.append("file", file)
      if (replaceDocumentId) {
        formData.append("replaceDocumentId", replaceDocumentId)
      }

      const response = await fetch(`/api/applications/${applicationId}/deposit-documents`, {
        method: "POST",
        body: formData,
      })

      const payload = (await response.json().catch(() => null)) as
        | {
            application?: TenancyApplicationRecord
            message?: string
            error?: string
          }
        | null

      if (!response.ok || !payload?.application) {
        throw new Error(payload?.error || "Unable to upload deposit document.")
      }

      setApplications((current) => current.map((candidate) => (candidate.id === payload.application?.id ? payload.application : candidate)))
      setFeedback((current) => ({
        ...current,
        [applicationId]: { type: "success", message: payload.message || "Deposit document uploaded." },
      }))
    } catch (error) {
      setFeedback((current) => ({
        ...current,
        [applicationId]: {
          type: "error",
          message: error instanceof Error ? error.message : "Unable to upload deposit document.",
        },
      }))
    } finally {
      setDepositUploadStateBySlot((current) => ({ ...current, [slot]: false }))
      event.target.value = ""
    }
  }

  async function uploadVerificationDocument(
    applicationId: string,
    checklistKey: VerificationChecklistKey,
    event: ChangeEvent<HTMLInputElement>,
    replaceDocumentId?: string,
  ) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const slot = getVerificationUploadSlot(applicationId, checklistKey, replaceDocumentId)
    setVerificationUploadStateBySlot((current) => ({ ...current, [slot]: true }))
    setFeedback((current) => ({ ...current, [applicationId]: null }))

    try {
      const formData = new FormData()
      formData.append("category", checklistKey)
      formData.append("file", file)
      if (replaceDocumentId) {
        formData.append("replaceDocumentId", replaceDocumentId)
      }

      const response = await fetch(`/api/applications/${applicationId}/verification-documents`, {
        method: "POST",
        body: formData,
      })

      const payload = (await response.json().catch(() => null)) as
        | {
            application?: TenancyApplicationRecord
            auditEvents?: AuditEventRecord[]
            message?: string
            error?: string
          }
        | null

      if (!response.ok || !payload?.application) {
        throw new Error(payload?.error || "Unable to upload verification document.")
      }

      const updatedApplication = payload.application

      setApplications((current) =>
        current.map((candidate) => (candidate.id === updatedApplication.id ? updatedApplication : candidate)),
      )

      if (payload.auditEvents) {
        const updatedAuditEvents = payload.auditEvents
        setAuditEventsByApplicationId((current) => ({
          ...current,
          [updatedApplication.id]: updatedAuditEvents,
        }))
      }

      setFeedback((current) => ({
        ...current,
        [applicationId]: {
          type: "success",
          message: payload.message || (replaceDocumentId ? "Verification document replaced." : "Verification document uploaded."),
        },
      }))
    } catch (error) {
      setFeedback((current) => ({
        ...current,
        [applicationId]: {
          type: "error",
          message: error instanceof Error ? error.message : "Unable to upload verification document.",
        },
      }))
    } finally {
      setVerificationUploadStateBySlot((current) => ({ ...current, [slot]: false }))
      event.target.value = ""
    }
  }

  function deleteVerificationDocument(applicationId: string, documentId: string) {
    setFeedback((current) => ({ ...current, [applicationId]: null }))

    startTransition(async () => {
      try {
        const response = await fetch(`/api/applications/${applicationId}/verification-documents/${documentId}`, {
          method: "DELETE",
        })

        const payload = (await response.json().catch(() => null)) as
          | {
              application?: TenancyApplicationRecord
              auditEvents?: AuditEventRecord[]
              message?: string
              failedCount?: number
              error?: string
            }
          | null

        if (!response.ok || !payload?.application) {
          throw new Error(payload?.error || "Unable to delete verification document.")
        }

        const updatedApplication = payload.application

        setApplications((current) =>
          current.map((candidate) => (candidate.id === updatedApplication.id ? updatedApplication : candidate)),
        )

        if (payload.auditEvents) {
          const updatedAuditEvents = payload.auditEvents
          setAuditEventsByApplicationId((current) => ({
            ...current,
            [updatedApplication.id]: updatedAuditEvents,
          }))
        }

        setFeedback((current) => ({
          ...current,
          [applicationId]: {
            type: "success",
            message: payload.message || "Verification document deleted.",
          },
        }))
      } catch (error) {
        setFeedback((current) => ({
          ...current,
          [applicationId]: {
            type: "error",
            message: error instanceof Error ? error.message : "Unable to delete verification document.",
          },
        }))
      }
    })
  }

  function formatScore(value: number) {
    return value > 0 ? `+${value}` : String(value)
  }

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
          auditEvents?: AuditEventRecord[]
          error?: string
        }

        if (!response.ok || !payload.application) {
          throw new Error(payload.error || "Unable to save the application.")
        }

        const updatedApplication = payload.application

        setApplications((current) =>
          current.map((candidate) => (candidate.id === updatedApplication.id ? updatedApplication : candidate)),
        )
        if (payload.auditEvents) {
          const updatedAuditEvents = payload.auditEvents
          setAuditEventsByApplicationId((current) => ({
            ...current,
            [updatedApplication.id]: updatedAuditEvents,
          }))
        }
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

  async function copySiteVisitInviteLink(applicationId: string) {
    const link = siteVisitInviteLinksByApplicationId[applicationId]?.trim()

    if (!link) {
      setFeedback((current) => ({
        ...current,
        [applicationId]: {
          type: "error",
          message: "No invite link is available yet. Send or resend invite first.",
        },
      }))
      return
    }

    if (!navigator?.clipboard?.writeText) {
      setFeedback((current) => ({
        ...current,
        [applicationId]: {
          type: "error",
          message: "Clipboard access is unavailable in this browser.",
        },
      }))
      return
    }

    try {
      await navigator.clipboard.writeText(link)
      setFeedback((current) => ({
        ...current,
        [applicationId]: {
          type: "success",
          message: "Invite link copied to clipboard.",
        },
      }))
    } catch {
      setFeedback((current) => ({
        ...current,
        [applicationId]: {
          type: "error",
          message: "Unable to copy invite link to clipboard.",
        },
      }))
    }
  }

  function toggleApplication(applicationId: string) {
    setExpandedApplicationId((current) => (current === applicationId ? null : applicationId))
  }

  function setApplicationTab(applicationId: string, tab: ApplicationTab) {
    setActiveTabByApplicationId((current) => ({ ...current, [applicationId]: tab }))
  }

  function requestCreditReport(applicationId: string) {
    setFeedback((current) => ({ ...current, [applicationId]: null }))

    startTransition(async () => {
      try {
        const response = await fetch(`/api/applications/${applicationId}/credit-report`, {
          method: "POST",
        })

        const payload = (await response.json().catch(() => null)) as
          | {
              application?: TenancyApplicationRecord
              auditEvents?: AuditEventRecord[]
              message?: string
              alreadyRequested?: boolean
              error?: string
            }
          | null

        if (!response.ok || !payload?.application) {
          throw new Error(payload?.error || "Unable to request credit report.")
        }

        const updatedApplication = payload.application

        setApplications((current) =>
          current.map((candidate) => (candidate.id === updatedApplication.id ? updatedApplication : candidate)),
        )

        if (payload.auditEvents) {
          const updatedAuditEvents = payload.auditEvents
          setAuditEventsByApplicationId((current) => ({
            ...current,
            [updatedApplication.id]: updatedAuditEvents,
          }))
        }

        setFeedback((current) => ({
          ...current,
          [applicationId]: {
            type: "success",
            message:
              payload.message ||
              "Credit report request submitted. The report will be ready in 24 hours and an email has been sent to mike@solutionsdeveloped.co.uk.",
          },
        }))
      } catch (error) {
        setFeedback((current) => ({
          ...current,
          [applicationId]: {
            type: "error",
            message: error instanceof Error ? error.message : "Unable to request credit report.",
          },
        }))
      }
    })
  }

  function addRefereeContact(applicationId: string) {
    updateApplication(applicationId, (current) => ({
      ...current,
      referencingInstruction: {
        ...current.referencingInstruction,
        referees: [...(current.referencingInstruction.referees ?? []), createEmptyRefereeContact()],
      },
    }))
  }

  function updateRefereeContact(
    applicationId: string,
    refereeId: string,
    field: keyof TenancyRefereeContact,
    value: string | boolean,
  ) {
    updateApplication(applicationId, (current) => ({
      ...current,
      referencingInstruction: {
        ...current.referencingInstruction,
        referees: (current.referencingInstruction.referees ?? []).map((referee) =>
          referee.id === refereeId ? { ...referee, [field]: value } : referee,
        ),
      },
    }))
  }

  function removeRefereeContact(applicationId: string, refereeId: string) {
    updateApplication(applicationId, (current) => ({
      ...current,
      referencingInstruction: {
        ...current.referencingInstruction,
        referees: (current.referencingInstruction.referees ?? []).filter((referee) => referee.id !== refereeId),
      },
    }))
  }

  function requestGuarantorReferences(
    application: TenancyApplicationRecord,
    options?: {
      forceResend?: boolean
    },
  ) {
    const applicationId = application.id
    const forceResend = options?.forceResend === true
    setFeedback((current) => ({ ...current, [applicationId]: null }))

    startTransition(async () => {
      try {
        const persistResponse = await fetch(`/api/applications/${applicationId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
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

        const persistPayload = (await persistResponse.json().catch(() => null)) as
          | {
              application?: TenancyApplicationRecord
              error?: string
            }
          | null

        if (!persistResponse.ok || !persistPayload?.application) {
          throw new Error(persistPayload?.error || "Save guarantor contacts before sending requests.")
        }

        const response = await fetch(`/api/applications/${applicationId}/guarantor-reference-requests`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ forceResend }),
        })

        const payload = (await response.json().catch(() => null)) as
          | {
              application?: TenancyApplicationRecord
              auditEvents?: AuditEventRecord[]
              message?: string
              error?: string
              alreadyRequested?: boolean
              resentCount?: number
              failedCount?: number
            }
          | null

        if (!response.ok || !payload?.application) {
          throw new Error(payload?.error || "Unable to send guarantor reference requests.")
        }

        const updatedApplication = payload.application

        setApplications((current) =>
          current.map((candidate) => (candidate.id === updatedApplication.id ? updatedApplication : candidate)),
        )

        if (payload.auditEvents) {
          const updatedAuditEvents = payload.auditEvents
          setAuditEventsByApplicationId((current) => ({
            ...current,
            [updatedApplication.id]: updatedAuditEvents,
          }))
        }

        setFeedback((current) => ({
          ...current,
          [applicationId]: {
            type: payload.failedCount && payload.failedCount > 0 ? "error" : "success",
            message: payload.message || (forceResend ? "Guarantor approval requests resent." : "Guarantor approval requests submitted."),
          },
        }))
      } catch (error) {
        setFeedback((current) => ({
          ...current,
          [applicationId]: {
            type: "error",
            message: error instanceof Error ? error.message : "Unable to send guarantor approval requests.",
          },
        }))
      }
    })
  }

  function requestSiteVisitInvite(
    application: TenancyApplicationRecord,
    options?: {
      forceResend?: boolean
    },
  ) {
    const applicationId = application.id
    const forceResend = options?.forceResend === true
    setFeedback((current) => ({ ...current, [applicationId]: null }))

    startTransition(async () => {
      try {
        const persistResponse = await fetch(`/api/applications/${applicationId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
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

        const persistPayload = (await persistResponse.json().catch(() => null)) as
          | {
              application?: TenancyApplicationRecord
              error?: string
            }
          | null

        if (!persistResponse.ok || !persistPayload?.application) {
          throw new Error(persistPayload?.error || "Save the site visit schedule before sending the invite.")
        }

        const response = await fetch(`/api/applications/${applicationId}/site-visit-invite`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ forceResend }),
        })

        const payload = (await response.json().catch(() => null)) as
          | {
              application?: TenancyApplicationRecord
              auditEvents?: AuditEventRecord[]
              message?: string
              error?: string
              failedCount?: number
              confirmationUrl?: string
            }
          | null

        if (!response.ok || !payload?.application) {
          throw new Error(payload?.error || "Unable to send site visit invite.")
        }

        const updatedApplication = payload.application

        setApplications((current) =>
          current.map((candidate) => (candidate.id === updatedApplication.id ? updatedApplication : candidate)),
        )

        if (payload.auditEvents) {
          const updatedAuditEvents = payload.auditEvents
          setAuditEventsByApplicationId((current) => ({
            ...current,
            [updatedApplication.id]: updatedAuditEvents,
          }))
        }

        if (payload.confirmationUrl) {
          setSiteVisitInviteLinksByApplicationId((current) => ({
            ...current,
            [updatedApplication.id]: payload.confirmationUrl as string,
          }))
        }

        setFeedback((current) => ({
          ...current,
          [applicationId]: {
            type: payload.failedCount && payload.failedCount > 0 ? "error" : "success",
            message: payload.message || (forceResend ? "Site visit invite email resent." : "Site visit invite email sent."),
          },
        }))
      } catch (error) {
        setFeedback((current) => ({
          ...current,
          [applicationId]: {
            type: "error",
            message: error instanceof Error ? error.message : "Unable to send site visit invite.",
          },
        }))
      }
    })
  }

  function deleteApplicationPermanently(applicationId: string) {
    if (!isAdmin) {
      return
    }

    const shouldDelete = window.confirm(
      "Delete this application permanently? This cannot be undone and is intended for dev/testing use only.",
    )

    if (!shouldDelete) {
      return
    }

    setGlobalFeedback(null)

    startTransition(async () => {
      try {
        const response = await fetch(`/api/applications/${applicationId}`, {
          method: "DELETE",
        })

        const payload = (await response.json().catch(() => null)) as
          | {
              message?: string
              deletedApplicationId?: string
              error?: string
            }
          | null

        if (!response.ok) {
          throw new Error(payload?.error || "Unable to delete application.")
        }

        setApplications((current) => current.filter((application) => application.id !== applicationId))
        setAuditEventsByApplicationId((current) => {
          const next = { ...current }
          delete next[applicationId]
          return next
        })
        setExpandedApplicationId((current) => (current === applicationId ? null : current))
        setFullAuditApplicationId((current) => (current === applicationId ? null : current))
        setGlobalFeedback({
          type: "success",
          message: payload?.message || "Application deleted.",
        })
      } catch (error) {
        setGlobalFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Unable to delete application.",
        })
      }
    })
  }

  const fullAuditApplication = fullAuditApplicationId
    ? applications.find((application) => application.id === fullAuditApplicationId) ?? null
    : null
  const fullAuditEvents = fullAuditApplication ? auditEventsByApplicationId[fullAuditApplication.id] ?? [] : []

  function getCommunicationDraft(applicationId: string) {
    return communicationDrafts[applicationId] ?? createCommunicationDraft()
  }

  function updateCommunicationDraft<Key extends keyof CommunicationDraft>(
    applicationId: string,
    field: Key,
    value: CommunicationDraft[Key],
  ) {
    setCommunicationDrafts((current) => ({
      ...current,
      [applicationId]: {
        ...(current[applicationId] ?? createCommunicationDraft()),
        [field]: value,
      },
    }))
  }

  function addCommunicationEntry(application: TenancyApplicationRecord) {
    const draft = getCommunicationDraft(application.id)

    if (!draft.subject.trim() || !draft.summary.trim()) {
      setFeedback((current) => ({
        ...current,
        [application.id]: { type: "error", message: "Enter both a communication subject and summary before adding the entry." },
      }))
      return
    }

    const nextEntry: TenantCommunicationEntry = {
      id: `${application.id}-${Date.now()}`,
      occurredAt: draft.occurredAt ? new Date(draft.occurredAt).toISOString() : new Date().toISOString(),
      channel: draft.channel,
      direction: draft.direction,
      subject: draft.subject.trim(),
      summary: draft.summary.trim(),
      recordedByName: currentUserDisplayName,
    }

    updateApplication(application.id, (current) => ({
      ...current,
      postMoveInManagement: {
        ...current.postMoveInManagement,
        communicationLogNotes: "",
        communicationEntries: [nextEntry, ...current.postMoveInManagement.communicationEntries].sort(
          (left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
        ),
      },
    }))

    setCommunicationDrafts((current) => ({
      ...current,
      [application.id]: createCommunicationDraft(),
    }))
    setFeedback((current) => ({
      ...current,
      [application.id]: { type: "success", message: "Communication entry added locally. Save workflow to persist it." },
    }))
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Applications</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Tenancy pipeline review</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Review applicant details, collect referencing evidence, document the decision, and carry the tenancy through to deposit protection and post move-in logging.
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Applications in pipeline</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{applications.length}</div>
          </div>
        </div>
      </section>

      {globalFeedback ? (
        <section
          className={`rounded-xl border px-4 py-3 text-sm ${
            globalFeedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {globalFeedback.message}
        </section>
      ) : null}

      {applications.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600 shadow-sm">
          No applications have been submitted yet.
        </section>
      ) : (
        applications.map((application) => {
          const isExpanded = expandedApplicationId === application.id
          const activeTab = activeTabByApplicationId[application.id] ?? "applicant"
          const pipelineStepIndex = getPipelineStepIndex(application.status)
          const auditEvents = auditEventsByApplicationId[application.id] ?? []
          const communicationDraft = getCommunicationDraft(application.id)
          const screeningScore = calculateApplicantScreeningScore(application, effectiveScreeningScoreConfig)
          const referees = application.referencingInstruction.referees ?? []
          const referenceRequests = application.referencingInstruction.referenceRequests ?? []
          const siteVisitStatus =
            application.preMoveInCompliance.siteVisit?.status ??
            (application.preMoveInCompliance.checkInScheduled ? "scheduled" : "not_scheduled")
          const siteVisitScheduledAt = application.preMoveInCompliance.siteVisit?.scheduledAt ?? ""
          const siteVisitCompletedAt = application.preMoveInCompliance.siteVisit?.completedAt ?? ""
          const siteVisitAssigneeName = application.preMoveInCompliance.siteVisit?.assigneeName ?? ""
          const siteVisitNotes = application.preMoveInCompliance.siteVisit?.notes ?? ""
          const siteVisitInviteStatus = application.preMoveInCompliance.siteVisit?.inviteStatus ?? "not_sent"
          const siteVisitInviteSentAt = application.preMoveInCompliance.siteVisit?.inviteSentAt ?? ""
          const siteVisitInviteRespondedAt = application.preMoveInCompliance.siteVisit?.inviteRespondedAt ?? ""
          const siteVisitInviteLastError = application.preMoveInCompliance.siteVisit?.inviteLastError ?? ""
          const siteVisitAlternativeSuggestedAt = application.preMoveInCompliance.siteVisit?.alternativeSuggestedAt ?? ""
          const siteVisitInviteRecipientEmail = application.applicantEmail?.trim() ?? ""
          const siteVisitConfirmationUrl = siteVisitInviteLinksByApplicationId[application.id] ?? ""
          const latestRequestByRefereeId = new Map<string, TenancyReferenceRequest>()

          for (const request of referenceRequests) {
            const current = latestRequestByRefereeId.get(request.refereeId)
            const currentRequestedAt = current ? Date.parse(current.requestedAt) : Number.NEGATIVE_INFINITY
            const candidateRequestedAt = Date.parse(request.requestedAt)

            if (!current || candidateRequestedAt >= currentRequestedAt) {
              latestRequestByRefereeId.set(request.refereeId, request)
            }
          }

          const latestRequests = referees
            .map((referee) => latestRequestByRefereeId.get(referee.id))
            .filter((request): request is TenancyReferenceRequest => Boolean(request))

          const signedOffCount = latestRequests.filter((request) => request.status === "completed").length
          const declinedCount = latestRequests.filter((request) => request.status === "declined").length
          const creditReportAlreadyRequested = Boolean(application.referencingReport.creditReportRequest?.requested)
          const guarantorApprovalAlreadyRequested = Boolean(
            (application.referencingInstruction.referenceRequests ?? []).some(
              (request) => request.status !== "failed" && request.status !== "declined" && request.status !== "not_requested",
            ),
          )

          return (
          <section key={application.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">{application.applicantName}</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">{application.propertyAddress}</h2>
                <p className="mt-2 text-sm text-slate-600">
                  {application.applicantEmail} · £{application.monthlyRent.toLocaleString()}/month · submitted {new Date(application.submittedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getStatusTone(application.status)}`}>
                  {application.status.replaceAll("_", " ")}
                </div>
                <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getSiteVisitTone(siteVisitStatus)}`}>
                  Site visit {formatSiteVisitStatus(siteVisitStatus)}
                </div>
                <a
                  href={`/dashboard/documents?applicationId=${encodeURIComponent(application.id)}`}
                  className="rounded-md border border-cyan-300 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-800 hover:bg-cyan-100"
                >
                  View application documents
                </a>
                {isAdmin ? (
                  <button
                    type="button"
                    className="rounded-md border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                    onClick={() => deleteApplicationPermanently(application.id)}
                    disabled={isPending}
                  >
                    Delete permanently
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                  aria-label={isExpanded ? "Collapse panel" : "Expand panel"}
                  onClick={() => toggleApplication(application.id)}
                >
                  <span className={`inline-block text-[2.5rem] leading-none transition-transform ${isExpanded ? "rotate-0" : "-rotate-90"}`}>▾</span>
                </button>
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

            {isExpanded ? (
              <>

            <nav className="mt-6 overflow-x-auto border-b border-slate-200" aria-label={`Application sections for ${application.applicantName}`}>
              <div className="flex min-w-max gap-1" role="tablist">
                {applicationTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    className={`border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
                      activeTab === tab.id
                        ? "border-cyan-700 text-cyan-800"
                        : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                    }`}
                    aria-selected={activeTab === tab.id}
                    onClick={() => setApplicationTab(application.id, tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </nav>

            <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 lg:col-span-2 xl:col-span-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Pipeline progress</div>
                          <div className="mt-1 text-sm font-semibold capitalize text-slate-900">{application.status.replaceAll("_", " ")}</div>
                        </div>
                        <details className="relative">
                          <summary className="cursor-pointer list-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                            Change status
                          </summary>
                          <div className="absolute right-0 z-10 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Pipeline status
                              <select
                                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-sky-500"
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
                          </div>
                        </details>
                      </div>
                      <ol className="mt-5 grid gap-3 sm:grid-cols-6" aria-label="Application pipeline progress">
                        {pipelineSteps.map((step, index) => {
                          const isCurrent = index === pipelineStepIndex
                          const isComplete = index < pipelineStepIndex

                          return (
                            <li key={step.id} className="flex items-center gap-2 sm:block">
                              <div
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                  isCurrent
                                    ? "bg-cyan-700 text-white"
                                    : isComplete
                                      ? "bg-emerald-600 text-white"
                                      : "bg-slate-200 text-slate-500"
                                }`}
                              >
                                {isComplete ? "OK" : index + 1}
                              </div>
                              <div className={`mt-2 text-xs font-semibold ${isCurrent ? "text-cyan-800" : isComplete ? "text-emerald-800" : "text-slate-500"}`}>
                                {step.label}
                              </div>
                            </li>
                          )
                        })}
                      </ol>
                          </section>

              <section className={`rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 lg:col-span-2 xl:col-span-3 ${activeTab === "applicant" || activeTab === "application" ? "" : "hidden"}`}>
                <div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500 whitespace-nowrap">Applicant profile screening table</div>
                    <div className="mt-1 text-xs text-slate-500 whitespace-nowrap">
                      Preferred contact: {formatPreferredContactMethods(application.applicantProfile.preferredContactMethods)}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-nowrap items-stretch justify-end gap-2 overflow-x-auto">
                    {canRequestCreditReport ? (
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 md:min-w-60 whitespace-nowrap"
                        onClick={() => requestCreditReport(application.id)}
                        disabled={isPending || creditReportAlreadyRequested}
                      >
                        {creditReportAlreadyRequested ? "Credit report requested" : "Request credit score and report"}
                      </button>
                    ) : null}
                    <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 shadow-sm md:min-w-60">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Screening score</div>
                      <div className="text-xl font-semibold text-slate-900">{formatScore(screeningScore.totalScore)}</div>
                    </div>
                  </div>

                  {application.referencingReport.creditReportRequest?.requested ? (
                    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                      Credit report requested
                      {application.referencingReport.creditReportRequest.requestedAt
                        ? ` on ${new Date(application.referencingReport.creditReportRequest.requestedAt).toLocaleString()}`
                        : ""}
                      . The report is expected within 24 hours.
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full table-fixed divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                      <tr>
                        <th className="w-4/12 px-3 py-2 text-left font-semibold">Criterion</th>
                        <th className="w-6/12 px-3 py-2 text-left font-semibold">Applicant value</th>
                        <th className="w-2/12 px-3 py-2 text-right font-semibold">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {screeningScore.rows.map((row) => (
                        <tr key={row.key}>
                          <td className="px-3 py-2 text-slate-700">{row.criterion}</td>
                          <td className="px-3 py-2 text-slate-600 wrap-break-word">{row.value}</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-900">{formatScore(row.score)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3">
                  <label className="block text-sm font-medium text-slate-700">
                    Credit report score (manual)
                  </label>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      className="min-w-40 flex-1 rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
                      type="number"
                      aria-label="Credit report score manual input"
                      title="Credit report score manual input"
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
                    <button
                      type="button"
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                      onClick={() => saveApplication(application)}
                      disabled={isPending}
                    >
                      Save credit score
                    </button>
                  </div>
                  <span className="mt-2 block text-xs text-slate-500">
                    Enter this manually after reviewing the returned credit report, then save.
                  </span>
                </div>
              </section>
            </div>

            <div className={`mt-6 ${activeTab === "applicant" ? "" : "hidden"}`}>
              <section className={`rounded-xl border border-slate-200 p-4 ${activeTab === "siteVisit" ? "" : "hidden"}`}>
                <h3 className="text-lg font-semibold text-slate-900">Applicant verification</h3>
                <div className="mt-4 space-y-3">
                  {verificationChecklistOptions.map((option) => {
                    const uploadSlot = getVerificationUploadSlot(application.id, option.key)
                    const isUploading = Boolean(verificationUploadStateBySlot[uploadSlot])
                    const isMarkedNotRequired = Boolean(application.referencingInstruction.verificationNotRequired?.[option.key])
                    const uploadedDocuments = (application.referencingInstruction.verificationDocuments ?? []).filter(
                      (document) => document.category === option.key,
                    )

                    return (
                      <div key={option.key} className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                        <div className="grid items-center gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                          <label className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={Boolean(application.referencingInstruction[option.key])}
                              disabled={isMarkedNotRequired}
                              onChange={(event) =>
                                updateApplication(application.id, (current) => ({
                                  ...current,
                                  referencingInstruction: {
                                    ...current.referencingInstruction,
                                    [option.key]: event.target.checked,
                                  },
                                }))
                              }
                            />
                            {option.label}
                          </label>
                          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                            <input
                              type="checkbox"
                              checked={isMarkedNotRequired}
                              onChange={(event) =>
                                updateApplication(application.id, (current) => ({
                                  ...current,
                                  referencingInstruction: {
                                    ...current.referencingInstruction,
                                    [option.key]: event.target.checked ? false : Boolean(current.referencingInstruction[option.key]),
                                    verificationNotRequired: {
                                      ...((current.referencingInstruction.verificationNotRequired ?? {
                                        noIdRequired: false,
                                        photoIdReceived: false,
                                        proofOfAddressReceived: false,
                                        creditReferenceCheckReceived: false,
                                        previousLandlordReferenceReceived: false,
                                        incomeEvidenceReceived: false,
                                      }) as NonNullable<TenancyApplicationRecord["referencingInstruction"]["verificationNotRequired"]>),
                                      [option.key]: event.target.checked,
                                    },
                                  },
                                }))
                              }
                            />
                            Not required
                          </label>
                          <input
                            ref={(node) => {
                              verificationFileInputRefs.current[uploadSlot] = node
                            }}
                            type="file"
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv"
                            onChange={(event) => uploadVerificationDocument(application.id, option.key, event)}
                            aria-label={`Upload ${option.label} document`}
                          />
                          <button
                            type="button"
                            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 md:min-w-28"
                            onClick={() => verificationFileInputRefs.current[uploadSlot]?.click()}
                            disabled={isPending || isUploading || isMarkedNotRequired}
                          >
                            {isUploading ? "Uploading..." : "Upload file"}
                          </button>
                        </div>

                        {isMarkedNotRequired ? (
                          <div className="mt-2 text-xs font-semibold text-amber-700">Marked as not required.</div>
                        ) : null}

                        {uploadedDocuments.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {uploadedDocuments.map((document) => {
                              const replaceSlot = getVerificationUploadSlot(application.id, option.key, document.id)
                              const isReplacing = Boolean(verificationUploadStateBySlot[replaceSlot])

                              return (
                                <div key={document.id} className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-2 py-1">
                                  <a
                                    href={getVerificationDocumentDownloadHref(application.id, document.id)}
                                    className="text-xs text-slate-700 hover:underline"
                                  >
                                    {document.fileName}
                                  </a>
                                  <input
                                    ref={(node) => {
                                      verificationFileInputRefs.current[replaceSlot] = node
                                    }}
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv"
                                    onChange={(event) => uploadVerificationDocument(application.id, option.key, event, document.id)}
                                    aria-label={`Replace ${document.fileName}`}
                                  />
                                  <button
                                    type="button"
                                    className="text-xs font-semibold text-sky-700 hover:underline disabled:opacity-60"
                                    onClick={() => verificationFileInputRefs.current[replaceSlot]?.click()}
                                    disabled={isPending || isReplacing}
                                  >
                                    {isReplacing ? "Replacing..." : "Replace"}
                                  </button>
                                  <button
                                    type="button"
                                    className="text-xs font-semibold text-rose-700 hover:underline disabled:opacity-60"
                                    onClick={() => deleteVerificationDocument(application.id, document.id)}
                                    disabled={isPending}
                                  >
                                    Delete
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-slate-500">No files uploaded yet.</div>
                        )}
                      </div>
                    )
                  })}
                </div>

              </section>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <section className={`rounded-xl border border-slate-200 p-4 ${activeTab === "application" || activeTab === "deposit" ? "" : "hidden"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-slate-900">Schedule site visit</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${getSiteVisitTone(siteVisitStatus)}`}>
                      {formatSiteVisitStatus(siteVisitStatus)}
                    </span>
                    <button
                      type="button"
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                      onClick={() => saveApplication(application)}
                      disabled={isPending}
                    >
                      {isPending ? "Saving..." : "Save site visit"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Site visit status
                    <select
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      value={siteVisitStatus}
                      onChange={(event) => {
                        const nextStatus = event.target.value as TenancyApplicationRecord["preMoveInCompliance"]["siteVisit"]["status"]

                        updateApplication(application.id, (current) => ({
                          ...current,
                          preMoveInCompliance: {
                            ...current.preMoveInCompliance,
                            checkInScheduled: nextStatus === "scheduled" || nextStatus === "completed",
                            siteVisit: {
                              ...(current.preMoveInCompliance.siteVisit ?? {
                                status: "not_scheduled",
                                assigneeName: "",
                                notes: "",
                                inviteStatus: "not_sent",
                              }),
                              status: nextStatus,
                              completedAt:
                                nextStatus === "completed"
                                  ? current.preMoveInCompliance.siteVisit?.completedAt || new Date().toISOString()
                                  : undefined,
                            },
                          },
                        }))
                      }}
                    >
                      <option value="not_scheduled">Not scheduled</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="completed">Completed</option>
                      <option value="no_access">No access</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Assigned to
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      value={siteVisitAssigneeName}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          preMoveInCompliance: {
                            ...current.preMoveInCompliance,
                            siteVisit: {
                              ...(current.preMoveInCompliance.siteVisit ?? {
                                status: "not_scheduled",
                                assigneeName: "",
                                notes: "",
                                inviteStatus: "not_sent",
                              }),
                              assigneeName: event.target.value,
                            },
                          },
                        }))
                      }
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Scheduled for
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      type="datetime-local"
                      value={toDateTimeLocalInputValue(siteVisitScheduledAt)}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          preMoveInCompliance: {
                            ...current.preMoveInCompliance,
                            checkInScheduled: Boolean(event.target.value) || current.preMoveInCompliance.checkInScheduled,
                            siteVisit: {
                              ...(current.preMoveInCompliance.siteVisit ?? {
                                status: "not_scheduled",
                                assigneeName: "",
                                notes: "",
                                inviteStatus: "not_sent",
                              }),
                              scheduledAt: fromDateTimeLocalInputValue(event.target.value),
                              status:
                                event.target.value && current.preMoveInCompliance.siteVisit?.status === "not_scheduled"
                                  ? "scheduled"
                                  : (current.preMoveInCompliance.siteVisit?.status ?? "not_scheduled"),
                            },
                          },
                        }))
                      }
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Completed at
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      type="datetime-local"
                      value={toDateTimeLocalInputValue(siteVisitCompletedAt)}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          preMoveInCompliance: {
                            ...current.preMoveInCompliance,
                            checkInScheduled: current.preMoveInCompliance.checkInScheduled || Boolean(event.target.value),
                            siteVisit: {
                              ...(current.preMoveInCompliance.siteVisit ?? {
                                status: "not_scheduled",
                                assigneeName: "",
                                notes: "",
                                inviteStatus: "not_sent",
                              }),
                              completedAt: fromDateTimeLocalInputValue(event.target.value),
                              status: event.target.value ? "completed" : (current.preMoveInCompliance.siteVisit?.status ?? "not_scheduled"),
                            },
                          },
                        }))
                      }
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                    Site visit notes
                    <textarea
                      className="mt-2 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2"
                      value={siteVisitNotes}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          preMoveInCompliance: {
                            ...current.preMoveInCompliance,
                            siteVisit: {
                              ...(current.preMoveInCompliance.siteVisit ?? {
                                status: "not_scheduled",
                                assigneeName: "",
                                notes: "",
                                inviteStatus: "not_sent",
                              }),
                              notes: event.target.value,
                            },
                          },
                        }))
                      }
                    />
                  </label>
                </div>

                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Invite status: <strong className={getSiteVisitInviteTone(siteVisitInviteStatus)}>{formatSiteVisitInviteStatus(siteVisitInviteStatus)}</strong>
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-60"
                        onClick={() => requestSiteVisitInvite(application)}
                        disabled={isPending || !siteVisitScheduledAt}
                      >
                        Send invite email
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                        onClick={() => requestSiteVisitInvite(application, { forceResend: true })}
                        disabled={isPending || !siteVisitScheduledAt || siteVisitInviteStatus === "not_sent"}
                      >
                        Resend invite
                      </button>
                    </div>
                  </div>

                  <div className="mt-2">Invite recipient: {siteVisitInviteRecipientEmail || "No applicant email"}</div>

                  {siteVisitInviteSentAt ? (
                    <div className="mt-2">Invite sent: {new Date(siteVisitInviteSentAt).toLocaleString()}</div>
                  ) : null}
                  {siteVisitConfirmationUrl ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <a
                        className="rounded-md border border-cyan-300 bg-white px-2.5 py-1 font-semibold text-cyan-800 hover:bg-cyan-50"
                        href={siteVisitConfirmationUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open invite page
                      </a>
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-100"
                        onClick={() => {
                          void copySiteVisitInviteLink(application.id)
                        }}
                      >
                        Copy invite link
                      </button>
                    </div>
                  ) : null}
                  {siteVisitInviteRespondedAt ? (
                    <div className="mt-1">Applicant responded: {new Date(siteVisitInviteRespondedAt).toLocaleString()}</div>
                  ) : null}
                  {siteVisitAlternativeSuggestedAt ? (
                    <div className="mt-1">Alternative suggested: {new Date(siteVisitAlternativeSuggestedAt).toLocaleString()}</div>
                  ) : null}
                  {siteVisitInviteLastError ? <div className="mt-1 text-rose-700">Last error: {siteVisitInviteLastError}</div> : null}
                  {!siteVisitScheduledAt ? <div className="mt-1 text-amber-700">Set a scheduled time before sending the invite.</div> : null}
                </div>
              </section>

              <section className={`rounded-xl border border-slate-200 p-4 ${activeTab === "lease" || activeTab === "correspondence" ? "" : "hidden"}`}>
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

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">Guarantor checks</h4>
                        <p className="mt-1 text-xs text-slate-500">
                          Capture guarantor contact details and complete checks before requesting approval to act as guarantor.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        onClick={() => addRefereeContact(application.id)}
                        disabled={isPending}
                      >
                        Add guarantor contact
                      </button>
                    </div>

                    <div className="mt-3 space-y-3">
                      {signedOffCount > 0 || declinedCount > 0 ? (
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                          {signedOffCount > 0 ? `${signedOffCount} guarantor declaration approval${signedOffCount > 1 ? "s" : ""} recorded.` : ""}
                          {signedOffCount > 0 && declinedCount > 0 ? " " : ""}
                          {declinedCount > 0 ? `${declinedCount} guarantor declaration response${declinedCount > 1 ? "s" : ""} declined.` : ""}
                        </div>
                      ) : null}

                      {referees.map((referee) => {
                        const latestRequest = latestRequestByRefereeId.get(referee.id)

                        return (
                          <div key={referee.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                              <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                                Guarantor contact name
                                <input
                                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                                  value={referee.fullName}
                                  onChange={(event) => updateRefereeContact(application.id, referee.id, "fullName", event.target.value)}
                                />
                              </label>
                              <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                                Relationship to applicant
                                <input
                                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                                  value={referee.relationship}
                                  onChange={(event) =>
                                    updateRefereeContact(application.id, referee.id, "relationship", event.target.value)
                                  }
                                />
                              </label>
                              <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                                Contact channel
                                <select
                                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                                  value={referee.preferredChannel}
                                  onChange={(event) =>
                                    updateRefereeContact(
                                      application.id,
                                      referee.id,
                                      "preferredChannel",
                                      event.target.value as RefereeRequestChannel,
                                    )
                                  }
                                >
                                  {refereeChannelOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                                Email
                                <input
                                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                                  type="email"
                                  value={referee.email ?? ""}
                                  onChange={(event) => updateRefereeContact(application.id, referee.id, "email", event.target.value)}
                                />
                              </label>
                              <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                                Phone
                                <input
                                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                                  value={referee.phone ?? ""}
                                  onChange={(event) => updateRefereeContact(application.id, referee.id, "phone", event.target.value)}
                                />
                              </label>
                              <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 md:col-span-2 xl:col-span-1">
                                Postal address
                                <input
                                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                                  value={referee.postalAddress ?? ""}
                                  onChange={(event) =>
                                    updateRefereeContact(application.id, referee.id, "postalAddress", event.target.value)
                                  }
                                />
                              </label>
                            </div>
                            <div className="mt-3 grid gap-2 md:grid-cols-3">
                              <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={Boolean(referee.relationshipToApplicantConfirmed)}
                                  onChange={(event) =>
                                    updateRefereeContact(
                                      application.id,
                                      referee.id,
                                      "relationshipToApplicantConfirmed",
                                      event.target.checked,
                                    )
                                  }
                                />
                                Relationship confirmed
                              </label>
                              <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={Boolean(referee.idDocumentCheckComplete)}
                                  onChange={(event) =>
                                    updateRefereeContact(application.id, referee.id, "idDocumentCheckComplete", event.target.checked)
                                  }
                                />
                                ID document checked
                              </label>
                              <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={Boolean(referee.proofOfAddressCheckComplete)}
                                  onChange={(event) =>
                                    updateRefereeContact(
                                      application.id,
                                      referee.id,
                                      "proofOfAddressCheckComplete",
                                      event.target.checked,
                                    )
                                  }
                                />
                                Proof of address checked
                              </label>
                            </div>
                            <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                              Notes
                              <textarea
                                className="mt-1 min-h-16 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                                value={referee.notes ?? ""}
                                onChange={(event) => updateRefereeContact(application.id, referee.id, "notes", event.target.value)}
                              />
                            </label>
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                                {latestRequest?.status === "completed" ? (
                                  <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-900">
                                    Guarantor declaration accepted {latestRequest.respondedAt ? `on ${new Date(latestRequest.respondedAt).toLocaleString()}` : ""}
                                  </span>
                                ) : null}
                                {latestRequest?.status === "declined" ? (
                                  <span className="rounded-full bg-rose-100 px-2 py-1 font-semibold text-rose-900">
                                    Guarantor declaration declined {latestRequest.respondedAt ? `on ${new Date(latestRequest.respondedAt).toLocaleString()}` : ""}
                                  </span>
                                ) : null}
                                <span>
                                  {latestRequest
                                    ? `Latest guarantor approval request: ${formatReferenceRequestStatus(latestRequest.status)} via ${latestRequest.channel}.`
                                    : "No guarantor approval request sent yet."}
                                </span>
                                {latestRequest ? (
                                  <a
                                    className="font-semibold text-cyan-800 underline"
                                    href={`/api/applications/${application.id}/guarantor-reference-requests/${latestRequest.id}/consent-document`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Review guarantor declaration
                                  </a>
                                ) : null}
                                {latestRequest ? (
                                  <a
                                    className="font-semibold text-cyan-800 underline"
                                    href={`/api/applications/${application.id}/guarantor-reference-requests/${latestRequest.id}/consent-document?format=pdf`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Open guarantor declaration (PDF)
                                  </a>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                className="text-xs font-semibold text-rose-700 hover:underline"
                                onClick={() => removeRefereeContact(application.id, referee.id)}
                                disabled={isPending}
                              >
                                Remove contact
                              </button>
                            </div>
                          </div>
                        )
                      })}

                      {(application.referencingInstruction.referees ?? []).length === 0 ? (
                        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                          No guarantor contacts added yet.
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                        onClick={() => requestGuarantorReferences(application)}
                        disabled={
                          isPending ||
                          application.approvalDecision.outcome !== "approved_with_guarantor" ||
                          guarantorApprovalAlreadyRequested
                        }
                      >
                        {guarantorApprovalAlreadyRequested ? "Guarantor approval requested" : "Request guarantor approval"}
                      </button>
                      {guarantorApprovalAlreadyRequested ? (
                        <button
                          type="button"
                          className="rounded-md border border-cyan-300 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-60"
                          onClick={() => requestGuarantorReferences(application, { forceResend: true })}
                          disabled={isPending || application.approvalDecision.outcome !== "approved_with_guarantor"}
                        >
                          Resend guarantor approval
                        </button>
                      ) : null}
                      {application.approvalDecision.outcome !== "approved_with_guarantor" ? (
                        <span className="text-xs text-amber-700">Set decision to &quot;Approve with guarantor&quot; to enable this.</span>
                      ) : null}
                    </div>
                  </div>

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

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">Deposit management</h3>
                        <p className="mt-1 text-sm text-slate-600">
                          Request the deposit, record payment, track protection, and keep every deposit document visible in one place.
                        </p>
                      </div>
                      <a
                        href={`/dashboard/documents?applicationId=${encodeURIComponent(application.id)}`}
                        className="rounded-md border border-cyan-300 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-800 hover:bg-cyan-100"
                      >
                        Open application documents
                      </a>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="block text-sm font-medium text-slate-700">
                        Deposit amount
                        <input
                          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                          type="number"
                          min="0"
                          value={application.depositRecord.amount}
                          onChange={(event) =>
                            updateApplication(application.id, (current) => ({
                              ...current,
                              depositRecord: {
                                ...current.depositRecord,
                                amount: Number(event.target.value),
                                protectedAmount: Number(event.target.value),
                              },
                            }))
                          }
                        />
                      </label>

                      <label className="block text-sm font-medium text-slate-700">
                        Payment due date
                        <input
                          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                          type="date"
                          value={application.depositRecord.paymentDueDate}
                          onChange={(event) =>
                            updateApplication(application.id, (current) => ({
                              ...current,
                              depositRecord: {
                                ...current.depositRecord,
                                paymentDueDate: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>

                      <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                        Payment instructions
                        <textarea
                          className="mt-2 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2"
                          value={application.depositRecord.paymentInstructions}
                          onChange={(event) =>
                            updateApplication(application.id, (current) => ({
                              ...current,
                              depositRecord: {
                                ...current.depositRecord,
                                paymentInstructions: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>

                      <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                        Deposit notes
                        <textarea
                          className="mt-2 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2"
                          value={application.depositRecord.notes}
                          onChange={(event) =>
                            updateApplication(application.id, (current) => ({
                              ...current,
                              depositRecord: {
                                ...current.depositRecord,
                                notes: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>

                      <label className="block text-sm font-medium text-slate-700">
                        Protection provider
                        <input
                          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                          value={application.depositRecord.protectionProviderName}
                          onChange={(event) =>
                            updateApplication(application.id, (current) => ({
                              ...current,
                              depositRecord: {
                                ...current.depositRecord,
                                protectionProviderName: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>

                      <label className="block text-sm font-medium text-slate-700">
                        Protection reference
                        <input
                          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                          value={application.depositRecord.protectionReference}
                          onChange={(event) =>
                            updateApplication(application.id, (current) => ({
                              ...current,
                              depositRecord: {
                                ...current.depositRecord,
                                protectionReference: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>

                      <label className="block text-sm font-medium text-slate-700">
                        Protected amount
                        <input
                          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                          type="number"
                          min="0"
                          value={application.depositRecord.protectedAmount}
                          onChange={(event) =>
                            updateApplication(application.id, (current) => ({
                              ...current,
                              depositRecord: {
                                ...current.depositRecord,
                                protectedAmount: Number(event.target.value),
                              },
                            }))
                          }
                        />
                      </label>

                      <label className="block text-sm font-medium text-slate-700">
                        Protection date
                        <input
                          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                          type="date"
                          value={application.depositRecord.protectedDate?.slice(0, 10) ?? ""}
                          onChange={(event) =>
                            updateApplication(application.id, (current) => ({
                              ...current,
                              depositRecord: {
                                ...current.depositRecord,
                                protectedDate: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                    </div>

                    <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Deposit status</div>
                      <div className="mt-2 text-lg font-semibold capitalize text-slate-900">{formatDepositStatus(application.depositRecord.status)}</div>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <div>Requested: {formatAuditTimestamp(application.depositRecord.requestedDate)}</div>
                        <div>Acknowledged: {formatAuditTimestamp(application.depositRecord.acknowledgedAt)}</div>
                        <div>Tenant payment confirmation: {formatAuditTimestamp(application.depositRecord.paymentConfirmedByTenantAt)}</div>
                        <div>Payment received: {formatAuditTimestamp(application.depositRecord.paymentDate)}</div>
                        <div>Protected: {formatAuditTimestamp(application.depositRecord.protectedDate)}</div>
                        <div>Returned: {formatAuditTimestamp(application.depositRecord.returnedDate)}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                        disabled={isPending}
                        onClick={() => {
                          void runDepositAction(
                            application.id,
                            {
                              action: "request",
                              amount: application.depositRecord.amount,
                              paymentDueDate: application.depositRecord.paymentDueDate,
                              paymentInstructions: application.depositRecord.paymentInstructions,
                              notes: application.depositRecord.notes,
                            },
                            "Deposit request sent.",
                          )
                        }}
                      >
                        Request deposit
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                        disabled={isPending}
                        onClick={() => {
                          void runDepositAction(application.id, { action: "send_reminder" }, "Deposit reminder sent.")
                        }}
                      >
                        Send reminder
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                        disabled={isPending}
                        onClick={() => {
                          void runDepositAction(application.id, { action: "confirm_received" }, "Deposit payment marked as received.")
                        }}
                      >
                        Confirm payment received
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                        disabled={isPending}
                        onClick={() => {
                          void runDepositAction(
                            application.id,
                            { action: "mark_protection_pending", notes: application.depositRecord.notes },
                            "Deposit moved to protection pending.",
                          )
                        }}
                      >
                        Mark protection pending
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                        disabled={isPending}
                        onClick={() => {
                          void runDepositAction(
                            application.id,
                            {
                              action: "record_protection",
                              protectionProviderName: application.depositRecord.protectionProviderName,
                              protectionReference: application.depositRecord.protectionReference,
                              protectedAmount: application.depositRecord.protectedAmount,
                              protectedDate: application.depositRecord.protectedDate?.slice(0, 10),
                              notes: application.depositRecord.notes,
                            },
                            "Deposit protection recorded.",
                          )
                        }}
                      >
                        Record protection
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                        disabled={isPending}
                        onClick={() => {
                          void runDepositAction(application.id, { action: "mark_returned", notes: application.depositRecord.notes }, "Deposit marked as returned.")
                        }}
                      >
                        Mark returned
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-60"
                        disabled={isPending}
                        onClick={() => {
                          void runDepositAction(application.id, { action: "mark_disputed", notes: application.depositRecord.notes }, "Deposit marked as disputed.")
                        }}
                      >
                        Mark disputed
                      </button>
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">Deposit documents</h4>
                          <p className="mt-1 text-xs text-slate-500">Keep receipts and protection certificates here and in the application document vault.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            ref={(node) => {
                              depositFileInputRefs.current[getDepositUploadSlot(application.id, "payment_receipt")] = node
                            }}
                            type="file"
                            className="hidden"
                            onChange={(event) => {
                              void uploadDepositDocument(application.id, "payment_receipt", event)
                            }}
                          />
                          <button
                            type="button"
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                            disabled={depositUploadStateBySlot[getDepositUploadSlot(application.id, "payment_receipt")]}
                            onClick={() => depositFileInputRefs.current[getDepositUploadSlot(application.id, "payment_receipt")]?.click()}
                          >
                            Upload payment receipt
                          </button>
                          <input
                            ref={(node) => {
                              depositFileInputRefs.current[getDepositUploadSlot(application.id, "protection_certificate")] = node
                            }}
                            type="file"
                            className="hidden"
                            onChange={(event) => {
                              void uploadDepositDocument(application.id, "protection_certificate", event)
                            }}
                          />
                          <button
                            type="button"
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                            disabled={depositUploadStateBySlot[getDepositUploadSlot(application.id, "protection_certificate")]}
                            onClick={() => depositFileInputRefs.current[getDepositUploadSlot(application.id, "protection_certificate")]?.click()}
                          >
                            Upload protection certificate
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2 text-sm text-slate-700">
                        {application.depositRecord.documents.length > 0 ? (
                          application.depositRecord.documents.map((document) => (
                            <div key={document.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                              <div className="font-medium text-slate-900">{document.fileName}</div>
                              <div className="mt-1 text-xs text-slate-600">
                                {document.category.replaceAll("_", " ")} uploaded {formatAuditTimestamp(document.uploadedAt)} by {document.uploadedByEmail}
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                                <a
                                  className="font-semibold text-cyan-800 underline"
                                  href={getDepositDocumentDownloadHref(application.id, document.id)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  View
                                </a>
                                <a
                                  className="font-semibold text-cyan-800 underline"
                                  href={`${getDepositDocumentDownloadHref(application.id, document.id)}?download=1`}
                                >
                                  Download
                                </a>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-slate-500">No deposit documents uploaded yet.</div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Deposit history</div>
                      <div className="mt-3 space-y-2 text-sm text-slate-700">
                        {application.depositRecord.history.length > 0 ? (
                          application.depositRecord.history.map((entry) => (
                            <div key={entry.id} className="rounded-md border border-slate-200 bg-white p-3">
                              <div className="font-medium capitalize text-slate-900">{entry.action.replaceAll("_", " ")}</div>
                              <div className="mt-1 text-xs text-slate-600">
                                {formatDepositStatus(entry.status)} · {formatAuditTimestamp(entry.timestamp)} · {entry.performedBy}
                              </div>
                              {entry.notes ? <div className="mt-2 text-sm text-slate-700">{entry.notes}</div> : null}
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-slate-500">No deposit history recorded yet.</div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              </section>

              <section className={`rounded-xl border border-slate-200 p-4 ${activeTab === "offer" ? "" : "hidden"}`}>
                <h3 className="text-lg font-semibold text-slate-900">Agreement and move-in readiness</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Legal framework
                    <select
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      value={application.tenancyAgreement.legalFramework || ""}
                      aria-label="Select legal framework"
                      title="Select legal framework for tenancy agreement"
                      onChange={(event) =>
                        updateApplication(application.id, (current) => {
                          const legalFramework = event.target.value as TenancyApplicationRecord["tenancyAgreement"]["legalFramework"]
                          const tenancyType =
                            legalFramework === "england_wales"
                              ? current.tenancyAgreement.tenancyType === "PRT"
                                ? "AST"
                                : current.tenancyAgreement.tenancyType
                              : legalFramework === "scotland"
                                ? current.tenancyAgreement.tenancyType === "AST"
                                  ? "PRT"
                                  : current.tenancyAgreement.tenancyType
                                : current.tenancyAgreement.tenancyType

                          return {
                            ...current,
                            tenancyAgreement: {
                              ...current.tenancyAgreement,
                              legalFramework,
                              tenancyType,
                            },
                          }
                        })
                      }
                    >
                      <option value="">Select</option>
                      <option value="england_wales">England and Wales</option>
                      <option value="scotland">Scotland</option>
                    </select>
                  </label>

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
                      {(application.tenancyAgreement.legalFramework === "" || application.tenancyAgreement.legalFramework === "england_wales") ? (
                        <option value="AST">AST</option>
                      ) : null}
                      {(application.tenancyAgreement.legalFramework === "" || application.tenancyAgreement.legalFramework === "scotland") ? (
                        <option value="PRT">PRT</option>
                      ) : null}
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

                  <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                    Offer letter reference
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      value={application.tenancyAgreement.offerLetter.reference}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          tenancyAgreement: {
                            ...current.tenancyAgreement,
                            offerLetter: {
                              ...current.tenancyAgreement.offerLetter,
                              reference: event.target.value,
                            },
                          },
                        }))
                      }
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Offer letter link
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      value={application.tenancyAgreement.offerLetter.url}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          tenancyAgreement: {
                            ...current.tenancyAgreement,
                            offerLetter: {
                              ...current.tenancyAgreement.offerLetter,
                              url: event.target.value,
                            },
                          },
                        }))
                      }
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Lease copy link
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      value={application.tenancyAgreement.leaseDocument.url}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          tenancyAgreement: {
                            ...current.tenancyAgreement,
                            leaseDocument: {
                              ...current.tenancyAgreement.leaseDocument,
                              url: event.target.value,
                            },
                          },
                        }))
                      }
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                    Supporting legal documents summary
                    <textarea
                      className="mt-2 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2"
                      value={application.tenancyAgreement.supportingLegalDocuments.summary}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          tenancyAgreement: {
                            ...current.tenancyAgreement,
                            supportingLegalDocuments: {
                              ...current.tenancyAgreement.supportingLegalDocuments,
                              summary: event.target.value,
                            },
                          },
                        }))
                      }
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                    Supporting legal documents link
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      value={application.tenancyAgreement.supportingLegalDocuments.url}
                      onChange={(event) =>
                        updateApplication(application.id, (current) => ({
                          ...current,
                          tenancyAgreement: {
                            ...current.tenancyAgreement,
                            supportingLegalDocuments: {
                              ...current.tenancyAgreement.supportingLegalDocuments,
                              url: event.target.value,
                            },
                          },
                        }))
                      }
                    />
                  </label>

                  <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 md:col-span-2">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Agreement audit trail</div>
                    <div className="mt-2">Legal framework: {application.tenancyAgreement.legalFramework === "england_wales" ? "England and Wales" : application.tenancyAgreement.legalFramework === "scotland" ? "Scotland" : "Not selected"}</div>
                    <div className="mt-1">Tenancy type: {application.tenancyAgreement.tenancyType || "Not selected"}</div>
                    <div className="mt-2">Offer issued: {formatAuditTimestamp(application.tenancyAgreement.offerLetter.sentAt)}</div>
                    <div className="mt-1">Lease issued: {formatAuditTimestamp(application.tenancyAgreement.leaseDocument.sentAt)}</div>
                    <div className="mt-1">Lease signed copy received: {formatAuditTimestamp(application.tenancyAgreement.leaseDocument.signedCopyReceivedAt)}</div>
                    <div className="mt-1">Supporting legal pack issued: {formatAuditTimestamp(application.tenancyAgreement.supportingLegalDocuments.sentAt)}</div>
                    <div className="mt-1">Supporting legal signed pack received: {formatAuditTimestamp(application.tenancyAgreement.supportingLegalDocuments.signedCopyReceivedAt)}</div>
                    <div className="mt-1">Applicant sign-off: {application.applicantChecklist.signedAt ? `${application.applicantChecklist.signedFullName || application.applicantName} on ${new Date(application.applicantChecklist.signedAt).toLocaleString()}` : "Pending"}</div>
                  </div>

                  {[
                    ["offerLetterSent", "Offer letter issued"],
                    ["offerLetterSigned", "Signed offer letter received"],
                    ["leaseSent", "Lease issued for signature"],
                    ["leaseSigned", "Signed lease received"],
                    ["legalDocsSent", "Supporting legal documents issued"],
                    ["legalDocsSigned", "Signed legal documents received"],
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
                      key === "offerLetterSent" || key === "offerLetterSigned"
                        ? "offerLetter"
                        : key === "leaseSent" || key === "leaseSigned"
                          ? "leaseDocument"
                          : key === "legalDocsSent" || key === "legalDocsSigned"
                            ? "supportingLegalDocuments"
                            : key in application.tenancyAgreement
                        ? "tenancyAgreement"
                        : key in application.preMoveInCompliance
                          ? "preMoveInCompliance"
                          : key in application.moveInChecklist
                            ? "moveInChecklist"
                            : "depositProtection"

                    const fieldKey =
                      key === "offerLetterSent"
                        ? "sent"
                        : key === "offerLetterSigned"
                          ? "signedCopyReceived"
                          : key === "leaseSent"
                            ? "sent"
                            : key === "leaseSigned"
                              ? "signedCopyReceived"
                              : key === "legalDocsSent"
                                ? "sent"
                                : key === "legalDocsSigned"
                                  ? "signedCopyReceived"
                                  : key

                    return (
                      <label key={key} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 md:col-span-2">
                        <input
                          type="checkbox"
                          checked={Boolean(
                            section === "offerLetter"
                              ? application.tenancyAgreement.offerLetter[fieldKey as keyof typeof application.tenancyAgreement.offerLetter]
                              : section === "leaseDocument"
                                ? application.tenancyAgreement.leaseDocument[fieldKey as keyof typeof application.tenancyAgreement.leaseDocument]
                                : section === "supportingLegalDocuments"
                                  ? application.tenancyAgreement.supportingLegalDocuments[fieldKey as keyof typeof application.tenancyAgreement.supportingLegalDocuments]
                                  : application[section][fieldKey as never],
                          )}
                          onChange={(event) =>
                            section === "offerLetter"
                              ? updateApplication(application.id, (current) => ({
                                  ...current,
                                  tenancyAgreement: {
                                    ...current.tenancyAgreement,
                                    offerLetter: {
                                      ...current.tenancyAgreement.offerLetter,
                                      [fieldKey]: event.target.checked,
                                    },
                                  },
                                }))
                              : section === "leaseDocument"
                                ? updateApplication(application.id, (current) => ({
                                    ...current,
                                    tenancyAgreement: {
                                      ...current.tenancyAgreement,
                                      leaseDocument: {
                                        ...current.tenancyAgreement.leaseDocument,
                                        [fieldKey]: event.target.checked,
                                      },
                                    },
                                  }))
                                : section === "supportingLegalDocuments"
                                  ? updateApplication(application.id, (current) => ({
                                      ...current,
                                      tenancyAgreement: {
                                        ...current.tenancyAgreement,
                                        supportingLegalDocuments: {
                                          ...current.tenancyAgreement.supportingLegalDocuments,
                                          [fieldKey]: event.target.checked,
                                        },
                                      },
                                    }))
                                  : updateApplication(application.id, (current) => ({
                                      ...current,
                                      [section]: {
                                        ...current[section],
                                        [fieldKey]: event.target.checked,
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

                  <div className="md:col-span-2">
                    <TenantCommunicationThread
                      entries={application.postMoveInManagement.communicationEntries}
                      draft={communicationDraft}
                      onDraftChange={(field, value) => updateCommunicationDraft(application.id, field, value)}
                      onAddEntry={() => addCommunicationEntry(application)}
                      title="Tenant conversation thread"
                      description="Record every call, email, SMS, portal message, letter, or meeting as one threaded conversation."
                      emptyMessage="No tenant communications have been recorded yet."
                    />
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Dispute audit trail</div>
                        <p className="mt-1 text-sm text-slate-600">Every saved workflow change is recorded with actor, timestamp, and before/after values.</p>
                      </div>
                      <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        {auditEvents.length} event{auditEvents.length === 1 ? "" : "s"}
                      </div>
                    </div>

                    {auditEvents.length === 0 ? (
                      <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500">
                        No application audit events have been recorded yet.
                      </div>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {auditEvents.slice(0, 12).map((event) => (
                          <AuditEventCard key={event.id} event={event} />
                        ))}
                        {auditEvents.length > 12 ? (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                              onClick={() => setFullAuditApplicationId(application.id)}
                            >
                              View full audit trail
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>

            <div className="mt-6 flex justify-end">
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                  onClick={() => downloadTenancyLogTxt(application)}
                >
                  Export TXT
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                  onClick={() => downloadTenancyLogPdf(application)}
                >
                  Export PDF
                </button>
                <button
                  type="button"
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
                  onClick={() => saveApplication(application)}
                  disabled={isPending}
                >
                  {isPending ? "Saving..." : "Save workflow"}
                </button>
              </div>
            </div>
              </>
            ) : null}
          </section>
          )
        })
      )}

      {fullAuditApplication ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Full audit trail</div>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">{fullAuditApplication.applicantName} · {fullAuditApplication.propertyAddress}</h2>
                <p className="mt-1 text-sm text-slate-600">Complete saved change history for this tenancy workflow.</p>
              </div>
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                onClick={() => setFullAuditApplicationId(null)}
              >
                Close
              </button>
            </div>
            <div className="max-h-[calc(90vh-96px)] overflow-y-auto px-6 py-5">
              <div className="mb-4 rounded-full bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 inline-flex">
                {fullAuditEvents.length} event{fullAuditEvents.length === 1 ? "" : "s"}
              </div>
              <div className="space-y-3">
                {fullAuditEvents.map((event) => (
                  <AuditEventCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function createEmptyRefereeContact(): TenancyRefereeContact {
  return {
    id: globalThis.crypto.randomUUID(),
    fullName: "",
    relationship: "",
    relationshipToApplicantConfirmed: false,
    idDocumentCheckComplete: false,
    proofOfAddressCheckComplete: false,
    email: "",
    phone: "",
    preferredChannel: "email",
    postalAddress: "",
    notes: "",
  }
}

function formatReferenceRequestStatus(status: TenancyReferenceRequest["status"]) {
  return status.replaceAll("_", " ")
}

function formatSiteVisitStatus(status: TenancyApplicationRecord["preMoveInCompliance"]["siteVisit"]["status"]) {
  return status.replaceAll("_", " ")
}

function getSiteVisitTone(status: TenancyApplicationRecord["preMoveInCompliance"]["siteVisit"]["status"]) {
  if (status === "completed") {
    return "bg-emerald-100 text-emerald-900"
  }

  if (status === "no_access" || status === "cancelled") {
    return "bg-rose-100 text-rose-900"
  }

  if (status === "scheduled") {
    return "bg-cyan-100 text-cyan-900"
  }

  return "bg-slate-100 text-slate-700"
}

function formatSiteVisitInviteStatus(status: TenancyApplicationRecord["preMoveInCompliance"]["siteVisit"]["inviteStatus"]) {
  return status.replaceAll("_", " ")
}

function getSiteVisitInviteTone(status: TenancyApplicationRecord["preMoveInCompliance"]["siteVisit"]["inviteStatus"]) {
  if (status === "confirmed") {
    return "text-emerald-800"
  }

  if (status === "declined" || status === "failed" || status === "expired") {
    return "text-rose-800"
  }

  if (status === "sent") {
    return "text-cyan-800"
  }

  return "text-slate-700"
}

function toDateTimeLocalInputValue(value?: string) {
  if (!value) {
    return ""
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ""
  }

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, "0")
  const day = String(parsed.getDate()).padStart(2, "0")
  const hours = String(parsed.getHours()).padStart(2, "0")
  const minutes = String(parsed.getMinutes()).padStart(2, "0")

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function fromDateTimeLocalInputValue(value: string) {
  if (!value) {
    return undefined
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return undefined
  }

  return parsed.toISOString()
}