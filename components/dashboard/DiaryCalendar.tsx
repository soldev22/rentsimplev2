import Link from "next/link"
import { adjacentDiaryDate, appointmentFields, DIARY_VIEWS, diaryRange, isDiaryDate, shiftDiaryDate, type DiaryEntry, type DiaryView } from "@/lib/diary"

const dateLabel = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))
const href = (date: string, view: DiaryView) => `/dashboard/diary?date=${date}&view=${view}`

export default function DiaryCalendar({ date, today, view, entries }: { date: string; today: string; view: DiaryView; entries: DiaryEntry[] }) {
  const range = diaryRange(date, view)
  let first = range.first
  let last = range.last
  if (view === "month") {
    first = shiftDiaryDate(first, -((new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7))
    const endDay = (new Date(`${last}T12:00:00Z`).getUTCDay() + 6) % 7
    if (endDay) last = shiftDiaryDate(last, 7 - endDay)
  }
  const days: string[] = []
  for (let day = first; day < last; day = shiftDiaryDate(day, 1)) days.push(day)
  const previous = adjacentDiaryDate(date, view, -1)
  const next = adjacentDiaryDate(date, view, 1)
  const title = view === "month" ? dateLabel(date, { month: "long", year: "numeric" })
    : view === "day" ? dateLabel(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : `${dateLabel(range.first, { day: "numeric", month: "short" })} - ${dateLabel(shiftDiaryDate(range.last, -1), { day: "numeric", month: "short", year: "numeric" })}`

  return (
    <section aria-label="Shared meeting diary" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Diary dates" className="flex items-center gap-4 text-sm">
          {isDiaryDate(previous) ? <Link href={href(previous, view)} className="rounded-lg border border-slate-300 bg-white px-3 py-2">Previous</Link> : null}
          <Link href={href(today, view)} className="rounded-lg border border-slate-300 bg-white px-3 py-2">Today</Link>
          {isDiaryDate(next) ? <Link href={href(next, view)} className="rounded-lg border border-slate-300 bg-white px-3 py-2">Next</Link> : null}
        </nav>
        <nav aria-label="Diary view" className="flex gap-2">
          {DIARY_VIEWS.map((mode) => <Link key={mode} href={href(date, mode)} aria-current={mode === view ? "page" : undefined} className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize ${mode === view ? "bg-blue-700 text-white" : "border border-slate-300 bg-white text-slate-700"}`}>{mode}</Link>)}
        </nav>
      </div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <form action="/dashboard/diary" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="view" value={view} />
        <label htmlFor="diary-date" className="text-sm font-semibold">Go to date
          <input key={date} id="diary-date" type="date" name="date" defaultValue={date} min="2000-01-01" max="2099-12-31" required className="ml-3 rounded-lg border border-slate-300 bg-white p-2" />
        </label>
        <button type="submit" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm">Go</button>
      </form>
      {entries.length === 0 ? <p className="text-sm text-slate-600">No scheduled meetings in this {view}.</p> : null}
      <div className={view === "day" ? "" : "overflow-x-auto"}>
        <div className={view === "day" ? "space-y-3" : "grid min-w-[840px] grid-cols-7 gap-2"}>
          {days.map((day) => {
            const outside = day < range.first || day >= range.last
            const meetings = entries.filter((entry) => {
              const startDay = appointmentFields(entry.appointment.startAt).date
              const endDay = appointmentFields(entry.appointment.endAt).date
              return startDay <= day && endDay >= day
            })
            return <section key={day} aria-label={dateLabel(day, { weekday: "long", day: "numeric", month: "long" })} className={`min-h-32 rounded-xl border p-3 ${day === today ? "border-blue-500 bg-blue-50" : outside ? "border-slate-200 bg-slate-100" : "border-slate-200 bg-white"}`}>
              <h3 className="mb-3 text-sm font-semibold">
                {isDiaryDate(day) ? <Link href={href(day, "day")} aria-current={day === today ? "date" : undefined}>{dateLabel(day, { weekday: "short", day: "numeric", month: "short" })}{day === today ? " (Today)" : ""}</Link> : dateLabel(day, { day: "numeric" })}
              </h3>
              <ul className="space-y-2">
                {meetings.map((entry) => <li key={entry.id}>
                  <Link href={`/dashboard/meeting-requests?request=${encodeURIComponent(entry.id)}#meeting-${entry.id}`} className={`block break-words rounded-lg border p-3 text-sm ${entry.status === "done" ? "border-slate-300 bg-slate-100" : "border-blue-200 bg-blue-50"}`}>
                    <p className="font-semibold">{appointmentFields(entry.appointment.startAt).time} - {appointmentFields(entry.appointment.endAt).time}</p>
                    <p className="mt-1 font-semibold">{entry.firstName} {entry.lastName}</p>
                    <p className="mt-1 capitalize">{entry.meetingType} &middot; {entry.status === "done" ? "Completed" : "Confirmed"}</p>
                    {entry.appointment.location ? <p className="mt-1">{entry.appointment.location}</p> : null}
                  </Link>
                </li>)}
              </ul>
              {view !== "month" && !meetings.length ? <p className="text-sm text-slate-500">No meetings</p> : null}
            </section>
          })}
        </div>
      </div>
    </section>
  )
}
