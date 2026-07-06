"use client"

import { useState, useEffect } from "react"
import type { AnalyticsMetrics } from "@/lib/auth"
import { ProgressBar } from "./ProgressBar"

type AnalyticsDashboardProps = {
  propertyId: string
}

function getStatusColor(status: string): string {
  switch (status) {
    case "resolved":
      return "text-green-600"
    case "investigating":
      return "text-blue-600"
    case "in_repair":
      return "text-yellow-600"
    case "overdue":
      return "text-red-600"
    default:
      return "text-gray-600"
  }
}

function MetricCard({
  label,
  value,
  subtext,
  highlight = false,
}: {
  label: string
  value: string | number
  subtext?: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight
          ? "bg-blue-50 border-blue-200"
          : "bg-white border-gray-200"
      }`}
      role="region"
      aria-label={`${label}: ${value}`}
    >
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p
        className={`text-2xl font-bold mt-2 ${
          highlight ? "text-blue-700" : "text-gray-900"
        }`}
      >
        {value}
      </p>
      {subtext && (
        <p className="text-xs text-gray-500 mt-1">{subtext}</p>
      )}
    </div>
  )
}

export default function AnalyticsDashboard({ propertyId }: AnalyticsDashboardProps) {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const fetchAnalytics = async () => {
      try {
        const response = await fetch(`/api/properties/${propertyId}/analytics`)
        if (!isMounted) return

        if (response.ok) {
          const data = await response.json()
          setMetrics(data)
          setError(null)
        } else {
          setError("Failed to load analytics")
        }
      } catch (err) {
        if (!isMounted) return
        console.error("Error loading analytics:", err)
        setError("Error loading analytics")
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchAnalytics()

    return () => {
      isMounted = false
    }
  }, [propertyId])

  if (loading) {
    return <div className="text-center py-12 text-gray-600">Loading analytics...</div>
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    )
  }

  if (!metrics) {
    return <div className="text-center py-12 text-gray-600">No data available</div>
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Cases"
          value={metrics.totalCases}
          highlight={true}
        />
        <MetricCard
          label="Resolved"
          value={metrics.resolvedCases}
          subtext={`${((metrics.resolvedCases / metrics.totalCases) * 100).toFixed(1)}% of total`}
        />
        <MetricCard
          label="Avg Resolution Time"
          value={`${metrics.averageResolutionDays} days`}
          subtext="Average across all cases"
        />
        <MetricCard
          label="SLA Compliance"
          value={`${metrics.slaComplianceRate}%`}
          subtext="Resolved within 30 days"
          highlight={metrics.slaComplianceRate >= 90}
        />
      </div>

      {/* Risk Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Overdue Cases"
          value={metrics.overdueCases}
          highlight={metrics.overdueCases > 0}
        />
        <MetricCard
          label="Avg Messages per Case"
          value={metrics.averageMessageCount.toFixed(1)}
        />
        <MetricCard
          label="Avg Attachments per Case"
          value={metrics.averageAttachmentCount.toFixed(1)}
        />
      </div>

      {/* Cases by Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cases by Status</h3>
        <div className="space-y-3">
          {Object.entries(metrics.casesByStatus).map(([status, count]) => (
            <div key={status} className="flex items-center justify-between">
              <span className={`font-medium capitalize ${getStatusColor(status)}`}>
                {status.replace("_", " ")}
              </span>
              <div className="flex items-center gap-3">
                <ProgressBar percentage={(count / metrics.totalCases) * 100} />
                <span className="text-sm font-semibold text-gray-900 w-8 text-right">
                  {count}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cases by Type */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cases by Type</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(metrics.casesByType).map(([caseType, count]) => (
            <div
              key={caseType}
              className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200"
            >
              <p className="text-sm font-medium text-gray-600 capitalize">
                {caseType.replace("_", " ")}
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Time Series Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <span className="font-semibold">📊 Analytics Updated:</span>{" "}
          {new Date().toLocaleDateString("en-GB", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        <p className="text-xs text-blue-700 mt-2">
          Data refreshes automatically. Use the refresh button to update manually.
        </p>
      </div>
    </div>
  )
}
