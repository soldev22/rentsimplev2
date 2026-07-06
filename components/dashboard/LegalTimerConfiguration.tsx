"use client"

import { useState, useTransition } from "react"
import type { CaseType, LegalTimerConfiguration, LegalTimerRequirement } from "@/lib/auth"
import { getDefaultLegalTimerConfig } from "@/lib/server/cases"

type LegalTimerConfigProps = {
  onConfigurationUpdate?: (config: LegalTimerConfiguration) => void
}

const CASE_TYPES: Array<{ value: CaseType; label: string }> = [
  { value: "damp", label: "Damp & Mould" },
  { value: "flood", label: "Flood & Water Damage" },
  { value: "maintenance_request", label: "Maintenance Request" },
  { value: "complaint", label: "Tenant Complaint" },
  { value: "rent_dispute", label: "Rent Dispute" },
  { value: "legal_notice", label: "Legal Notice" },
]

export default function LegalTimerConfiguration({ onConfigurationUpdate }: LegalTimerConfigProps) {
  const [selectedCaseType, setSelectedCaseType] = useState<CaseType>("damp")
  const [isEditMode, setIsEditMode] = useState(false)
  const [isPending, startTransition] = useTransition()

  const config = getDefaultLegalTimerConfig(selectedCaseType)

  const handleEditRequirement = (requirementId: string, updates: Partial<LegalTimerRequirement>) => {
    // Will be implemented when we add backend persistence
    console.log("Edit requirement:", requirementId, updates)
  }

  const handleAddRequirement = () => {
    // Will be implemented when we add backend persistence
    console.log("Add requirement to", selectedCaseType)
  }

  return (
    <div className="space-y-6">
      {/* Case Type Selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Legal Timer Configuration</h2>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Case Type</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {CASE_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => {
                  setSelectedCaseType(type.value)
                  setIsEditMode(false)
                }}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  selectedCaseType === type.value
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Configuration Details */}
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900">{config.displayName}</h3>
            <p className="text-sm text-gray-600 mt-1">{config.description}</p>
          </div>

          {/* Requirements List */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900">Requirements & Timelines</h4>
              {!isEditMode && (
                <button
                  onClick={() => setIsEditMode(true)}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Edit
                </button>
              )}
            </div>

            {config.requirements.map((req, idx) => (
              <div key={req.id} className="bg-white rounded border border-gray-200 p-4">
                <div className="flex items-start gap-4">
                  {/* Step Number */}
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold flex-shrink-0">
                    {req.order}
                  </div>

                  {/* Requirement Details */}
                  <div className="flex-1 min-w-0">
                    {isEditMode ? (
                      <input
                        type="text"
                        defaultValue={req.requirement}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label="Edit requirement description"
                        title="Enter the requirement description"
                      />
                    ) : (
                      <p className="font-medium text-gray-900">{req.requirement}</p>
                    )}

                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-gray-600">Timeline</label>
                        {isEditMode ? (
                          <div className="flex gap-2 mt-1">
                            <input
                              type="number"
                              min="1"
                              defaultValue={req.daysAllowed}
                              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                              aria-label="Number of days allowed"
                              title="Number of days allowed for this requirement"
                            />
                            <select
                              defaultValue={req.workingDaysOnly ? "working_days" : "calendar_days"}
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                              aria-label="Select working or calendar days"
                              title="Choose whether to count working days or calendar days"
                            >
                              <option value="working_days">Working days</option>
                              <option value="calendar_days">Calendar days</option>
                            </select>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-700 mt-1">
                            <span className="font-semibold text-lg">{req.daysAllowed}</span>{" "}
                            {req.workingDaysOnly ? "working days" : "calendar days"}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-600">Escalation Alerts</label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {req.escalationAlerts.map((alert) => (
                            <span
                              key={alert}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800"
                            >
                              {alert.replace("alert_", "")}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Notification Toggles */}
                    {isEditMode && (
                      <div className="mt-3 flex gap-4 text-sm">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" defaultChecked={req.notifyOnCreation} className="rounded" />
                          <span>Notify on creation</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" defaultChecked={req.notifyOnEscalation} className="rounded" />
                          <span>Notify on escalation</span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isEditMode && (
              <button
                onClick={handleAddRequirement}
                className="w-full py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors"
              >
                + Add Requirement
              </button>
            )}
          </div>

          {/* Save/Cancel */}
          {isEditMode && (
            <div className="flex gap-2">
              <button
                disabled={isPending}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? "Saving..." : "Save Changes"}
              </button>
              <button
                onClick={() => setIsEditMode(false)}
                disabled={isPending}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">How Legal Timers Work</h4>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• When a case is created, requirements are automatically staged with calculated due dates</li>
          <li>• Working days exclude weekends (and optionally holidays)</li>
          <li>• Escalation alerts trigger notifications at 24h, 72h, and 5 days overdue</li>
          <li>• All timeline activities are recorded in the immutable audit trail</li>
          <li>• Landlords can override individual due dates for specific cases if needed</li>
        </ul>
      </div>
    </div>
  )
}
