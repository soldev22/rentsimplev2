"use client"

import { useRef, useState, useTransition } from "react"

import type { ComplianceDocument, PropertyCompliance, PropertyRecord, ComplianceType } from "@/lib/auth"

type ComplianceFormState = {
  type: ComplianceType
  patItemId: string
  lastCheckedDate: string
  expirationDate: string
  certificateNumber: string
  epcRating: "" | "A" | "B" | "C" | "D" | "E" | "F" | "G"
  provider: string
  documentUrl: string
  documents: ComplianceDocument[]
  notApplicable: boolean
  notes: string
}

const COMPLIANCE_LABELS: Record<ComplianceType, string> = {
  electrical: "Electrical Installation (EICR)",
  gas: "Gas Safety Certificate and Carbon Monoxide Alarms",
  fire_alarm: "Fire Alarm",
  smoke_alarm: "Smoke and Heat Alarm Testing",
  legionella: "Legionella Control",
  epc: "Energy Performance Certificate (EPC)",
  damp_survey: "Damp Survey",
  asbestos_survey: "Asbestos Survey",
  pest_control: "Pest Control",
  boiler_service: "Boiler Service",
  pat_testing: "PAT Testing for Included Electrical Items",
}

const COMPLIANCE_TYPES: ComplianceType[] = [
  "electrical",
  "gas",
  "fire_alarm",
  "smoke_alarm",
  "legionella",
  "epc",
  "damp_survey",
  "asbestos_survey",
  "pest_control",
  "boiler_service",
  "pat_testing",
]

const DEFAULT_COMPLIANCE_YEARS: Record<ComplianceType, number> = {
  electrical: 5,
  gas: 1,
  fire_alarm: 1,
  smoke_alarm: 1,
  legionella: 1,
  epc: 10,
  damp_survey: 3,
  asbestos_survey: 5,
  pest_control: 1,
  boiler_service: 1,
  pat_testing: 1,
}

type ComplianceStatus = "not_applicable" | "red" | "amber" | "green"

function getComplianceStatus(expirationDate: string, notApplicable = false): ComplianceStatus {
  if (notApplicable) return "not_applicable"
  if (!expirationDate) return "red"

  try {
    const exp = new Date(`${expirationDate}T00:00:00`)
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const daysUntilExpiry = Math.floor((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntilExpiry > 90) return "green"
    if (daysUntilExpiry > 30) return "amber"
    return "red"
  } catch {
    return "red"
  }
}

function getStatusColor(status: ComplianceStatus) {
  switch (status) {
    case "red":
      return "border-l-4 border-red-500 bg-red-100"
    case "amber":
      return "border-l-4 border-amber-500 bg-amber-100"
    case "green":
    case "not_applicable":
      return "border-l-4 border-green-500 bg-green-100"
  }
}

function getStatusBadge(status: ComplianceStatus, expirationDate: string) {
  switch (status) {
    case "red":
      return {
        label: new Date(`${expirationDate}T00:00:00`).getTime() < new Date().setHours(0, 0, 0, 0)
          ? "Overdue"
          : "Due within 30 days",
        className: "bg-red-200 text-red-900",
      }
    case "amber":
      return { label: "Due in 31-90 days", className: "bg-amber-200 text-amber-900" }
    case "green":
      return { label: "More than 90 days", className: "bg-green-200 text-green-900" }
    case "not_applicable":
      return { label: "Not applicable", className: "bg-green-200 text-green-900" }
  }
}

function getStatusIcon(status: ComplianceStatus) {
  switch (status) {
    case "red":
      return <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center text-white font-bold text-xs">!</div>
    case "amber":
      return <div className="w-5 h-5 rounded-full bg-amber-600 flex items-center justify-center text-white font-bold text-xs">⚠</div>
    case "green":
    case "not_applicable":
      return <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-xs">✓</div>
  }
}

function getComplianceDocumentUrl(propertyId: string, document: ComplianceDocument) {
  if (document.blobName) {
    return `/api/properties/${propertyId}/compliance/documents/${document.blobName}`
  }

  if (document.url.startsWith("/api/")) {
    return document.url
  }

  const blobPath = `/properties/${propertyId}/compliance/`
  const pathIndex = document.url.indexOf(blobPath)
  return pathIndex >= 0
    ? `/api/properties/${propertyId}/compliance/documents/${document.url.slice(pathIndex + 1)}`
    : document.url
}

function getComplianceDocumentBlobName(propertyId: string, document: ComplianceDocument) {
  if (document.blobName) return document.blobName

  const blobPath = `/properties/${propertyId}/compliance/`
  const pathIndex = document.url.indexOf(blobPath)
  return pathIndex >= 0 ? document.url.slice(pathIndex + 1) : undefined
}

export type ComplianceSummaryRow = {
  type: ComplianceType
  patItemId?: string
  label: string
  renewalLabel: string
  done: string
  due: string
  uploadUrl: string
  documents: ComplianceDocument[]
  notApplicable: boolean
  status: ComplianceStatus
  recordId?: string
}

export function buildComplianceSummaryRows(property: PropertyRecord): ComplianceSummaryRow[] {
  const recordIndex = new Map(
    (property.compliance ?? []).filter((item) => item.type !== "pat_testing").map((item) => [item.type, item] as const),
  )

  const complianceTypes = COMPLIANCE_TYPES.filter((type) => type !== "pat_testing")

  const standardRows = complianceTypes.map((type) => {
    const record = recordIndex.get(type)
    const dueDate = record?.expirationDate ?? ""
    const doneDate = record?.lastCheckedDate ?? ""
    const documents = record?.documents?.length
      ? record.documents
      : record?.documentUrl
        ? [{ url: record.documentUrl, fileName: "Certificate", uploadedAt: "" }]
        : []
    const notApplicable = record?.notApplicable === true

    return {
      type,
      label: COMPLIANCE_LABELS[type],
      renewalLabel: `Every ${DEFAULT_COMPLIANCE_YEARS[type]} ${DEFAULT_COMPLIANCE_YEARS[type] === 1 ? "year" : "years"}`,
      done: doneDate,
      due: dueDate,
      uploadUrl: record?.documentUrl ?? "",
      documents,
      notApplicable,
      status: getComplianceStatus(dueDate, notApplicable),
      recordId: record?.id,
    }
  })

  const patRows = (property.includedItems ?? [])
    .filter((item) => item.isElectrical)
    .map((item) => {
      const record = property.compliance?.find((candidate) => candidate.type === "pat_testing" && candidate.patItemId === item.id)
      const due = record?.expirationDate ?? ""
      const documents = record?.documents?.length
        ? record.documents
        : record?.documentUrl ? [{ url: record.documentUrl, fileName: "Certificate", uploadedAt: "" }] : []
      const notApplicable = record?.notApplicable === true

      return {
        type: "pat_testing" as const,
        patItemId: item.id,
        label: `PAT Testing: ${item.name}`,
        renewalLabel: "Every 1 year",
        done: record?.lastCheckedDate ?? "",
        due,
        uploadUrl: record?.documentUrl ?? "",
        documents,
        notApplicable,
        status: getComplianceStatus(due, notApplicable),
        recordId: record?.id,
      }
    })

  return [...standardRows, ...patRows]
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
    patItemId: "",
    lastCheckedDate: new Date().toISOString().split("T")[0],
    expirationDate: "",
    certificateNumber: "",
    epcRating: "",
    provider: "",
    documentUrl: "",
    documents: [],
    notApplicable: false,
    notes: "",
  })
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const currentUploadTypeRef = useRef<ComplianceType | null>(null)
  const currentUploadPatItemIdRef = useRef<string | null>(null)

  const compliance = property.compliance ?? []
  const summaryRows = buildComplianceSummaryRows(property)

  const handleAdd = () => {
    setEditingId(null)
    setFormState({
      type: "electrical",
      patItemId: "",
      lastCheckedDate: new Date().toISOString().split("T")[0],
      expirationDate: "",
      certificateNumber: "",
      epcRating: "",
      provider: "",
      documentUrl: "",
      documents: [],
      notApplicable: false,
      notes: "",
    })
    setIsEditMode(true)
  }

  const handleEdit = (item: PropertyCompliance) => {
    setEditingId(item.id)
    setFormState({
      type: item.type,
      patItemId: item.patItemId ?? "",
      lastCheckedDate: item.lastCheckedDate,
      expirationDate: item.expirationDate,
      certificateNumber: item.certificateNumber ?? "",
      epcRating: item.epcRating ?? "",
      provider: item.provider ?? "",
      documentUrl: item.documentUrl ?? "",
      documents: item.documents ?? (item.documentUrl ? [{ url: item.documentUrl, fileName: "Certificate", uploadedAt: "" }] : []),
      notApplicable: item.notApplicable === true,
      notes: item.notes ?? "",
    })
    setIsEditMode(true)
  }

  const handleSubmit = () => {
    if (!formState.notApplicable && !formState.expirationDate) {
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
                patItemId: formState.type === "pat_testing" ? formState.patItemId : undefined,
                lastCheckedDate: formState.lastCheckedDate,
                expirationDate: formState.expirationDate,
                certificateNumber: formState.certificateNumber || undefined,
                epcRating: formState.type === "epc" ? formState.epcRating || undefined : undefined,
                provider: formState.provider || undefined,
                documentUrl: formState.documentUrl || undefined,
                documents: formState.documents,
                notApplicable: formState.notApplicable,
                notes: formState.notes || undefined,
              },
            }
          : {
              compliance: {
                id: "",
                type: formState.type,
                patItemId: formState.type === "pat_testing" ? formState.patItemId : undefined,
                lastCheckedDate: formState.lastCheckedDate,
                expirationDate: formState.expirationDate,
                certificateNumber: formState.certificateNumber || undefined,
                epcRating: formState.type === "epc" ? formState.epcRating || undefined : undefined,
                provider: formState.provider || undefined,
                documentUrl: formState.documentUrl || undefined,
                documents: formState.documents,
                notApplicable: formState.notApplicable,
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

  const handleDocumentDelete = (complianceId: string, document: ComplianceDocument) => {
    const blobName = getComplianceDocumentBlobName(property.id, document)
    if (!blobName) {
      alert("This certificate cannot be deleted because its storage reference is missing.")
      return
    }

    if (!confirm(`Delete ${document.fileName}? This cannot be undone.`)) return

    startTransition(async () => {
      try {
        const response = await fetch(`/api/properties/${property.id}/compliance/documents/${blobName}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ complianceId }),
        })
        const payload = await response.json() as { property?: PropertyRecord; error?: string }
        if (!response.ok || !payload.property) throw new Error(payload.error || "Failed to delete certificate")
        onPropertyUpdate(payload.property)
      } catch (error) {
        console.error("Error deleting compliance certificate:", error)
        alert(error instanceof Error ? error.message : "Failed to delete certificate")
      }
    })
  }

  const handleUploadClick = (type?: ComplianceType, patItemId?: string) => {
    const uploadType = type ?? formState.type
    currentUploadTypeRef.current = uploadType
    currentUploadPatItemIdRef.current = patItemId ?? (uploadType === "pat_testing" ? formState.patItemId : null)
    setUploadingRowType(uploadType)
    fileInputRef.current?.click()
  }

  const handleUploadFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    const type = currentUploadTypeRef.current ?? formState.type
    const patItemId = currentUploadPatItemIdRef.current ?? undefined

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
      const blobName = payload.blobName as string | undefined
      const record = compliance.find((item) => item.type === type && (type !== "pat_testing" || item.patItemId === patItemId))
      const existingDocuments = editingId && formState.type === type
        ? formState.documents
        : record?.documents ?? (record?.documentUrl
          ? [{ url: record.documentUrl, fileName: "Certificate", uploadedAt: "" }]
          : [])
      const documents = url
        ? [...existingDocuments, { url, blobName, fileName: file.name, uploadedAt: new Date().toISOString() }]
        : existingDocuments
      const nextFormState = {
        type,
        patItemId: patItemId ?? "",
        lastCheckedDate: record?.lastCheckedDate ?? new Date().toISOString().split("T")[0],
        expirationDate: record?.expirationDate ?? "",
        certificateNumber: record?.certificateNumber ?? "",
        epcRating: (record?.epcRating ?? "") as ComplianceFormState["epcRating"],
        provider: record?.provider ?? "",
        documentUrl: url ?? record?.documentUrl ?? "",
        documents,
        notApplicable: record?.notApplicable === true,
        notes: record?.notes ?? "",
      }

      setFormState(nextFormState)
      setEditingId(record?.id ?? null)
      setIsEditMode(true)
      setUploadingRowType(null)
      currentUploadTypeRef.current = null
      currentUploadPatItemIdRef.current = null
      event.target.value = ""
      alert("Certificate uploaded. Save the compliance record to add it to the certificate archive.")
    } catch (error) {
      console.error("Error uploading compliance file:", error)
      alert(error instanceof Error ? error.message : "Failed to upload compliance file")
      event.target.value = ""
      setUploadingRowType(null)
      currentUploadTypeRef.current = null
      currentUploadPatItemIdRef.current = null
    }
  }

  const handleNotApplicableChange = (type: ComplianceType, checked: boolean, patItemId?: string) => {
    const record = compliance.find((item) => item.type === type && (type !== "pat_testing" || item.patItemId === patItemId))
    const complianceRecord: PropertyCompliance = {
      id: record?.id ?? "",
      type,
      patItemId,
      lastCheckedDate: record?.lastCheckedDate ?? new Date().toISOString().split("T")[0],
      expirationDate: checked ? "" : record?.expirationDate ?? "",
      certificateNumber: record?.certificateNumber,
      epcRating: record?.epcRating,
      provider: record?.provider,
      documentUrl: record?.documentUrl,
      documents: record?.documents,
      notApplicable: checked,
      notes: record?.notes,
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/properties/${property.id}/compliance`, {
          method: record ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(record
            ? { complianceId: record.id, compliance: complianceRecord }
            : { compliance: complianceRecord }),
        })

        if (!response.ok) throw new Error("Failed to update compliance applicability")
        onPropertyUpdate(await response.json())
      } catch (error) {
        console.error("Error updating compliance applicability:", error)
        alert("Failed to update applicability. Please try again.")
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expiration Date {formState.notApplicable ? "" : "*"}
                </label>
                <input
                  type="date"
                  value={formState.expirationDate}
                  onChange={(e) => setFormState({ ...formState, expirationDate: e.target.value })}
                  disabled={formState.notApplicable}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
                  aria-label="Compliance expiration date"
                  title="When does this compliance requirement expire"
                />
              </div>
            </div>

            {formState.type === "epc" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">EPC Rating</label>
                <select
                  value={formState.epcRating}
                  onChange={(event) => setFormState({ ...formState, epcRating: event.target.value as ComplianceFormState["epcRating"] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select rating</option>
                  {(["A", "B", "C", "D", "E", "F", "G"] as const).map((rating) => (
                    <option key={rating} value={rating}>{rating}</option>
                  ))}
                </select>
              </div>
            )}

            <label className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={formState.notApplicable}
                onChange={(e) => setFormState({ ...formState, notApplicable: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
              />
              Not applicable to this property
            </label>

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
              {formState.documents.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {formState.documents.map((document, index) => (
                    <li key={`${document.url}-${index}`}>
                      <a href={getComplianceDocumentUrl(property.id, document)} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline hover:text-blue-900">
                        {document.fileName}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
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
          const statusBadge = getStatusBadge(rowStatus, row.due)
          const record = compliance.find((item) => item.type === row.type && (row.type !== "pat_testing" || item.patItemId === row.patItemId))
          const isMissing = !record

          return (
            <div
              key={row.patItemId ? `${row.type}-${row.patItemId}` : row.type}
              className={`grid grid-cols-[1.7fr_1fr_1fr_1.1fr] border-b border-slate-200 last:border-b-0 ${getStatusColor(rowStatus)}`}
            >
              <div className="flex items-center gap-3 px-4 py-4">
                <div className="mt-0.5">{getStatusIcon(rowStatus)}</div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">{row.label}</div>
                  <div className="text-xs text-slate-600">{row.renewalLabel}</div>
                  <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge.className}`}>
                    {statusBadge.label}
                  </span>
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
                {row.notApplicable ? (
                  <div className="font-medium text-green-800">Not applicable</div>
                ) : row.due ? (
                  <div className="font-medium">{new Date(row.due).toLocaleDateString()}</div>
                ) : (
                  <div className="text-slate-400">No due date</div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 px-4 py-4">
                <div className="flex items-center gap-2">
                  {row.documents.length > 0 ? (
                    <a
                      href={getComplianceDocumentUrl(property.id, row.documents[row.documents.length - 1])}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-700 hover:text-blue-900 underline"
                    >
                      View latest ({row.documents.length})
                    </a>
                  ) : (
                    <span className="text-sm text-slate-400">No file</span>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                      onClick={() => handleUploadClick(row.type, row.patItemId)}
                    >
                      {uploadingRowType === row.type ? "Uploading..." : "Upload certificate"}
                    </button>
                  )}
                  {row.documents.length > 0 && (
                    <details className="text-xs text-slate-700">
                      <summary className="cursor-pointer font-medium">Certificates ({row.documents.length})</summary>
                      <ul className="mt-1 space-y-1">
                        {row.documents.map((document, index) => (
                          <li key={`${document.url}-${index}`} className="flex items-center gap-2">
                            <a href={getComplianceDocumentUrl(property.id, document)} target="_blank" rel="noopener noreferrer" className="underline">
                              {document.fileName}
                            </a>
                            {canManage && record ? (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleDocumentDelete(record.id, document)}
                                className="font-semibold text-red-700 hover:underline disabled:opacity-50"
                              >
                                Delete
                              </button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
                {canManage && (
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-xs font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={row.notApplicable}
                        disabled={isPending}
                        onChange={(event) => handleNotApplicableChange(row.type, event.target.checked, row.patItemId)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-green-600 focus:ring-green-500"
                      />
                      N/A
                    </label>
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
                        patItemId: row.patItemId ?? "",
                        lastCheckedDate: new Date().toISOString().split("T")[0],
                        expirationDate: "",
                        certificateNumber: "",
                        epcRating: "",
                        provider: "",
                        documentUrl: "",
                        documents: [],
                        notApplicable: false,
                        notes: "",
                      })
                      setEditingId(null)
                      setIsEditMode(true)
                    }}
                    >
                      {isMissing ? "Add" : "Edit"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}
