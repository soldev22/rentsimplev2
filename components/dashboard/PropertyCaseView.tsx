"use client"

import type { PropertyCase, CaseStage } from "@/lib/auth"
import { getEscalationStatus } from "@/lib/server/cases"

type PropertyCaseViewProps = {
  case_: PropertyCase
  onStageComplete?: (stageId: string) => void
  canManage?: boolean
}

function getStageStatusColor(status: string) {
  switch (status) {
    case "completed":
      return "bg-green-50 border-green-200"
    case "in_progress":
      return "bg-blue-50 border-blue-200"
    case "overdue":
      return "bg-red-50 border-red-200"
    case "pending":
      return "bg-gray-50 border-gray-200"
    default:
      return "bg-gray-50 border-gray-200"
  }
}

function getStageStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800"
    case "in_progress":
      return "bg-blue-100 text-blue-800"
    case "overdue":
      return "bg-red-100 text-red-800"
    case "pending":
      return "bg-gray-100 text-gray-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

function getStatusLabel(status: string) {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function formatTimeRemaining(dueAt: string): string {
  const due = new Date(dueAt)
  const now = new Date()
  const msRemaining = due.getTime() - now.getTime()

  if (msRemaining < 0) {
    const msOverdue = Math.abs(msRemaining)
    const hoursOverdue = Math.floor(msOverdue / (1000 * 60 * 60))
    const daysOverdue = Math.floor(msOverdue / (1000 * 60 * 60 * 24))

    if (daysOverdue > 0) {
      return `${daysOverdue} day${daysOverdue > 1 ? "s" : ""} overdue`
    }
    return `${hoursOverdue} hour${hoursOverdue > 1 ? "s" : ""} overdue`
  }

  const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60))
  const daysRemaining = Math.floor(msRemaining / (1000 * 60 * 60 * 24))

  if (daysRemaining > 0) {
    return `${daysRemaining} day${daysRemaining > 1 ? "s" : ""} remaining`
  }

  if (hoursRemaining > 0) {
    return `${hoursRemaining} hour${hoursRemaining > 1 ? "s" : ""} remaining`
  }

  return "Due soon"
}

function getTimeRemainingColor(dueAt: string): string {
  const due = new Date(dueAt)
  const now = new Date()
  const hoursRemaining = (due.getTime() - now.getTime()) / (1000 * 60 * 60)

  if (hoursRemaining < 0) return "text-red-700 font-semibold"
  if (hoursRemaining < 24) return "text-red-600 font-semibold"
  if (hoursRemaining < 72) return "text-amber-600 font-semibold"
  return "text-gray-600"
}

export default function PropertyCaseView({ case_: case_, onStageComplete, canManage }: PropertyCaseViewProps) {
  const stageStatuses = case_.stages.map((stage) => {
    if (stage.completedAt) return "completed"

    const escalation = getEscalationStatus(stage.dueAt)
    if (escalation.isOverdue) return "overdue"

    return "pending"
  })

  return (
    <div className="space-y-6">
      {/* Case Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{case_.title}</h2>
            <p className="text-gray-600 mt-1">{case_.description}</p>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStageStatusBadge(case_.status)}`}>
            {getStatusLabel(case_.status)}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200">
          <div>
            <p className="text-xs font-medium text-gray-600">Created</p>
            <p className="text-sm text-gray-900 mt-1">{new Date(case_.createdAt).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600">Case Type</p>
            <p className="text-sm text-gray-900 mt-1">
              {case_.caseType
                .split("_")
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" ")}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600">Messages</p>
            <p className="text-sm text-gray-900 mt-1">{case_.messageCount}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600">Attachments</p>
            <p className="text-sm text-gray-900 mt-1">{case_.attachmentCount}</p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Legal Timeline</h3>

        <div className="space-y-4">
          {case_.stages.map((stage, idx) => (
            <div key={stage.id} className={`rounded-lg border p-4 ${getStageStatusColor(stageStatuses[idx])}`}>
              <div className="flex items-start gap-4">
                {/* Step Indicator */}
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white font-semibold flex-shrink-0">
                  {idx + 1}
                </div>

                {/* Stage Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="font-medium text-gray-900">{stage.requirement}</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Due: <span className={getTimeRemainingColor(stage.dueAt)}>{formatTimeRemaining(stage.dueAt)}</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(stage.dueAt).toLocaleDateString()} at{" "}
                        {new Date(stage.dueAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>

                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${getStageStatusBadge(stageStatuses[idx])}`}>
                      {getStatusLabel(stageStatuses[idx])}
                    </span>
                  </div>

                  {/* Escalation Alerts */}
                  {!stage.completedAt && (
                    <div className="mt-3">
                      {stage.escalations.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {stage.escalations.map((esc) => (
                            <span
                              key={esc.level}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800"
                            >
                              {esc.level === "alert_24h" && "🔔 24h Warning"}
                              {esc.level === "alert_72h" && "⚠️ 72h Warning"}
                              {esc.level === "alert_5d" && "🚨 5 Day Warning"}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Completion Info */}
                  {stage.completedAt && (
                    <div className="mt-3">
                      <p className="text-sm text-green-700">
                        ✓ Completed on {new Date(stage.completedAt).toLocaleDateString()}
                      </p>
                    </div>
                  )}

                  {/* Complete Button */}
                  {canManage && !stage.completedAt && stageStatuses[idx] !== "completed" && (
                    <div className="mt-3">
                      <button
                        onClick={() => onStageComplete?.(stage.id)}
                        className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        Mark Complete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Audit Trail</h4>
        <p className="text-sm text-blue-800">
          This case has an immutable record of all communications, documents, and actions. Every stage completion and escalation is logged for regulatory and tribunal compliance.
        </p>
      </div>
    </div>
  )
}
