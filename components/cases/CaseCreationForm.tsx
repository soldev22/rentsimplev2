"use client"

import { useState, useCallback } from "react"
import type { PropertyCase } from "@/lib/auth"
import type { CaseType } from "@/lib/types/case"

type Property = {
  id: string
  address: string
}

type Tenancy = {
  id: string
  tenantName: string
}

type CaseCreationFormProps = {
  properties: Property[]
  tenancies?: Record<string, Tenancy[]>
  isOpen: boolean
  onClose: () => void
  onSuccess?: (case_: PropertyCase) => void
}

const CASE_TYPES: { value: CaseType; label: string }[] = [
  { value: "damp", label: "Damp & Mold" },
  { value: "flood", label: "Flooding" },
  { value: "maintenance_request", label: "Maintenance Request" },
  { value: "complaint", label: "Tenant Complaint" },
  { value: "rent_dispute", label: "Rent Dispute" },
  { value: "legal_notice", label: "Legal Notice" },
]

export default function CaseCreationForm({
  properties,
  tenancies = {},
  isOpen,
  onClose,
  onSuccess,
}: CaseCreationFormProps) {
  const [selectedProperty, setSelectedProperty] = useState<string>("")
  const [selectedTenancy, setSelectedTenancy] = useState<string>("")
  const [caseType, setCaseType] = useState<CaseType>("damp")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)

      if (!selectedProperty || !title.trim()) {
        setError("Please select a property and enter a case title")
        return
      }

      setIsLoading(true)
      try {
        const response = await fetch(`/api/properties/${selectedProperty}/cases`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            caseType,
            title,
            description,
            tenancyId: selectedTenancy || undefined,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Failed to create case")
        }

        const case_ = await response.json()
        onSuccess?.(case_)

        // Reset form
        setTitle("")
        setDescription("")
        setSelectedProperty("")
        setSelectedTenancy("")
        setCaseType("damp")
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setIsLoading(false)
      }
    },
    [selectedProperty, caseType, title, description, selectedTenancy, onClose, onSuccess]
  )

  if (!isOpen) return null

  const selectedPropertyTenancies = selectedProperty ? tenancies[selectedProperty] || [] : []

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto shadow-lg">
        {/* Header */}
        <div className="sticky top-0 border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Create New Case</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close dialog"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Property Select */}
          <div>
            <label htmlFor="property" className="block text-sm font-medium text-gray-900 mb-1">
              Property
            </label>
            <select
              id="property"
              value={selectedProperty}
              onChange={(e) => {
                setSelectedProperty(e.target.value)
                setSelectedTenancy("")
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Select the property for this case"
              title="Choose a property"
              disabled={isLoading}
            >
              <option value="">Select a property...</option>
              {properties.map((prop) => (
                <option key={prop.id} value={prop.id}>
                  {prop.address}
                </option>
              ))}
            </select>
          </div>

          {/* Case Type Select */}
          <div>
            <label htmlFor="caseType" className="block text-sm font-medium text-gray-900 mb-1">
              Case Type
            </label>
            <select
              id="caseType"
              value={caseType}
              onChange={(e) => setCaseType(e.target.value as CaseType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Select the type of case"
              title="Choose a case type"
              disabled={isLoading}
            >
              {CASE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tenancy Select (optional) */}
          {selectedPropertyTenancies.length > 0 && (
            <div>
              <label htmlFor="tenancy" className="block text-sm font-medium text-gray-900 mb-1">
                Tenancy (optional)
              </label>
              <select
                id="tenancy"
                value={selectedTenancy}
                onChange={(e) => setSelectedTenancy(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Select a tenancy for this case"
                title="Choose a tenancy"
                disabled={isLoading}
              >
                <option value="">Not related to specific tenancy</option>
                {selectedPropertyTenancies.map((tenancy) => (
                  <option key={tenancy.id} value={tenancy.id}>
                    {tenancy.tenantName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Title Input */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-900 mb-1">
              Case Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Damp in master bedroom"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Enter the case title"
              title="Brief description of the case"
              disabled={isLoading}
            />
          </div>

          {/* Description Textarea */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-900 mb-1">
              Description (optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide additional details..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Enter additional case details"
              title="Provide more context about the case"
              disabled={isLoading}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              disabled={isLoading}
              aria-label="Cancel and close"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              disabled={isLoading || !selectedProperty || !title.trim()}
              aria-label={isLoading ? "Creating case..." : "Create the case"}
            >
              {isLoading ? "Creating..." : "Create Case"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
