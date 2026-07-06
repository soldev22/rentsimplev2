import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/server/session"
import { listPropertiesForUser } from "@/lib/server/properties"
import { getCasesByProperty } from "@/lib/server/cases"
import CaseListWrapper from "@/components/cases/CaseListWrapper"
import type { PropertyCase } from "@/lib/auth"

export const metadata = {
  title: "Property Cases | RentSimple",
}

function getStatusColor(status: string): string {
  switch (status) {
    case "open":
      return "bg-blue-50 text-blue-700 border-blue-200"
    case "investigating":
      return "bg-purple-50 text-purple-700 border-purple-200"
    case "in_repair":
      return "bg-yellow-50 text-yellow-700 border-yellow-200"
    case "resolved":
      return "bg-green-50 text-green-700 border-green-200"
    default:
      return "bg-gray-50 text-gray-700 border-gray-200"
  }
}

function getStageStatusColor(status: string): string {
  if (status === "completed") return "text-green-600"
  if (status === "overdue") return "text-red-600 font-semibold"
  if (status === "in_progress") return "text-blue-600"
  return "text-gray-600"
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function calculateOverdueDays(dueAt: string): number {
  const dueDate = new Date(dueAt)
  const now = new Date()
  const diffMs = now.getTime() - dueDate.getTime()
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
}

export default async function CasesPage() {
  const user = await getSessionUser()
  if (!user) {
    redirect("/login")
  }

  const properties = await listPropertiesForUser(user)
  const allCases: (PropertyCase & { propertyAddress: string })[] = []

  for (const property of properties) {
    const cases = await getCasesByProperty(property.id)
    cases.forEach((c) => {
      allCases.push({
        ...c,
        propertyAddress: property.address,
      })
    })
  }

  // Sort by created date desc
  allCases.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <CaseListWrapper
      properties={properties.map((p) => ({ id: p.id, address: p.address }))}
      initialCases={allCases}
    >
      {/* Cases List */}
      {allCases.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-600">No cases found. Create a new case to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Case</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Property</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Current Stage</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Created</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {allCases.map((case_) => {
                const currentStage = case_.stages.find((s) => !s.completedAt)
                const isOverdue = currentStage?.status === "overdue"
                const overdueDays = currentStage && isOverdue ? calculateOverdueDays(currentStage.dueAt) : 0

                return (
                  <tr key={case_.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-gray-900">{case_.title}</p>
                        <p className="text-sm text-gray-600">{case_.id.slice(0, 8)}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{case_.propertyAddress}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {case_.caseType.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(case_.status)}`}>
                        {case_.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {currentStage ? (
                        <div>
                          <p className={`text-sm font-medium ${getStageStatusColor(currentStage.status)}`}>
                            {isOverdue ? "🔴 " : currentStage.status === "completed" ? "✅ " : ""}
                            {currentStage.requirement}
                          </p>
                          {isOverdue && (
                            <p className="text-xs text-red-600 mt-1">{overdueDays} days overdue</p>
                          )}
                          {!currentStage.completedAt && currentStage.status !== "overdue" && (
                            <p className="text-xs text-gray-600 mt-1">Due: {formatDate(currentStage.dueAt)}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-green-600 font-semibold">✅ All complete</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(case_.createdAt)}</td>
                    <td className="px-6 py-4">
                      <a
                        href={`/dashboard/cases/${case_.id}?propertyId=${case_.propertyId}`}
                        className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                      >
                        View
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Cases", value: allCases.length, color: "blue" },
          {
            label: "Overdue",
            value: allCases.filter((c) => c.stages.some((s) => !s.completedAt && s.status === "overdue")).length,
            color: "red",
          },
          {
            label: "In Progress",
            value: allCases.filter((c) => c.status === "investigating" || c.status === "in_repair").length,
            color: "yellow",
          },
          { label: "Resolved", value: allCases.filter((c) => c.status === "resolved").length, color: "green" },
        ].map((stat) => (
          <div key={stat.label} className={`bg-${stat.color}-50 border border-${stat.color}-200 rounded-lg p-4`}>
            <p className={`text-${stat.color}-700 text-sm font-medium`}>{stat.label}</p>
            <p className={`text-${stat.color}-900 text-2xl font-bold mt-2`}>{stat.value}</p>
          </div>
        ))}
      </div>
    </CaseListWrapper>
  )
}
