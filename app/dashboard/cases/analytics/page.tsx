"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import AnalyticsDashboard from "@/components/cases/AnalyticsDashboard"

export default function AnalyticsPage() {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null)
  const [properties, setProperties] = useState<Array<{ id: string; address: string }>>([])
  const [loading, setLoading] = useState(true)

  const loadProperties = async () => {
    try {
      const response = await fetch("/api/properties")
      if (response.ok) {
        const data = await response.json()
        setProperties(data)
        if (data.length > 0) {
          setSelectedPropertyId(data[0].id)
        }
      }
    } catch (err) {
      console.error("Error loading properties:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProperties()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  if (properties.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">No properties available</p>
        <Link href="/dashboard/properties" className="text-blue-600 hover:underline">
          Create a property first
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📊 Case Analytics</h1>
          <p className="text-gray-600 mt-1">
            Performance metrics and insights across your cases
          </p>
        </div>
      </div>

      {/* Property Selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Property
        </label>
        <select
          value={selectedPropertyId || ""}
          onChange={(e) => setSelectedPropertyId(e.target.value)}
          aria-label="Select property for analytics"
          title="Select a property to view its case analytics"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {properties.map((prop) => (
            <option key={prop.id} value={prop.id}>
              {prop.address}
            </option>
          ))}
        </select>
      </div>

      {/* Analytics Dashboard */}
      {selectedPropertyId && (
        <AnalyticsDashboard propertyId={selectedPropertyId} />
      )}

      {/* Footer Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-900">
          <span className="font-semibold">💡 About Analytics:</span> These metrics
          track case resolution times, status distribution, SLA compliance, and team
          performance. Data is calculated from all historical cases for this property.
        </p>
      </div>
    </div>
  )
}
