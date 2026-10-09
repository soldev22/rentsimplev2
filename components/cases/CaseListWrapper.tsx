"use client"

import { useState, useCallback } from "react"
import CaseCreationForm from "@/components/cases/CaseCreationForm"
import type { PropertyCase } from "@/lib/auth"

type Property = {
  id: string
  address: string
}

type CaseListWrapperProps = {
  properties: Property[]
  initialCases: (PropertyCase & { propertyAddress: string })[]
  children: React.ReactNode
}

export default function CaseListWrapper({ properties, children }: CaseListWrapperProps) {
  const [isFormOpen, setIsFormOpen] = useState(false)

  const handleCaseCreated = useCallback(() => {
    // Close form and refresh
    setIsFormOpen(false)
    // Optionally trigger a refresh - for now, we'll let the user navigate to see the new case
    // In a real app, you might want to refetch here
    window.location.reload()
  }, [])

  return (
    <>
      <div className="space-y-6">
        {/* Header with Create Button */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Property Cases</h1>
            <p className="text-slate-600 mt-2">Track and manage all property cases across your portfolio</p>
          </div>
          <button
            onClick={() => setIsFormOpen(true)}
            className="brand-button px-4 py-2 rounded-md font-medium"
            aria-label="Create a new case"
            title="Create a new case"
          >
            + New Case
          </button>
        </div>

        {/* Cases Content */}
        {children}
      </div>

      {/* Create Case Modal */}
      <CaseCreationForm
        properties={properties}
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={handleCaseCreated}
      />
    </>
  )
}
