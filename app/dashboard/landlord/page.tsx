import Link from "next/link"
import { redirect } from "next/navigation"

import { getUserRole, isPendingApproval } from "@/lib/auth"
import { listApplicationsForReview } from "@/lib/server/applications"
import { getPortfolioAnalytics } from "@/lib/server/analytics"
import { listMaintenanceIssuesForUser } from "@/lib/server/maintenance"
import { listPropertiesForUser } from "@/lib/server/properties"
import { getSessionUser } from "@/lib/server/session"

export const dynamic = "force-dynamic"

function formatCurrency(value: number) {
  return `£${Math.round(value).toLocaleString("en-GB")}`
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`
}

function getProgressWidthClass(value: number) {
  const clamped = Math.max(4, Math.min(100, value))

  if (clamped <= 5) return "w-[5%]"
  if (clamped <= 10) return "w-[10%]"
  if (clamped <= 15) return "w-[15%]"
  if (clamped <= 20) return "w-[20%]"
  if (clamped <= 25) return "w-[25%]"
  if (clamped <= 30) return "w-[30%]"
  if (clamped <= 35) return "w-[35%]"
  if (clamped <= 40) return "w-[40%]"
  if (clamped <= 45) return "w-[45%]"
  if (clamped <= 50) return "w-[50%]"
  if (clamped <= 55) return "w-[55%]"
  if (clamped <= 60) return "w-[60%]"
  if (clamped <= 65) return "w-[65%]"
  if (clamped <= 70) return "w-[70%]"
  if (clamped <= 75) return "w-[75%]"
  if (clamped <= 80) return "w-[80%]"
  if (clamped <= 85) return "w-[85%]"
  if (clamped <= 90) return "w-[90%]"
  if (clamped <= 95) return "w-[95%]"

  return "w-full"
}

function getRiskBand(score: number) {
  if (score >= 67) {
    return {
      label: "High",
      tone: "text-rose-700",
      bar: "bg-rose-500",
      badge: "bg-rose-50 border-rose-200 text-rose-700",
    }
  }

  if (score >= 34) {
    return {
      label: "Medium",
      tone: "text-amber-700",
      bar: "bg-amber-500",
      badge: "bg-amber-50 border-amber-200 text-amber-700",
    }
  }

  return {
    label: "Low",
    tone: "text-emerald-700",
    bar: "bg-emerald-500",
    badge: "bg-emerald-50 border-emerald-200 text-emerald-700",
  }
}

export default async function LandlordDashboardPage() {
  const now = new Date()
  const inNinetyDays = new Date(now)
  inNinetyDays.setDate(inNinetyDays.getDate() + 90)

  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  if (isPendingApproval(user)) {
    redirect("/waiting")
  }

  if (getUserRole(user) !== "landlord") {
    redirect("/dashboard")
  }

  const properties = await listPropertiesForUser(user)
  const propertyIds = properties.map((property) => property.id)
  const [maintenanceIssues, applications, analytics] = await Promise.all([
    listMaintenanceIssuesForUser(user),
    listApplicationsForReview(user),
    propertyIds.length > 0
      ? getPortfolioAnalytics(propertyIds)
      : Promise.resolve({
          totalCases: 0,
          resolvedCases: 0,
          averageResolutionDays: 0,
          casesByType: {
            damp: 0,
            flood: 0,
            maintenance_request: 0,
            complaint: 0,
            rent_dispute: 0,
            legal_notice: 0,
          },
          casesByStatus: {
            open: 0,
            investigating: 0,
            in_repair: 0,
            resolved: 0,
            archived: 0,
          },
          slaComplianceRate: 0,
          contractorPerformance: [],
          timeSeriesData: [],
          overdueCases: 0,
          averageMessageCount: 0,
          averageAttachmentCount: 0,
        }),
  ])

  const totalPortfolioValue = properties.reduce((sum, property) => {
    if (property.financials?.propertyValue && property.financials.propertyValue > 0) {
      return sum + property.financials.propertyValue
    }

    // Fallback valuation when valuation data has not yet been entered.
    return sum + property.monthlyRent * 12 * 14
  }, 0)
  const annualRent = properties.reduce((sum, property) => sum + property.monthlyRent * 12, 0)
  const currentYield = totalPortfolioValue > 0 ? (annualRent / totalPortfolioValue) * 100 : 0

  const occupiedProperties = properties.filter((property) => property.status.trim().toLowerCase() === "occupied").length
  const occupancyRate = properties.length > 0 ? (occupiedProperties / properties.length) * 100 : 0
  const vacancyRate = Math.max(0, 100 - occupancyRate)

  const outstandingMaintenance = maintenanceIssues.filter(
    (issue) => issue.status !== "completed" && issue.status !== "closed",
  )
  const urgentMaintenance = outstandingMaintenance.filter((issue) => issue.priority === "high" || issue.priority === "urgent")

  const pendingApplications = applications.filter(
    (application) => application.status !== "active_tenant" && application.status !== "withdrawn",
  )

  const complianceDueSoon = properties.reduce((count, property) => {
    const standardComplianceTypes = ["electrical", "gas", "fire_alarm", "smoke_alarm", "legionella", "epc", "damp_survey", "asbestos_survey", "pest_control", "boiler_service"] as const
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

    return count + missingItems.length + dueItems.length
  }, 0)

  const riskScore = Math.min(
    100,
    analytics.overdueCases * 12 + urgentMaintenance.length * 10 + outstandingMaintenance.length * 4 + complianceDueSoon * 8 + vacancyRate * 0.4,
  )
  const riskScoreWidthClass = getProgressWidthClass(riskScore)
  const occupancyRateWidthClass = getProgressWidthClass(occupancyRate)
  const vacancyRateWidthClass = getProgressWidthClass(vacancyRate)
  const riskBand = getRiskBand(riskScore)

  const kpis = [
    {
      label: "Total portfolio value",
      value: formatCurrency(totalPortfolioValue),
      helper: `${properties.length} properties`,
    },
    {
      label: "Current gross yield",
      value: formatPercent(currentYield),
      helper: `${formatCurrency(annualRent)} annual rent`,
    },
    {
      label: "Outstanding issues",
      value: String(outstandingMaintenance.length),
      helper: `${urgentMaintenance.length} high or urgent`,
    },
    {
      label: "Open application pipeline",
      value: String(pendingApplications.length),
      helper: `${applications.length} total applications`,
      href: "/dashboard/applications",
    },
  ]

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-linear-to-br from-slate-900 via-slate-800 to-slate-700 p-4 text-white shadow-sm">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cyan-400/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-44 w-44 rounded-full bg-sky-300/10 blur-2xl" />

        <div className="relative z-10">
          <h1 className="text-2xl font-bold">Portfolio command centre</h1>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <article key={kpi.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {kpi.href ? (
              <Link href={kpi.href} className="block rounded-xl transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{kpi.label}</p>
                <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{kpi.value}</p>
                <p className="mt-2 text-sm text-slate-600">{kpi.helper}</p>
              </Link>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{kpi.label}</p>
                <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{kpi.value}</p>
                <p className="mt-2 text-sm text-slate-600">{kpi.helper}</p>
              </>
            )}
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Risk exposure</h2>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${riskBand.badge}`}>{riskBand.label} risk</span>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Current risk score</span>
              <span className={`font-semibold ${riskBand.tone}`}>{riskScore.toFixed(0)}/100</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-100">
              <div className={`h-2 rounded-full ${riskBand.bar} ${riskScoreWidthClass}`} />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Overdue case files</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{analytics.overdueCases}</div>
            </div>
            <Link href="/dashboard/compliance" className="rounded-xl border border-slate-200 bg-slate-50 p-3 transition-colors hover:bg-slate-100">
              <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Compliance issues</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{complianceDueSoon}</div>
              <div className="mt-1 text-xs font-medium text-sky-700">View worklist</div>
            </Link>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Urgent maintenance</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{urgentMaintenance.length}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs uppercase tracking-[0.12em] text-slate-500">SLA compliance</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{formatPercent(analytics.slaComplianceRate)}</div>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Occupancy and yield</h2>

          <div className="mt-4 space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Occupancy</span>
                <span className="font-semibold text-slate-900">{formatPercent(occupancyRate)}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div className={`h-2 rounded-full bg-emerald-500 ${occupancyRateWidthClass}`} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Vacancy</span>
                <span className="font-semibold text-slate-900">{formatPercent(vacancyRate)}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div className={`h-2 rounded-full bg-amber-500 ${vacancyRateWidthClass}`} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Average rent per property</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                {properties.length > 0 ? formatCurrency(annualRent / 12 / properties.length) : formatCurrency(0)}
                <span className="ml-1 text-sm font-medium text-slate-500">pcm</span>
              </div>
            </div>
          </div>
        </article>
      </section>
    </div>
  )
}