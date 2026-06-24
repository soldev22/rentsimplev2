import Link from "next/link"
import { redirect } from "next/navigation"

import { getUserRole, isPendingApproval } from "@/lib/auth"
import { listAuditEventsPage, listAuditFilterSuggestions } from "@/lib/server/audit"
import { getSessionUser } from "@/lib/server/session"

export const dynamic = "force-dynamic"

type AuditPageProps = {
  searchParams: Promise<{
    page?: string
    entityType?: string
    action?: string
    performedBy?: string
  }>
}

function formatAuditAction(action: string) {
  return action.replace(/_/g, " ")
}

function formatAuditValue(value: unknown) {
  if (value === undefined) {
    return "Not recorded"
  }

  if (value === null) {
    return "Cleared"
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  return JSON.stringify(value)
}

function normalizeFilter(value: string | undefined) {
  if (typeof value !== "string") {
    return ""
  }

  return value.trim()
}

function buildAuditPageHref(input: {
  page: number
  entityType?: string
  action?: string
  performedBy?: string
}) {
  const params = new URLSearchParams()

  if (input.page > 1) {
    params.set("page", String(input.page))
  }

  if (input.entityType && input.entityType.trim()) {
    params.set("entityType", input.entityType.trim())
  }

  if (input.action && input.action.trim()) {
    params.set("action", input.action.trim())
  }

  if (input.performedBy && input.performedBy.trim()) {
    params.set("performedBy", input.performedBy.trim())
  }

  const query = params.toString()
  return query ? `/dashboard/audit?${query}` : "/dashboard/audit"
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  if (isPendingApproval(user)) {
    redirect("/waiting")
  }

  if (getUserRole(user) !== "admin") {
    redirect("/dashboard")
  }

  const {
    page: pageParam,
    entityType: entityTypeParam,
    action: actionParam,
    performedBy: performedByParam,
  } = await searchParams
  const page = Number.isFinite(Number(pageParam)) ? Math.max(1, Math.floor(Number(pageParam))) : 1
  const filters = {
    entityType: normalizeFilter(entityTypeParam),
    action: normalizeFilter(actionParam),
    performedBy: normalizeFilter(performedByParam),
  }

  const pagedAudit = await listAuditEventsPage({
    page,
    pageSize: 50,
    filters,
  })
  const filterSuggestions = await listAuditFilterSuggestions()

  const auditEvents = pagedAudit.events
  const applicationEvents = auditEvents.filter((event) => event.entityType === "application").length
  const actors = new Set(auditEvents.map((event) => event.performedBy)).size

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Audit</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Platform audit log</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Recent immutable workflow events across the platform, with actor identity, timestamp, and before/after values for dispute handling.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Loaded events</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{auditEvents.length}</div>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Application events</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{applicationEvents}</div>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Actors</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{actors}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 mb-3">Quick presets</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={buildAuditPageHref({
                page: 1,
                entityType: "property",
              })}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
            >
              Publishing events
            </Link>
            <Link
              href={buildAuditPageHref({
                page: 1,
                action: "SUGGESTED",
              })}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
            >
              AI suggestions
            </Link>
            <Link
              href={buildAuditPageHref({
                page: 1,
                action: "APPROVED_BY_LANDLORD",
              })}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
            >
              Landlord approvals
            </Link>
            <Link
              href={buildAuditPageHref({
                page: 1,
                action: "EXECUTED_BY_SYSTEM",
              })}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
            >
              System execution
            </Link>
          </div>
        </div>
        <form method="get" className="grid gap-4 md:grid-cols-4">
          <label className="block text-sm font-medium text-slate-700">
            Entity type
            <select
              name="entityType"
              defaultValue={filters.entityType}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">Any entity</option>
              {filterSuggestions.entityTypes.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Action
            <select
              name="action"
              defaultValue={filters.action}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">Any action</option>
              {filterSuggestions.actions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Performed by
            <input
              name="performedBy"
              list="audit-actor-suggestions"
              defaultValue={filters.performedBy}
              placeholder="agent@example.com"
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
            />
            <datalist id="audit-actor-suggestions">
              {filterSuggestions.performedBy.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              Apply filters
            </button>
            <Link
              href="/dashboard/audit"
              className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-center text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
            >
              Clear
            </Link>
          </div>
        </form>
      </section>

      {auditEvents.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600 shadow-sm">
          No audit events have been recorded yet.
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
            <span>
              Showing {(pagedAudit.page - 1) * pagedAudit.pageSize + 1}-{Math.min(pagedAudit.page * pagedAudit.pageSize, pagedAudit.totalCount)} of {pagedAudit.totalCount} audit events from Cosmos `audit-events`.
            </span>
            <span>
              Page {pagedAudit.page} of {pagedAudit.totalPages}
            </span>
          </div>
          <div className="space-y-3">
            {auditEvents.map((event) => (
              <article key={event.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-sm font-semibold capitalize text-slate-900">{formatAuditAction(event.action)}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
                      {event.entityType} · {event.entityId}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{event.fieldPath ?? "entity"}</div>
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(event.timestamp).toLocaleString()} · {event.performedBy}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 lg:grid-cols-2">
                  <div className="rounded-md bg-white px-3 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Before</div>
                    <div className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-700">{formatAuditValue(event.oldValue)}</div>
                  </div>
                  <div className="rounded-md bg-emerald-50 px-3 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">After</div>
                    <div className="mt-1 whitespace-pre-wrap break-words text-xs text-emerald-900">{formatAuditValue(event.newValue)}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between gap-3">
            {pagedAudit.hasPreviousPage ? (
              <Link
                href={buildAuditPageHref({
                  page: pagedAudit.page - 1,
                  entityType: filters.entityType,
                  action: filters.action,
                  performedBy: filters.performedBy,
                })}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
              >
                Previous
              </Link>
            ) : (
              <span className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-400">Previous</span>
            )}

            {pagedAudit.hasNextPage ? (
              <Link
                href={buildAuditPageHref({
                  page: pagedAudit.page + 1,
                  entityType: filters.entityType,
                  action: filters.action,
                  performedBy: filters.performedBy,
                })}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
              >
                Next
              </Link>
            ) : (
              <span className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-400">Next</span>
            )}
          </div>
        </section>
      )}
    </div>
  )
}