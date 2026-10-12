import { redirect } from "next/navigation"
import Link from "next/link"

import { getUserRole, isPendingApproval, isPendingVerification } from "@/lib/auth"
import { getPlatformDashboardSummary } from "@/lib/server/platform-dashboard"
import { getSessionUser } from "@/lib/server/session"

export const dynamic = "force-dynamic"

function CountList({ title, counts }: { title: string; counts: Array<{ label: string; count: number }> }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</h3>
      {counts.length > 0 ? (
        <ul className="mt-3 divide-y divide-slate-100">
          {counts.map(({ label, count }) => (
            <li key={label} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="wrap-break-word text-slate-600">{label.replaceAll("_", " ")}</span>
              <span className="font-semibold tabular-nums text-slate-900">{count.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No records</p>
      )}
    </div>
  )
}

function EntityCard({
  title,
  total,
  statuses,
  href,
}: {
  title: string
  total: number
  statuses: Array<{ label: string; count: number }>
  href?: string
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-sm font-semibold text-slate-600">{title}</h2>
        <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{total.toLocaleString()}</p>
        <p className="text-xs text-slate-500">total records</p>
      </div>
      <div className="pt-4">
        <CountList title="Current status" counts={statuses} />
      </div>
      {href ? <Link href={href} className="mt-4 inline-block rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
        Manage meeting requests
      </Link> : null}
    </article>
  )
}

export default async function PlatformDashboardPage() {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  if (isPendingApproval(user) || isPendingVerification(user)) {
    redirect("/waiting")
  }

  if (!["admin", "user"].includes(getUserRole(user))) {
    redirect("/dashboard")
  }

  const summary = await getPlatformDashboardSummary()

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">{user.role === "user" ? "User" : "Global admin"}</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Platform overview</h1>
        <p className="mt-2 text-sm text-slate-600">
          Current totals and status breakdowns across the platform&apos;s operational records.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-sm font-semibold text-slate-600">Accounts</h2>
            <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{summary.accounts.total.toLocaleString()}</p>
            <p className="text-xs text-slate-500">total accounts</p>
          </div>
          <div className="grid gap-5 pt-4 sm:grid-cols-2">
            <CountList title="By role" counts={summary.accounts.roles} />
            <CountList title="Approval status" counts={summary.accounts.approvalStatuses} />
          </div>
        </article>
        <EntityCard title="Properties" {...summary.properties} />
        <EntityCard title="Applications" {...summary.applications} />
        <EntityCard title="Maintenance issues" {...summary.maintenanceIssues} />
        <EntityCard title="Cases" {...summary.cases} />
        <EntityCard title="Meeting requests" {...summary.meetingRequests} href="/dashboard/meeting-requests" />
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-600">CRM</h2>
          <p className="mt-2 text-sm text-slate-600">
            Track Suspect, Prospect and Allocated contacts matched to meeting requests and registered accounts by email.
          </p>
          <Link href="/dashboard/crm" className="mt-4 inline-block rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
            Open CRM
          </Link>
        </article>
      </section>

      <p className="text-right text-xs text-slate-500">
        Counts are refreshed each time this page is loaded. {new Date().toLocaleString()}
      </p>
    </div>
  )
}
