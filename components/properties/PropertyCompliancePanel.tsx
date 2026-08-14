"use client"

import { useRef, useState, useTransition } from "react"

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

export type ComplianceSummaryRow = {
  type: ComplianceType
  label: string
  renewalLabel: string
  done: string
  due: string
  uploadUrl: string
  status: "expired" | "expiring_soon" | "ok"
  recordId?: string
}

export function buildComplianceSummaryRows(property: PropertyRecord): ComplianceSummaryRow[] {
  const recordIndex = new Map(
    (property.compliance ?? []).map((item) => [item.type, item] as const),
  )

  return COMPLIANCE_TYPES.map((type) => {
    const record = recordIndex.get(type)
    const dueDate = record?.expirationDate ?? ""
    const doneDate = record?.lastCheckedDate ?? ""
    const status = dueDate ? getComplianceStatus(dueDate) : "ok"

    return {
      type,
      label: COMPLIANCE_LABELS[type],
      renewalLabel: `Every ${DEFAULT_COMPLIANCE_YEARS[type]} ${DEFAULT_COMPLIANCE_YEARS[type] === 1 ? "year" : "years"}`,
      done: doneDate,
      due: dueDate,
      uploadUrl: record?.documentUrl ?? "",
      status,
      recordId: record?.id,
    }
  })
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
  const [uploadingRowType, setUploadingRowType] = useState<ComplianceType | null>(null)
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
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const currentUploadTypeRef = useRef<ComplianceType | null>(null)

  const compliance = property.compliance ?? []
  const summaryRows = buildComplianceSummaryRows(property)

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

  const handleUploadClick = (type?: ComplianceType) => {
    const uploadType = type ?? formState.type
    currentUploadTypeRef.current = uploadType
    setUploadingRowType(uploadType)
    fileInputRef.current?.click()
  }

  const handleUploadFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    const type = currentUploadTypeRef.current ?? formState.type

    if (!file || !type) {
      setUploadingRowType(null)
      currentUploadTypeRef.current = null
      return
    }

    const allowedExtensions = ["pdf", "png", "jpg", "jpeg", "gif", "webp", "doc", "docx", "xls", "xlsx", "csv", "txt"]
    const extension = file.name.split(".").pop()?.toLowerCase()

    if (!extension || !allowedExtensions.includes(extension)) {
      alert("Unsupported file type. Please upload a PDF, image, or office document.")
      event.target.value = ""
      setUploadingRowType(null)
      currentUploadTypeRef.current = null
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("File is too large. Please upload a file smaller than 10MB.")
      event.target.value = ""
      setUploadingRowType(null)
      currentUploadTypeRef.current = null
      return
    }

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", type)

      const response = await fetch(`/api/properties/${property.id}/compliance/upload`, {
        method: "POST",
        body: formData,
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error || "Failed to upload compliance certificate")
      }

      const url = payload.url as string | undefined
      const record = compliance.find((item) => item.type === type)
      const nextFormState = {
        type,
        lastCheckedDate: record?.lastCheckedDate ?? new Date().toISOString().split("T")[0],
        expirationDate: record?.expirationDate ?? "",
        certificateNumber: record?.certificateNumber ?? "",
        provider: record?.provider ?? "",
        documentUrl: url ?? record?.documentUrl ?? "",
        notes: record?.notes ?? "",
      }

      setFormState(nextFormState)
      setEditingId(record?.id ?? null)
      setIsEditMode(true)
      setUploadingRowType(null)
      currentUploadTypeRef.current = null
      event.target.value = ""
      alert("Certificate uploaded. Save the compliance record to keep the file link.")
    } catch (error) {
      console.error("Error uploading compliance file:", error)
      alert(error instanceof Error ? error.message : "Failed to upload compliance file")
      event.target.value = ""
      setUploadingRowType(null)
      currentUploadTypeRef.current = null
    }
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

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"
        onChange={handleUploadFileChange}
      />

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
                aria-label="Select compliance type"
                title="Select the type of compliance to track"
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
                  aria-label="Date of last compliance check"
                  title="When was this compliance requirement last checked"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Expiration Date *</label>
                <input
                  type="date"
                  value={formState.expirationDate}
                  onChange={(e) => setFormState({ ...formState, expirationDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Compliance expiration date"
                  title="When does this compliance requirement expire"
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
              <div className="flex gap-2">
                <input
                  type="url"
                  value={formState.documentUrl}
                  onChange={(e) => setFormState({ ...formState, documentUrl: e.target.value })}
                  placeholder="https://..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => handleUploadClick(formState.type)}
                  className="px-3 py-2 border border-blue-300 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors text-sm font-medium"
                >
                  {uploadingRowType === formState.type ? "Uploading..." : "Upload"}
                </button>
              </div>
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        <div className="grid grid-cols-[1.7fr_1fr_1fr_1.1fr] border-b border-slate-200 bg-slate-100 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
          <div className="px-4 py-3">Requirement</div>
          <div className="px-4 py-3">Done</div>
          <div className="px-4 py-3">Due</div>
          <div className="px-4 py-3">Evidence</div>
        </div>

        {summaryRows.map((row) => {
          const rowStatus = row.status
          const record = compliance.find((item) => item.type === row.type)
          const isMissing = !record

          return (
            <div
              key={row.type}
              className={`grid grid-cols-[1.7fr_1fr_1fr_1.1fr] border-b border-slate-200 last:border-b-0 ${getStatusColor(rowStatus)}`}
            >
              <div className="flex items-center gap-3 px-4 py-4">
                <div className="mt-0.5">{getStatusIcon(rowStatus)}</div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">{row.label}</div>
                  <div className="text-xs text-slate-600">{row.renewalLabel}</div>
                </div>
              </div>

              <div className="px-4 py-4 text-sm text-slate-800">
                {row.done ? (
                  <div className="font-medium">{new Date(row.done).toLocaleDateString()}</div>
                ) : (
                  <div className="text-slate-400">Not recorded</div>
                )}
              </div>

              <div className="px-4 py-4 text-sm text-slate-800">
                {row.due ? (
                  <div className="font-medium">{new Date(row.due).toLocaleDateString()}</div>
                ) : (
                  <div className="text-slate-400">No due date</div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 px-4 py-4">
                <div className="flex items-center gap-2">
                  {row.uploadUrl ? (
                    <a
                      href={row.uploadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-700 hover:text-blue-900 underline"
                    >
                      View
                    </a>
                  ) : (
                    <span className="text-sm text-slate-400">No file</span>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                      onClick={() => handleUploadClick(row.type)}
                    >
                      {uploadingRowType === row.type ? "Uploading..." : "Upload certificate"}
                    </button>
                  )}
                </div>
                {canManage && (
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                    onClick={() => {
                      if (record) {
                        handleEdit(record)
                        return
                      }

                      setFormState({
                        type: row.type,
                        lastCheckedDate: new Date().toISOString().split("T")[0],
                        expirationDate: "",
                        certificateNumber: "",
                        provider: "",
                        documentUrl: "",
                        notes: "",
                      })
                      setEditingId(null)
                      setIsEditMode(true)
                    }}
                  >
                    {isMissing ? "Add" : "Edit"}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}
