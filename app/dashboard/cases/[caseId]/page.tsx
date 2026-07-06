"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { PropertyCase } from "@/lib/auth"
import CaseMessageThread from "@/components/cases/CaseMessageThread"
import CaseInviteManager from "@/components/cases/CaseInviteManager"
import CaseAttachmentManager from "@/components/cases/CaseAttachmentManager"
import ThreadSummaryPanel from "@/components/cases/ThreadSummaryPanel"
import WebhookStatusWidget from "@/components/cases/WebhookStatusWidget"

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
  const router = useRouter()

  useEffect(() => {
    const loadCase = async () => {
      try {
        const { caseId } = await params

        // Fetch current user
        const userRes = await fetch("/api/auth/me")
        if (userRes.ok) {
          const userData = await userRes.json()
          setCurrentUserEmail(userData.email)
        }

        // For now, we'll need the propertyId from URL or props
        // This will be passed from the parent route
        setLoading(false)
      } catch (err) {
        setError("Failed to load case")
        setLoading(false)
      }
    }

    loadCase()
  }, [params])

  const handleCompleteStage = async (stageId: string) => {
    if (!case_) return

    setCompletingStageId(stageId)
    try {
      // API call will be wired up when integrated
      console.log(`Completing stage ${stageId}`)
      // const response = await fetch(`/api/properties/${propertyId}/cases/${case_.id}/stages/${stageId}/complete`, {
      //   method: 'PUT',
      //   body: JSON.stringify({ notes: '' })
      // })
      // if (response.ok) {
      //   const updated = await response.json()
      //   setCase(updated)
      // }
    } finally {
      setCompletingStageId(null)
    }
  }

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
            const isCompleted = !!stage.completedAt
            const isOverdue = stage.status === "overdue"
            const timeRemaining = getTimeRemaining(stage.dueAt)

            return (
              <div key={stage.id} className="relative pb-6 pl-10">
                {/* Timeline connector */}
                {index < case_.stages.length - 1 && (
                  <div className="absolute left-3 top-12 bottom-0 w-0.5 bg-gray-200" />
                )}

                {/* Timeline dot */}
                <div
                  className={`absolute -left-6 -top-1 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    isCompleted
                      ? "bg-green-500 border-green-600"
                      : isOverdue
                        ? "bg-red-500 border-red-600"
                        : "bg-gray-300 border-gray-400"
                  }`}
                >
                  {isCompleted && <span className="text-white text-xs">✓</span>}
                  {isOverdue && <span className="text-white text-xs">!</span>}
                </div>

                {/* Stage content */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
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

                  {/* Mark complete button */}
                  {!isCompleted && (
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
    </div>
  )
}
