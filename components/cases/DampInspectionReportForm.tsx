"use client"

import { useState, useCallback } from "react"
import type { DampInspectionReport } from "@/lib/types/case"

type DampInspectionReportFormProps = {
  caseId: string
  stageId: string
  propertyId: string
  onSubmit: (report: Omit<DampInspectionReport, "id" | "caseId" | "stageId" | "propertyId" | "reportSubmittedAt">) => Promise<void>
  onClose: () => void
}

const ROOMS = [
  "Bedroom 1",
  "Bedroom 2",
  "Bedroom 3",
  "Kitchen",
  "Bathroom",
  "Lounge",
  "Hallway",
  "Basement",
  "Attic",
  "Other",
]

export default function DampInspectionReportForm({
  caseId,
  stageId,
  propertyId,
  onSubmit,
  onClose,
}: DampInspectionReportFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    inspectionDate: new Date().toISOString().split("T")[0],
    inspectorName: "",
    inspectorQualifications: "",
    roomsAffected: [] as string[],
    affectedArea: "",
    visibleMoldCondensation: false,
    severityLevel: "minor" as "none" | "minor" | "moderate" | "severe",
    rootCause: "condensation" as "penetrating_damp" | "rising_damp" | "condensation" | "plumbing_leak" | "other",
    rootCauseDescription: "",
    findings: "",
    recommendedAction: "",
    urgencyLevel: "medium" as "low" | "medium" | "high" | "emergency",
    estimatedCost: "",
    remediationTimeline: "14_days" as "immediate" | "7_days" | "14_days" | "28_days" | "other",
    remediationNotes: "",
    attachmentIds: [] as string[],
  })

  const handleRoomToggle = useCallback((room: string) => {
    setFormData((prev) => ({
      ...prev,
      roomsAffected: prev.roomsAffected.includes(room)
        ? prev.roomsAffected.filter((r) => r !== room)
        : [...prev.roomsAffected, room],
    }))
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)
      setLoading(true)

      try {
        if (!formData.inspectorName.trim()) {
          throw new Error("Inspector name is required")
        }
        if (formData.roomsAffected.length === 0) {
          throw new Error("Please select at least one affected room")
        }
        if (!formData.findings.trim()) {
          throw new Error("Findings description is required")
        }
        if (!formData.recommendedAction.trim()) {
          throw new Error("Recommended action is required")
        }

        await onSubmit({
          inspectionDate: formData.inspectionDate,
          inspectorName: formData.inspectorName,
          inspectorQualifications: formData.inspectorQualifications || undefined,
          roomsAffected: formData.roomsAffected,
          affectedArea: formData.affectedArea,
          visibleMoldCondensation: formData.visibleMoldCondensation,
          severityLevel: formData.severityLevel,
          rootCause: formData.rootCause,
          rootCauseDescription: formData.rootCauseDescription,
          findings: formData.findings,
          recommendedAction: formData.recommendedAction,
          urgencyLevel: formData.urgencyLevel,
          estimatedCost: formData.estimatedCost ? parseFloat(formData.estimatedCost) : undefined,
          remediationTimeline: formData.remediationTimeline,
          remediationNotes: formData.remediationNotes || undefined,
          reportSubmittedBy: "", // Will be set by server
          attachmentIds: formData.attachmentIds,
        })

        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit report")
      } finally {
        setLoading(false)
      }
    },
    [formData, onSubmit, onClose]
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Damp Inspection Report</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800 text-sm">
              {error}
            </div>
          )}

          {/* INSPECTION DETAILS */}
          <fieldset className="border border-gray-200 rounded-lg p-4">
            <legend className="text-sm font-semibold text-gray-900 px-2">📋 Inspection Details</legend>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="inspectionDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Inspection *
                </label>
                <input
                  type="date"
                  id="inspectionDate"
                  value={formData.inspectionDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, inspectionDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="inspectorName" className="block text-sm font-medium text-gray-700 mb-1">
                  Inspector Name *
                </label>
                <input
                  type="text"
                  id="inspectorName"
                  value={formData.inspectorName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, inspectorName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Full name"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="inspectorQualifications" className="block text-sm font-medium text-gray-700 mb-1">
                  Qualifications / Company
                </label>
                <input
                  type="text"
                  id="inspectorQualifications"
                  value={formData.inspectorQualifications}
                  onChange={(e) => setFormData((prev) => ({ ...prev, inspectorQualifications: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., MRDEC Qualified, Property Diagnostics Ltd"
                />
              </div>
            </div>
          </fieldset>

          {/* LOCATION & SCOPE */}
          <fieldset className="border border-gray-200 rounded-lg p-4">
            <legend className="text-sm font-semibold text-gray-900 px-2">🏠 Location & Scope</legend>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Rooms Affected *</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {ROOMS.map((room) => (
                    <label key={room} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.roomsAffected.includes(room)}
                        onChange={() => handleRoomToggle(room)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        title={`Select ${room}`}
                      />
                      <span className="text-sm text-gray-700">{room}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="affectedArea" className="block text-sm font-medium text-gray-700 mb-1">
                  Affected Area (m² or %)
                </label>
                <input
                  type="text"
                  id="affectedArea"
                  value={formData.affectedArea}
                  onChange={(e) => setFormData((prev) => ({ ...prev, affectedArea: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 2.5 m² or 15%"
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.visibleMoldCondensation}
                  onChange={(e) => setFormData((prev) => ({ ...prev, visibleMoldCondensation: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  title="Visible mold or condensation"
                />
                <span className="text-sm font-medium text-gray-700">Visible Mold / Condensation?</span>
              </label>
            </div>
          </fieldset>

          {/* FINDINGS */}
          <fieldset className="border border-gray-200 rounded-lg p-4">
            <legend className="text-sm font-semibold text-gray-900 px-2">🔍 Findings</legend>
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="severityLevel" className="block text-sm font-medium text-gray-700 mb-1">
                    Severity Level *
                  </label>
                  <select
                    id="severityLevel"
                    value={formData.severityLevel}
                    onChange={(e) => setFormData((prev) => ({ ...prev, severityLevel: e.target.value as "none" | "minor" | "moderate" | "severe" }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="none">None</option>
                    <option value="minor">Minor</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="rootCause" className="block text-sm font-medium text-gray-700 mb-1">
                    Root Cause *
                  </label>
                  <select
                    id="rootCause"
                    value={formData.rootCause}
                    onChange={(e) => setFormData((prev) => ({ ...prev, rootCause: e.target.value as "penetrating_damp" | "rising_damp" | "condensation" | "plumbing_leak" | "other" }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="penetrating_damp">Penetrating Damp</option>
                    <option value="rising_damp">Rising Damp</option>
                    <option value="condensation">Condensation</option>
                    <option value="plumbing_leak">Plumbing Leak</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="rootCauseDescription" className="block text-sm font-medium text-gray-700 mb-1">
                  Root Cause Description
                </label>
                <textarea
                  id="rootCauseDescription"
                  value={formData.rootCauseDescription}
                  onChange={(e) => setFormData((prev) => ({ ...prev, rootCauseDescription: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Explain why this damp is occurring"
                />
              </div>
              <div>
                <label htmlFor="findings" className="block text-sm font-medium text-gray-700 mb-1">
                  Detailed Findings *
                </label>
                <textarea
                  id="findings"
                  value={formData.findings}
                  onChange={(e) => setFormData((prev) => ({ ...prev, findings: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  placeholder="Detailed description of findings, observations, and measurements"
                  required
                />
              </div>
            </div>
          </fieldset>

          {/* REMEDIATION */}
          <fieldset className="border border-gray-200 rounded-lg p-4">
            <legend className="text-sm font-semibold text-gray-900 px-2">💊 Remediation</legend>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="recommendedAction" className="block text-sm font-medium text-gray-700 mb-1">
                  Recommended Action *
                </label>
                <textarea
                  id="recommendedAction"
                  value={formData.recommendedAction}
                  onChange={(e) => setFormData((prev) => ({ ...prev, recommendedAction: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Specific actions required to remediate the damp issue"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="urgencyLevel" className="block text-sm font-medium text-gray-700 mb-1">
                    Urgency Level *
                  </label>
                  <select
                    id="urgencyLevel"
                    value={formData.urgencyLevel}
                    onChange={(e) => setFormData((prev) => ({ ...prev, urgencyLevel: e.target.value as "low" | "medium" | "high" | "emergency" }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="estimatedCost" className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated Cost (£)
                  </label>
                  <input
                    type="number"
                    id="estimatedCost"
                    value={formData.estimatedCost}
                    onChange={(e) => setFormData((prev) => ({ ...prev, estimatedCost: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div>
                  <label htmlFor="remediationTimeline" className="block text-sm font-medium text-gray-700 mb-1">
                    Remediation Timeline *
                  </label>
                  <select
                    id="remediationTimeline"
                    value={formData.remediationTimeline}
                    onChange={(e) => setFormData((prev) => ({ ...prev, remediationTimeline: e.target.value as "immediate" | "7_days" | "14_days" | "28_days" | "other" }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="immediate">Immediate</option>
                    <option value="7_days">Within 7 Days</option>
                    <option value="14_days">Within 14 Days</option>
                    <option value="28_days">Within 28 Days</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="remediationNotes" className="block text-sm font-medium text-gray-700 mb-1">
                  Remediation Notes
                </label>
                <textarea
                  id="remediationNotes"
                  value={formData.remediationNotes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, remediationNotes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Any additional notes about remediation"
                />
              </div>
            </div>
          </fieldset>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
            >
              {loading ? "Submitting..." : "Submit Report & Mark Complete"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
