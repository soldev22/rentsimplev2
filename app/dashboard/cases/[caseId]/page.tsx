"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import type { PropertyCase } from "@/lib/auth"
import type { DampInspectionReport } from "@/lib/types/case"
import CaseMessageThread from "@/components/cases/CaseMessageThread"
import CaseInviteManager from "@/components/cases/CaseInviteManager"
import CaseAttachmentManager from "@/components/cases/CaseAttachmentManager"
import ThreadSummaryPanel from "@/components/cases/ThreadSummaryPanel"
import WebhookStatusWidget from "@/components/cases/WebhookStatusWidget"
import DampInspectionReportForm from "@/components/cases/DampInspectionReportForm"
import DampInspectionReportDisplay from "@/components/cases/DampInspectionReportDisplay"

type CaseDetailPageProps = {
  params: Promise<{
    caseId: string
  }>
}

function getStatusBadgeColor(status: string): string {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800"
    case "overdue":
      return "bg-red-100 text-red-800"
    case "in_progress":
      return "bg-blue-100 text-blue-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getTimeRemaining(dueAt: string): { text: string; color: string } {
  const due = new Date(dueAt)
  const now = new Date()
  const diffMs = due.getTime() - now.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  const diffDays = diffHours / 24

  if (diffHours < 0) {
    const overdueDays = Math.ceil(-diffDays)
    return {
      text: `${overdueDays} day${overdueDays !== 1 ? "s" : ""} overdue`,
      color: "text-red-600",
    }
  }

  if (diffHours < 24) {
    return {
      text: `${Math.ceil(diffHours)}h remaining`,
      color: "text-red-600",
    }
  }

  if (diffDays < 3) {
    return {
      text: `${Math.ceil(diffDays)} days remaining`,
      color: "text-amber-600",
    }
  }

  return {
    text: `${Math.ceil(diffDays)} days remaining`,
    color: "text-gray-600",
  }
}

export default function CaseDetailPage({ params }: CaseDetailPageProps) {
  const [case_, setCase] = useState<PropertyCase | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [completingStageId, setCompletingStageId] = useState<string | null>(null)
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("")
  const [showReportForm, setShowReportForm] = useState(false)
  const [pendingStageId, setPendingStageId] = useState<string | null>(null)
  const [sendingReportId, setSendingReportId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    let isMounted = true

    const loadCase = async () => {
      try {
        const { caseId } = await params
        const propertyId = new URLSearchParams(window.location.search).get("propertyId")

        // Fetch current user
        const userRes = await fetch("/api/auth/me")
        if (isMounted && userRes.ok) {
          const userData = await userRes.json()
          setCurrentUserEmail(userData.email)
        }

        if (!propertyId) {
          throw new Error("propertyId is required to view case")
        }

        // Fetch case by ID with propertyId
        const caseRes = await fetch(`/api/cases/${caseId}?propertyId=${propertyId}`)
        if (!isMounted) return

        if (!caseRes.ok) {
          const errorData = await caseRes.json()
          throw new Error(errorData.error || "Failed to fetch case")
        }

        const caseData = await caseRes.json()
        if (isMounted) {
          setCase(caseData)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load case")
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadCase()
    return () => {
      isMounted = false
    }
  }, [params])

  const handleCompleteStage = useCallback(
    async (stageId: string) => {
      if (!case_) return

      const propertyId = new URLSearchParams(window.location.search).get("propertyId")
      if (!propertyId) {
        alert("propertyId is required")
        return
      }

      setCompletingStageId(stageId)
      try {
        const response = await fetch(
          `/api/properties/${propertyId}/cases/${case_.id}/stages/${stageId}/complete`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notes: "Stage marked as complete" }),
          }
        )

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to complete stage")
        }

        const updated = await response.json()
        setCase(updated)
        alert("Stage marked as complete!")
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to complete stage")
      } finally {
        setCompletingStageId(null)
      }
    },
    [case_]
  )

  const handleAddReport = useCallback(
    (stageId: string) => {
      setPendingStageId(stageId)
      setShowReportForm(true)
    },
    []
  )

  const stageHasReport = useCallback(
    (stageId: string): boolean => {
      if (!case_?.dampInspectionReports) return false
      return case_.dampInspectionReports.some((r) => r.stageId === stageId)
    },
    [case_]
  )

  const handleReportSubmit = useCallback(
    async (reportData: Omit<DampInspectionReport, "id" | "caseId" | "stageId" | "propertyId" | "reportSubmittedAt">) => {
      if (!case_ || !pendingStageId) return

      const propertyId = new URLSearchParams(window.location.search).get("propertyId")
      if (!propertyId) {
        throw new Error("propertyId is required")
      }

      setCompletingStageId(pendingStageId)
      try {
        // Save report WITHOUT completing the stage yet
        const response = await fetch(
          `/api/properties/${propertyId}/cases/${case_.id}/stages/${pendingStageId}/inspection-report`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(reportData),
          }
        )

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to save inspection report")
        }

        const updated = await response.json()
        setCase(updated)
        setShowReportForm(false)
        setPendingStageId(null)
        alert("Inspection report saved! Now click 'Mark Complete' to finish the stage.")
      } catch (err) {
        throw err
      } finally {
        setCompletingStageId(null)
      }
    },
    [case_, pendingStageId]
  )

  const handleSendReportToTenant = useCallback(
    async (reportId: string, method: "email" | "dashboard") => {
      if (!case_) return

      const propertyId = new URLSearchParams(window.location.search).get("propertyId")
      if (!propertyId) {
        alert("propertyId is required")
        return
      }

      setSendingReportId(reportId)
      try {
        const response = await fetch(
          `/api/properties/${propertyId}/cases/${case_.id}/reports/${reportId}/send-to-tenant`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ method }),
          }
        )

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to send report")
        }

        const result = await response.json()
        const methodLabel = method === "email" ? "Email" : "Dashboard link"
        alert(`Report sent via ${methodLabel}!\n${result.message}`)
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to send report")
      } finally {
        setSendingReportId(null)
      }
    },
    [case_]
  )

  if (loading) {
    return <div className="text-center py-12">Loading case details...</div>
  }

  if (error) {
    return <div className="text-red-600 text-center py-12">{error}</div>
  }

  if (!case_) {
    return <div className="text-gray-600 text-center py-12">Case not found</div>
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{case_.title}</h1>
            <p className="text-gray-600 mt-1">{case_.description}</p>
          </div>
          <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold border ${getStatusBadgeColor(case_.status)}`}>
            {case_.status}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">Case Type</p>
            <p className="font-semibold text-gray-900 mt-1">{case_.caseType.replace("_", " ")}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Created</p>
            <p className="font-semibold text-gray-900 mt-1">{formatDate(case_.createdAt)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Messages</p>
            <p className="font-semibold text-gray-900 mt-1">{case_.messageCount}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Attachments</p>
            <p className="font-semibold text-gray-900 mt-1">{case_.attachmentCount}</p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Case Timeline</h2>

        <div className="space-y-6">
          {case_.stages.map((stage, index) => {
            const isCompleted = stage.status === "completed" || !!stage.completedAt
            const isOverdue = stage.status === "overdue" && !isCompleted
            const timeRemaining = getTimeRemaining(stage.dueAt)
            
            // Check if completed within legal timeframe
            const isCompletedOnTime = isCompleted && stage.completedAt 
              ? new Date(stage.completedAt) <= new Date(stage.dueAt)
              : false
            const isCompletedLate = isCompleted && !isCompletedOnTime
            const hasReport = stageHasReport(stage.id)
            
            // For damp cases, only show green if: on-time + has report
            // For other cases, show green if: on-time
            const shouldBeGreen = isCompleted && (case_?.caseType === "damp"
              ? (isCompletedOnTime && hasReport)
              : isCompletedOnTime)

            return (
              <div key={stage.id} className="relative pb-6 pl-10">
                {/* Timeline connector */}
                {index < case_.stages.length - 1 && (
                  <div className="absolute left-3 top-12 bottom-0 w-0.5 bg-gray-200" />
                )}

                {/* Timeline dot */}
                <div
                  className={`absolute -left-6 -top-1 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    shouldBeGreen
                      ? "bg-green-500 border-green-600"
                      : isCompletedLate
                        ? "bg-orange-500 border-orange-600"
                        : isOverdue
                          ? "bg-red-500 border-red-600"
                          : "bg-gray-300 border-gray-400"
                  }`}
                >
                  {shouldBeGreen && <span className="text-white text-xs">✓</span>}
                  {isCompletedLate && <span className="text-white text-xs">⏱</span>}
                  {isOverdue && !isCompleted && <span className="text-white text-xs">!</span>}
                </div>

                {/* Stage content */}
                <div
                  className={`rounded-lg p-4 border ${
                    shouldBeGreen
                      ? "bg-green-50 border-green-300"
                      : isCompletedLate
                        ? "bg-orange-100 border-orange-400"
                        : isOverdue
                          ? "bg-red-100 border-red-400"
                          : "bg-red-50 border-red-300"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">
                        Stage {index + 1}: {stage.requirement}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {stage.workingDaysOnly ? stage.daysAllowed + " working days" : stage.daysAllowed + " calendar days"}
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(stage.status)}`}>
                      {stage.status}
                    </span>
                  </div>

                  {/* Due date and time remaining */}
                  <div className="bg-white rounded p-3 mb-4 border border-gray-200">
                    <p className="text-sm text-gray-600">
                      Due: <span className="font-semibold text-gray-900">{formatDate(stage.dueAt)}</span>
                    </p>
                    <p className={`text-sm font-semibold mt-1 ${timeRemaining.color}`}>{timeRemaining.text}</p>
                  </div>

                  {/* Escalation alerts */}
                  {stage.escalations && stage.escalations.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
                      <p className="text-xs font-semibold text-yellow-900 mb-2">Escalation Alerts:</p>
                      <div className="flex gap-2">
                        {stage.escalations.map((esc, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-yellow-100 text-xs text-yellow-800">
                            {esc.level === "alert_24h" && "🔔"}
                            {esc.level === "alert_72h" && "⚠️"}
                            {esc.level === "alert_5d" && "🚨"}
                            {esc.level}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Completion info */}
                  {isCompleted && stage.completedAt && (
                    <div className="bg-green-50 border border-green-200 rounded p-3 mb-4">
                      <p className="text-xs font-semibold text-green-900">Completed: {formatDate(stage.completedAt)}</p>
                    </div>
                  )}

                  {/* Damp case workflow */}
                  {!isCompleted && case_?.caseType === "damp" && (
                    <div className="space-y-3">
                      {!stageHasReport(stage.id) ? (
                        <button
                          onClick={() => handleAddReport(stage.id)}
                          disabled={completingStageId === stage.id}
                          className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
                        >
                          📋 Add Inspection Report
                        </button>
                      ) : (
                        <>
                          <div className="bg-green-50 border border-green-200 rounded p-3">
                            <p className="text-xs font-semibold text-green-900">✅ Inspection Report Complete</p>
                          </div>
                          <button
                            onClick={() => handleCompleteStage(stage.id)}
                            disabled={completingStageId === stage.id}
                            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
                          >
                            {completingStageId === stage.id ? "Marking Complete..." : "Mark Complete"}
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Non-damp case: standard complete button */}
                  {!isCompleted && case_?.caseType !== "damp" && (
                    <button
                      onClick={() => handleCompleteStage(stage.id)}
                      disabled={completingStageId === stage.id}
                      className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
                    >
                      {completingStageId === stage.id ? "Marking Complete..." : "Mark Complete"}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Damp Inspection Reports */}
      {case_ && case_.dampInspectionReports && case_.dampInspectionReports.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
          <DampInspectionReportDisplay 
            reports={case_.dampInspectionReports}
            onSendReport={handleSendReportToTenant}
            sendingReportId={sendingReportId}
          />
        </div>
      )}

      {/* Case Messages */}
      {case_ && currentUserEmail && (
        <CaseMessageThread
          caseId={case_.id}
          propertyId={case_.propertyId}
          currentUserEmail={currentUserEmail}
          onMessageAdded={() => {
            // Refresh case message count if needed
          }}
        />
      )}

      {/* Team Access Management */}
      {case_ && (
        <CaseInviteManager
          caseId={case_.id}
          propertyId={case_.propertyId}
          currentUserRole="landlord"
        />
      )}

      {/* Attachments */}
      {case_ && (
        <CaseAttachmentManager
          caseId={case_.id}
          propertyId={case_.propertyId}
          readOnly={false}
        />
      )}

      {/* AI Summary Panel */}
      {case_ && (
        <ThreadSummaryPanel
          caseId={case_.id}
          propertyId={case_.propertyId}
        />
      )}

      {/* Webhook Status */}
      {case_ && (
        <WebhookStatusWidget
          caseId={case_.id}
          propertyId={case_.propertyId}
        />
      )}

      {/* Audit Trail Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <span className="font-semibold">🔒 Immutable Record:</span> All changes to this case are automatically logged and cannot be deleted,
          ensuring a complete audit trail for tribunal evidence.
        </p>
      </div>

      {/* Damp Inspection Report Form Modal */}
      {showReportForm && case_ && pendingStageId && (
        <DampInspectionReportForm
          caseId={case_.id}
          stageId={pendingStageId}
          propertyId={case_.propertyId}
          onSubmit={handleReportSubmit}
          onClose={() => {
            setShowReportForm(false)
            setPendingStageId(null)
            setCompletingStageId(null)
          }}
        />
      )}
    </div>
  )
}
