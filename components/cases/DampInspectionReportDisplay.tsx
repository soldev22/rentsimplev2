"use client"

import type { DampInspectionReport } from "@/lib/types/case"

type DampInspectionReportDisplayProps = {
  reports: DampInspectionReport[]
  onSendReport?: (reportId: string, method: "email" | "dashboard") => Promise<void>
  sendingReportId?: string | null
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

function getSeverityColor(severity: string): string {
  switch (severity) {
    case "severe":
      return "bg-red-100 text-red-800"
    case "moderate":
      return "bg-orange-100 text-orange-800"
    case "minor":
      return "bg-yellow-100 text-yellow-800"
    case "none":
      return "bg-green-100 text-green-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

function getUrgencyColor(urgency: string): string {
  switch (urgency) {
    case "emergency":
      return "bg-red-100 text-red-800"
    case "high":
      return "bg-red-50 text-red-700"
    case "medium":
      return "bg-yellow-50 text-yellow-700"
    case "low":
      return "bg-green-50 text-green-700"
    default:
      return "bg-gray-50 text-gray-700"
  }
}

export default function DampInspectionReportDisplay({ 
  reports,
  onSendReport,
  sendingReportId,
}: DampInspectionReportDisplayProps) {
  if (!reports || reports.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">📋 Damp Inspection Reports</h3>
      {reports.map((report) => (
        <div key={report.id} className="border border-gray-200 rounded-lg p-4 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Inspection by {report.inspectorName}
              </p>
              <p className="text-xs text-gray-600">
                {formatDate(report.inspectionDate)}
              </p>
            </div>
            <div className="flex gap-2">
              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${getSeverityColor(report.severityLevel)}`}>
                {report.severityLevel}
              </span>
              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${getUrgencyColor(report.urgencyLevel)}`}>
                {report.urgencyLevel}
              </span>
            </div>
          </div>

          {/* Qualifications */}
          {report.inspectorQualifications && (
            <div>
              <p className="text-xs font-semibold text-gray-600">Qualifications:</p>
              <p className="text-sm text-gray-900">{report.inspectorQualifications}</p>
            </div>
          )}

          {/* Scope */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-600">Rooms Affected:</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {report.roomsAffected.map((room) => (
                  <span key={room} className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-xs text-gray-700">
                    {room}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600">Affected Area:</p>
              <p className="text-sm text-gray-900">{report.affectedArea || "Not specified"}</p>
            </div>
          </div>

          {/* Root Cause */}
          <div>
            <p className="text-xs font-semibold text-gray-600">Root Cause:</p>
            <p className="text-sm text-gray-900 capitalize">{report.rootCause.replace("_", " ")}</p>
            {report.rootCauseDescription && (
              <p className="text-sm text-gray-700 mt-1">{report.rootCauseDescription}</p>
            )}
          </div>

          {/* Visible Mold */}
          {report.visibleMoldCondensation && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <p className="text-sm text-red-800 font-semibold">⚠️ Visible Mold / Condensation Detected</p>
            </div>
          )}

          {/* Findings */}
          <div>
            <p className="text-xs font-semibold text-gray-600">Findings:</p>
            <p className="text-sm text-gray-900 whitespace-pre-wrap">{report.findings}</p>
          </div>

          {/* Recommended Action */}
          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-xs font-semibold text-blue-900 mb-2">Recommended Action:</p>
            <p className="text-sm text-blue-800 whitespace-pre-wrap">{report.recommendedAction}</p>
          </div>

          {/* Remediation */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-600">Timeline:</p>
              <p className="text-sm text-gray-900 capitalize">{report.remediationTimeline.replace("_", " ")}</p>
            </div>
            {report.estimatedCost && (
              <div>
                <p className="text-xs font-semibold text-gray-600">Estimated Cost:</p>
                <p className="text-sm text-gray-900">£{report.estimatedCost.toFixed(2)}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-gray-600">Submitted:</p>
              <p className="text-sm text-gray-900">{formatDate(report.reportSubmittedAt)}</p>
            </div>
          </div>

          {report.remediationNotes && (
            <div>
              <p className="text-xs font-semibold text-gray-600">Notes:</p>
              <p className="text-sm text-gray-900">{report.remediationNotes}</p>
            </div>
          )}

          {/* Send to Tenant Buttons */}
          {onSendReport && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <p className="text-xs font-semibold text-gray-600 mb-3">Send Report to Tenant:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={() => onSendReport(report.id, "email")}
                  disabled={sendingReportId === report.id}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors text-sm"
                  title="Send report as email attachment"
                >
                  {sendingReportId === report.id ? "Sending..." : "📧 Send via Email"}
                </button>
                <button
                  onClick={() => onSendReport(report.id, "dashboard")}
                  disabled={sendingReportId === report.id}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors text-sm"
                  title="Send dashboard link"
                >
                  {sendingReportId === report.id ? "Sending..." : "🔗 Send Dashboard Link"}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
