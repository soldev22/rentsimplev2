"use client"

import { useState, useTransition } from "react"

import type { PropertyCompliance, PropertyRecord, ComplianceType } from "@/lib/auth"

type ComplianceFormState = {
  type: ComplianceType
  lastCheckedDate: string
  expirationDate: string
  certificateNumber: string
  provider: string
  documentUrl: string
  notes: string
}

const COMPLIANCE_LABELS: Record<ComplianceType, string> = {
  electrical: "Electrical Installation (EICR)",
  gas: "Gas Safety Certificate",
  fire_alarm: "Fire Alarm",
  legionella: "Legionella Control",
  epc: "Energy Performance Certificate (EPC)",
  damp_survey: "Damp Survey",
  asbestos_survey: "Asbestos Survey",
  pest_control: "Pest Control",
  boiler_service: "Boiler Service",
}

const COMPLIANCE_TYPES: ComplianceType[] = [
  "electrical",
  "gas",
  "fire_alarm",
  "legionella",
  "epc",
  "damp_survey",
  "asbestos_survey",
  "pest_control",
  "boiler_service",
]

const DEFAULT_COMPLIANCE_YEARS: Record<ComplianceType, number> = {
  electrical: 5,
  gas: 1,
  fire_alarm: 1,
  legionella: 1,
  epc: 10,
  damp_survey: 3,
  asbestos_survey: 5,
  pest_control: 1,
  boiler_service: 1,
}

function getComplianceStatus(expirationDate: string): "expired" | "expiring_soon" | "ok" {
  try {
    const exp = new Date(expirationDate)
    const now = new Date()
    const daysUntilExpiry = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)

    if (daysUntilExpiry < 0) return "expired"
    if (daysUntilExpiry < 30) return "expiring_soon"
    return "ok"
  } catch {
    return "ok"
  }
}

function getStatusColor(status: "expired" | "expiring_soon" | "ok") {
  switch (status) {
    case "expired":
      return "bg-red-50 border-red-200"
    case "expiring_soon":
      return "bg-amber-50 border-amber-200"
    case "ok":
      return "bg-green-50 border-green-200"
  }
}

function getStatusIcon(status: "expired" | "expiring_soon" | "ok") {
  switch (status) {
    case "expired":
      return <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center text-white font-bold text-xs">!</div>
    case "expiring_soon":
      return <div className="w-5 h-5 rounded-full bg-amber-600 flex items-center justify-center text-white font-bold text-xs">⚠</div>
    case "ok":
      return <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-xs">✓</div>
  }
}

function getStatusBadgeClass(status: "expired" | "expiring_soon" | "ok") {
  switch (status) {
    case "expired":
      return "bg-red-100 text-red-800"
    case "expiring_soon":
      return "bg-amber-100 text-amber-800"
    case "ok":
      return "bg-green-100 text-green-800"
  }
}

function getStatusLabel(status: "expired" | "expiring_soon" | "ok") {
  switch (status) {
    case "expired":
      return "Expired"
    case "expiring_soon":
      return "Expiring Soon"
    case "ok":
      return "Compliant"
  }
}

type PropertyCompliancePanelProps = {
  property: PropertyRecord
  canManage: boolean
  onPropertyUpdate: (updated: PropertyRecord) => void
}

export default function PropertyCompliancePanel({
  property,
  canManage,
  onPropertyUpdate,
}: PropertyCompliancePanelProps) {
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formState, setFormState] = useState<ComplianceFormState>({
    type: "electrical",
    lastCheckedDate: new Date().toISOString().split("T")[0],
    expirationDate: "",
    certificateNumber: "",
    provider: "",
    documentUrl: "",
    notes: "",
  })
  const [isPending, startTransition] = useTransition()

  const compliance = property.compliance ?? []

  const handleAdd = () => {
    setEditingId(null)
    setFormState({
      type: "electrical",
      lastCheckedDate: new Date().toISOString().split("T")[0],
      expirationDate: "",
      certificateNumber: "",
      provider: "",
      documentUrl: "",
      notes: "",
    })
    setIsEditMode(true)
  }

  const handleEdit = (item: PropertyCompliance) => {
    setEditingId(item.id)
    setFormState({
      type: item.type,
      lastCheckedDate: item.lastCheckedDate,
      expirationDate: item.expirationDate,
      certificateNumber: item.certificateNumber ?? "",
      provider: item.provider ?? "",
      documentUrl: item.documentUrl ?? "",
      notes: item.notes ?? "",
    })
    setIsEditMode(true)
  }

  const handleSubmit = () => {
    if (!formState.expirationDate) {
      alert("Expiration date is required")
      return
    }

    startTransition(async () => {
      try {
        const url = `/api/properties/${property.id}/compliance`
        const method = editingId ? "PUT" : "POST"
        const body = editingId
          ? {
              complianceId: editingId,
              compliance: {
                id: editingId,
                type: formState.type,
                lastCheckedDate: formState.lastCheckedDate,
                expirationDate: formState.expirationDate,
                certificateNumber: formState.certificateNumber || undefined,
                provider: formState.provider || undefined,
                documentUrl: formState.documentUrl || undefined,
                notes: formState.notes || undefined,
              },
            }
          : {
              compliance: {
                id: "",
                type: formState.type,
                lastCheckedDate: formState.lastCheckedDate,
                expirationDate: formState.expirationDate,
                certificateNumber: formState.certificateNumber || undefined,
                provider: formState.provider || undefined,
                documentUrl: formState.documentUrl || undefined,
                notes: formState.notes || undefined,
              },
            }

        const response = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          throw new Error("Failed to update compliance")
        }

        const updated = await response.json()
        onPropertyUpdate(updated)
        setIsEditMode(false)
        setEditingId(null)
      } catch (error) {
        console.error("Error updating compliance:", error)
        alert("Failed to update compliance. Please try again.")
      }
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to remove this compliance record?")) {
      return
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/properties/${property.id}/compliance`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ complianceId: id }),
        })

        if (!response.ok) {
          throw new Error("Failed to delete compliance")
        }

        const updated = await response.json()
        onPropertyUpdate(updated)
      } catch (error) {
        console.error("Error deleting compliance:", error)
        alert("Failed to delete compliance. Please try again.")
      }
    })
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Compliance & Certifications</h3>
        {canManage && !isEditMode && (
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <span className="text-lg leading-none">+</span>
            Add
          </button>
        )}
      </div>

      {isEditMode ? (
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 mb-6">
          <h4 className="font-medium text-gray-900 mb-4">
            {editingId ? "Edit Compliance" : "Add New Compliance"}
          </h4>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type *</label>
              <select
                value={formState.type}
                onChange={(e) => setFormState({ ...formState, type: e.target.value as ComplianceType })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {COMPLIANCE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {COMPLIANCE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Checked</label>
                <input
                  type="date"
                  value={formState.lastCheckedDate}
                  onChange={(e) => setFormState({ ...formState, lastCheckedDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Expiration Date *</label>
                <input
                  type="date"
                  value={formState.expirationDate}
                  onChange={(e) => setFormState({ ...formState, expirationDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Certificate Number</label>
                <input
                  type="text"
                  value={formState.certificateNumber}
                  onChange={(e) => setFormState({ ...formState, certificateNumber: e.target.value })}
                  placeholder="e.g., EICR123456"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
                <input
                  type="text"
                  value={formState.provider}
                  onChange={(e) => setFormState({ ...formState, provider: e.target.value })}
                  placeholder="e.g., SafeElectrical Ltd"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Document URL</label>
              <input
                type="url"
                value={formState.documentUrl}
                onChange={(e) => setFormState({ ...formState, documentUrl: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                value={formState.notes}
                onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={handleSubmit}
                disabled={isPending}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setIsEditMode(false)}
                disabled={isPending}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {compliance.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {canManage ? "No compliance records yet. Add one to get started." : "No compliance records available."}
        </div>
      ) : (
        <div className="space-y-3">
          {compliance.map((item) => {
            const status = getComplianceStatus(item.expirationDate)
            return (
              <div
                key={item.id}
                className={`rounded-lg border p-4 ${getStatusColor(status)} flex items-start justify-between`}
              >
                <div className="flex gap-3 flex-1">
                  <div className="mt-1">{getStatusIcon(status)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-gray-900">{COMPLIANCE_LABELS[item.type]}</span>
                      <span className={`text-xs font-medium px-2 py-1 rounded ${getStatusBadgeClass(status)}`}>
                        {getStatusLabel(status)}
                      </span>
                    </div>
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <dt className="text-gray-600">Expires:</dt>
                        <dd className="font-medium text-gray-900">{new Date(item.expirationDate).toLocaleDateString()}</dd>
                      </div>
                      {item.certificateNumber && (
                        <div>
                          <dt className="text-gray-600">Certificate:</dt>
                          <dd className="font-medium text-gray-900">{item.certificateNumber}</dd>
                        </div>
                      )}
                      {item.provider && (
                        <div>
                          <dt className="text-gray-600">Provider:</dt>
                          <dd className="font-medium text-gray-900">{item.provider}</dd>
                        </div>
                      )}
                      <div>
                        <dt className="text-gray-600">Checked:</dt>
                        <dd className="font-medium text-gray-900">{new Date(item.lastCheckedDate).toLocaleDateString()}</dd>
                      </div>
                    </dl>
                    {item.documentUrl && (
                      <div className="mt-2">
                        <a
                          href={item.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          View Document →
                        </a>
                      </div>
                    )}
                    {item.notes && <p className="text-sm text-gray-600 mt-2">{item.notes}</p>}
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(item)}
                      className="px-2 py-1 text-sm text-blue-600 hover:bg-blue-100 rounded transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="px-2 py-1 text-sm text-red-600 hover:bg-red-100 rounded transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="font-medium text-blue-900 mb-2">Typical Renewal Periods</h4>
        <dl className="grid grid-cols-2 gap-2 text-sm text-blue-800">
          <div>
            <dt className="font-medium">Electrical (EICR):</dt>
            <dd>Every 5 years</dd>
          </div>
          <div>
            <dt className="font-medium">Gas Safety:</dt>
            <dd>Every 12 months</dd>
          </div>
          <div>
            <dt className="font-medium">Fire Alarm:</dt>
            <dd>Every 12 months</dd>
          </div>
          <div>
            <dt className="font-medium">Legionella:</dt>
            <dd>Every 12 months</dd>
          </div>
          <div>
            <dt className="font-medium">EPC:</dt>
            <dd>Every 10 years</dd>
          </div>
          <div>
            <dt className="font-medium">Boiler Service:</dt>
            <dd>Every 12 months</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
