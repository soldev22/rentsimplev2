"use client"

import type { PropertyRecord, PropertyCase } from "@/lib/auth"

type PropertyHealthDashboardProps = {
  property: PropertyRecord
  cases: PropertyCase[]
  unreadMessageCount: number
  averageResponseTimeHours: number
  complianceStatus: "green" | "amber" | "red"
  onClick?: () => void
}

function getRiskRating(cases: PropertyCase[], complianceStatus: string, unreadCount: number): "LOW" | "MEDIUM" | "HIGH" {
  let riskScore = 0

  // Check for overdue cases
  cases.forEach((case_) => {
    case_.stages.forEach((stage) => {
      if (!stage.completedAt && stage.status === "overdue") {
        riskScore += 10
      }
    })
  })

  // Check compliance status
  if (complianceStatus === "red") riskScore += 20
  if (complianceStatus === "amber") riskScore += 10

  // Check for unread messages
  if (unreadCount > 5) riskScore += 10
  if (unreadCount > 10) riskScore += 10

  if (riskScore >= 30) return "HIGH"
  if (riskScore >= 10) return "MEDIUM"
  return "LOW"
}

function getRiskColor(rating: "LOW" | "MEDIUM" | "HIGH"): string {
  switch (rating) {
    case "LOW":
      return "bg-green-50 border-green-200 text-green-900"
    case "MEDIUM":
      return "bg-amber-50 border-amber-200 text-amber-900"
    case "HIGH":
      return "bg-red-50 border-red-200 text-red-900"
  }
}

function getComplianceBadgeColor(status: "green" | "amber" | "red"): string {
  switch (status) {
    case "green":
      return "bg-green-100 text-green-800"
    case "amber":
      return "bg-amber-100 text-amber-800"
    case "red":
      return "bg-red-100 text-red-800"
  }
}

export default function PropertyHealthDashboard({
  property,
  cases,
  unreadMessageCount,
  averageResponseTimeHours,
  complianceStatus,
  onClick,
}: PropertyHealthDashboardProps) {
  const riskRating = getRiskRating(cases, complianceStatus, unreadMessageCount)
  const activeCases = cases.filter((c) => !c.archived && c.status !== "resolved").length
  const overdueCases = cases.filter(
    (c) => !c.archived && c.stages.some((s) => !s.completedAt && s.status === "overdue"),
  ).length

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{property.address}</h3>
          <p className="text-sm text-gray-600 mt-1">
            {property.bedrooms} bed • {property.bathrooms} bath • £{property.monthlyRent}/month
          </p>
        </div>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getComplianceBadgeColor(complianceStatus)}`}>
          Compliance: {complianceStatus.toUpperCase()}
        </span>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 pb-6 border-b border-gray-200">
        {/* Unread Messages */}
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-600">Unread Messages</p>
          <div className="mt-2 flex items-end gap-1">
            <span className="text-2xl font-bold text-blue-600">{unreadMessageCount}</span>
            {unreadMessageCount > 0 && <span className="text-xs text-blue-600 mb-1">new</span>}
          </div>
        </div>

        {/* Active Cases */}
        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-600">Active Cases</p>
          <div className="mt-2 flex items-end gap-1">
            <span className="text-2xl font-bold text-purple-600">{activeCases}</span>
            {overdueCases > 0 && <span className="text-xs text-red-600 mb-1 font-semibold">{overdueCases} overdue</span>}
          </div>
        </div>

        {/* Response Time */}
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-600">Avg Response Time</p>
          <p className="text-2xl font-bold text-green-600 mt-2">
            {averageResponseTimeHours}h
          </p>
        </div>

        {/* Risk Rating */}
        <div className={`rounded-lg p-4 border ${getRiskColor(riskRating)}`}>
          <p className="text-xs font-medium text-opacity-70">Risk Rating</p>
          <p className="text-2xl font-bold mt-2">
            {riskRating === "LOW" && "🟢"}
            {riskRating === "MEDIUM" && "🟡"}
            {riskRating === "HIGH" && "🔴"}
            {" "}
            {riskRating}
          </p>
        </div>
      </div>

      {/* Case Summary */}
      {activeCases > 0 && (
        <div className="space-y-2 text-sm">
          <p className="font-medium text-gray-900">Active Cases</p>
          {cases
            .filter((c) => !c.archived && c.status !== "resolved")
            .slice(0, 3)
            .map((case_) => {
              const overdue = case_.stages.some((s) => !s.completedAt && s.status === "overdue")
              return (
                <div key={case_.id} className="flex items-center justify-between">
                  <span className={`text-sm ${overdue ? "text-red-600 font-semibold" : "text-gray-600"}`}>
                    {overdue ? "⚠️ " : "• "} {case_.title}
                  </span>
                  <span className="text-xs text-gray-500">{case_.messageCount} messages</span>
                </div>
              )
            })}
          {activeCases > 3 && <p className="text-gray-500 text-xs pt-2">+ {activeCases - 3} more</p>}
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 pt-6 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
        <span>Updated: {new Date().toLocaleTimeString()}</span>
        <span className="text-blue-600 font-medium">View Details →</span>
      </div>
    </div>
  )
}
