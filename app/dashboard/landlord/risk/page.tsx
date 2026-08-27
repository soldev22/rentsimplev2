import Link from "next/link"
import { redirect } from "next/navigation"

import { getUserRole, isPendingApproval, type ComplianceType } from "@/lib/auth"
import { getPortfolioAnalytics } from "@/lib/server/analytics"
import { listMaintenanceIssuesForUser } from "@/lib/server/maintenance"
import { listPropertiesForUser } from "@/lib/server/properties"
import { getSessionUser } from "@/lib/server/session"

export const dynamic = "force-dynamic"

const standardComplianceTypes: ComplianceType[] = [
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
]

function getRiskBand(score: number) {
  if (score >= 67) return { label: "High", className: "border-rose-200 bg-rose-50 text-rose-700" }
  if (score >= 34) return { label: "Medium", className: "border-amber-200 bg-amber-50 text-amber-700" }
  return { label: "Low", className: "border-emerald-200 bg-emerald-50 text-emerald-700" }
}

export default async function LandlordRiskPage() {
  const user = await getSessionUser()

  if (!user) redirect("/login")
  if (isPendingApproval(user)) redirect("/waiting")
  if (getUserRole(user) !== "landlord") redirect("/dashboard")

  const now = new Date()
  const inNinetyDays = new Date(now)
  inNinetyDays.setDate(inNinetyDays.getDate() + 90)

  const properties = await listPropertiesForUser(user)
  const propertyIds = properties.map((property) => property.id)
  const [maintenanceIssues, analytics, propertyAnalytics] = await Promise.all([
    listMaintenanceIssuesForUser(user),
    propertyIds.length > 0
      ? getPortfolioAnalytics(propertyIds)
      : Promise.resolve({ overdueCases: 0 }),
    Promise.all(properties.map((property) => getPortfolioAnalytics([property.id]))),
  ])

  const outstandingMaintenance = maintenanceIssues.filter(
    (issue) => issue.status !== "completed" && issue.status !== "closed",
  )
  const urgentMaintenance = outstandingMaintenance.filter((issue) => issue.priority === "high" || issue.priority === "urgent")
  const occupiedProperties = properties.filter((property) => property.status.trim().toLowerCase() === "occupied").length
  const vacancyRate = properties.length > 0 ? Math.max(0, 100 - (occupiedProperties / properties.length) * 100) : 0

  const complianceIssuesByProperty = new Map<string, number>()
  const complianceIssues = properties.reduce((count, property) => {
    const missingItems = standardComplianceTypes.filter((type) => {
      const record = property.compliance?.find((item) => item.type === type)
      return !record || (!record.notApplicable && !record.expirationDate)
    })
    const dueItems = (property.compliance ?? []).filter((item) => {
      const expiry = Date.parse(item.expirationDate)
      const isOrphanedPatItem = item.type === "pat_testing" && !property.includedItems?.some(
        (includedItem) => includedItem.id === item.patItemId && includedItem.isElectrical,
      )
      return !item.notApplicable && !isOrphanedPatItem && Number.isFinite(expiry) && expiry <= inNinetyDays.getTime()
    })

    const propertyComplianceIssues = missingItems.length + dueItems.length
    complianceIssuesByProperty.set(property.id, propertyComplianceIssues)
    return count + propertyComplianceIssues
  }, 0)

  const contributors = [
    {
      label: "Overdue case files",
      detail: "12 points for every case overdue by more than 30 days.",
      count: analytics.overdueCases,
      points: analytics.overdueCases * 12,
      href: "/dashboard/cases",
      action: "Open cases",
    },
    {
      label: "Open maintenance issues",
      detail: "4 points for every maintenance issue that is not completed or closed.",
      count: outstandingMaintenance.length,
      points: outstandingMaintenance.length * 4,
      href: "/dashboard/maintenance",
      action: "Open maintenance",
    },
    {
      label: "High-priority maintenance",
      detail: "A further 10 points for every high or urgent open maintenance issue.",
      count: urgentMaintenance.length,
      points: urgentMaintenance.length * 10,
      href: "/dashboard/maintenance",
      action: "Open maintenance",
    },
    {
      label: "Compliance requirements",
      detail: "8 points for every missing requirement or certificate due within 90 days.",
      count: complianceIssues,
      points: complianceIssues * 8,
      href: "/dashboard/compliance",
      action: "Open compliance worklist",
    },
    {
      label: "Vacant properties",
      detail: "0.4 points for each percentage point of the portfolio that is vacant.",
      count: vacancyRate,
      points: vacancyRate * 0.4,
      href: "/dashboard/properties",
      action: "Open properties",
    },
  ]
  const unboundedScore = contributors.reduce((total, contributor) => total + contributor.points, 0)
  const score = Math.min(100, unboundedScore)
  const riskBand = getRiskBand(score)
  const vacancyPointsPerProperty = properties.length > 0 ? 40 / properties.length : 0

  const propertyRisks = properties.map((property, index) => {
    const propertyMaintenance = outstandingMaintenance.filter((issue) => issue.propertyId === property.id)
    const propertyUrgentMaintenance = propertyMaintenance.filter((issue) => issue.priority === "high" || issue.priority === "urgent")
    const propertyComplianceIssues = complianceIssuesByProperty.get(property.id) ?? 0
    const isVacant = property.status.trim().toLowerCase() !== "occupied"
    const propertyContributors = [
      {
        label: "Overdue case files",
        count: propertyAnalytics[index].overdueCases,
        points: propertyAnalytics[index].overdueCases * 12,
        href: "/dashboard/cases",
        action: "Open cases",
      },
      {
        label: "Open maintenance issues",
        count: propertyMaintenance.length,
        points: propertyMaintenance.length * 4,
        href: "/dashboard/maintenance",
        action: "Open maintenance",
      },
      {
        label: "High-priority maintenance",
        count: propertyUrgentMaintenance.length,
        points: propertyUrgentMaintenance.length * 10,
        href: "/dashboard/maintenance",
        action: "Open maintenance",
      },
      {
        label: "Compliance requirements",
        count: propertyComplianceIssues,
        points: propertyComplianceIssues * 8,
        href: `/dashboard/properties/${property.id}/compliance`,
        action: "Open compliance",
      },
      {
        label: "Vacancy",
        count: isVacant ? 1 : 0,
        points: isVacant ? vacancyPointsPerProperty : 0,
        href: `/dashboard/properties/${property.id}`,
        action: "Open property",
      },
    ].filter((contributor) => contributor.points > 0)

    return {
      property,
      contributors: propertyContributors,
      points: propertyContributors.reduce((total, contributor) => total + contributor.points, 0),
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Portfolio tasks</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Risk exposure breakdown</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Review every negative factor in your portfolio risk score and go directly to the relevant property task.
          </p>
        </div>
        <Link href="/dashboard/landlord" className="text-sm font-medium text-sky-700 hover:underline">Back to dashboard</Link>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-600">Current portfolio risk score</p>
            <p className="mt-2 text-4xl font-bold text-slate-900">{score.toFixed(0)}<span className="text-xl text-slate-500">/100</span></p>
          </div>
          <span className={`rounded-full border px-4 py-2 text-sm font-semibold ${riskBand.className}`}>{riskBand.label} risk</span>
        </div>
        {unboundedScore > 100 ? <p className="mt-4 text-sm text-slate-600">The calculated total is capped at 100.</p> : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Property risk tasks</h2>
        </div>
        <div className="divide-y divide-slate-200">
          {propertyRisks.map(({ property, contributors: propertyContributors, points }) => (
            <details key={property.id} className="group">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4 px-6 py-5 hover:bg-slate-50">
                <div>
                  <h3 className="font-semibold text-slate-900">{property.address}</h3>
                  <p className="mt-1 text-sm text-slate-600">{property.status}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900">{points.toFixed(1)}</p>
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">risk points</p>
                  </div>
                  <span aria-hidden="true" className="text-xl text-slate-500 transition-transform group-open:rotate-180">⌄</span>
                </div>
              </summary>
              <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
                {propertyContributors.length === 0 ? (
                  <p className="text-sm text-emerald-800">No active negative risk contributors for this property.</p>
                ) : (
                  <div className="space-y-3">
                    {propertyContributors.map((contributor) => (
                      <div key={contributor.label} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium text-slate-900">{contributor.label}</p>
                          <p className="mt-1 text-sm text-slate-600">{contributor.count} item{contributor.count === 1 ? "" : "s"} contributing {contributor.points.toFixed(1)} points</p>
                        </div>
                        <Link href={contributor.href} className="w-fit rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                          {contributor.action}
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}