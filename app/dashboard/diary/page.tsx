import Link from "next/link"
import { redirect } from "next/navigation"
import DiaryCalendar from "@/components/dashboard/DiaryCalendar"
import { appointmentFields, DIARY_VIEWS, isDiaryDate } from "@/lib/diary"
import { getSessionUser } from "@/lib/server/session"
import { canManageMeetingRequests, listDiaryEntries } from "@/lib/server/meeting-requests"

export const dynamic = "force-dynamic"

export default async function DiaryPage({ searchParams }: { searchParams: Promise<{ date?: string; view?: string }> }) {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!canManageMeetingRequests(user)) redirect("/dashboard")
  const params = await searchParams
  const today = appointmentFields(new Date().toISOString()).date
  const date = isDiaryDate(params.date) ? params.date : today
  const view = DIARY_VIEWS.find((value) => value === params.view) ?? "month"
  const { entries, unscheduledCount } = await listDiaryEntries(user, date, view)
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-slate-900">Diary</h1>
        <Link href="/dashboard/meeting-requests" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Manage meeting requests</Link>
      </div>
      <p className="text-sm text-slate-600">Shared Global admin diary. Confirmed meetings appear automatically; completed meetings remain as history and cancelled meetings are removed. All times are UK time (Europe/London). Outlook sync and automatic invitations are not enabled.</p>
      {(params.date !== undefined && !isDiaryDate(params.date)) || (params.view !== undefined && !DIARY_VIEWS.some((value) => value === params.view)) ? <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">The diary date or view was invalid. Showing the available default instead.</p> : null}
      {unscheduledCount > 0 ? <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{unscheduledCount} confirmed meeting(s) have no appointment time and cannot appear in the diary. <Link href="/dashboard/meeting-requests" className="underline">Add their date and times.</Link></p> : null}
      <DiaryCalendar date={date} today={today} view={view} entries={entries} />
    </div>
  )
}
