export const DIARY_TIME_ZONE = "Europe/London"
export const DIARY_VIEWS = ["day", "week", "month"] as const
export type DiaryView = (typeof DIARY_VIEWS)[number]
export type MeetingAppointment = {
  startAt: string
  endAt: string
  timeZone: typeof DIARY_TIME_ZONE
  location: string
}
export type DiaryEntry = {
  id: string
  firstName: string
  lastName: string
  meetingType: string
  status: "confirmed" | "done"
  appointment: MeetingAppointment
}

const londonParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: DIARY_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
})

export function appointmentFields(instant: string) {
  const parts = londonParts.formatToParts(new Date(instant))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)!.value
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` }
}

export function isDiaryDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function shiftDiaryDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function londonInstant(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null
  const naive = Date.parse(`${date}T${time}:00Z`)
  if (!Number.isFinite(naive)) return null
  // Round-trip both UK offsets to reject nonexistent and ambiguous DST times.
  const matches = [0, 60].map((offset) => new Date(naive - offset * 60000).toISOString()).filter((instant) => {
    const local = appointmentFields(instant)
    return local.date === date && local.time === time
  })
  return matches.length === 1 ? matches[0] : null
}

export function validateAppointment(value: unknown): MeetingAppointment | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null
  const data = value as Record<string, unknown>
  if (!isDiaryDate(data.date) || typeof data.startTime !== "string" || typeof data.endTime !== "string" ||
      (data.location !== undefined && typeof data.location !== "string")) return null
  const startAt = londonInstant(data.date, data.startTime)
  const endAt = londonInstant(data.date, data.endTime)
  const location = typeof data.location === "string" ? data.location.trim() : ""
  if (!startAt || !endAt || endAt <= startAt || location.length > 500) return null
  return { startAt, endAt, timeZone: DIARY_TIME_ZONE, location }
}

export function diaryRange(date: string, view: DiaryView) {
  let first = date
  let last = shiftDiaryDate(date, 1)
  if (view === "week") {
    first = shiftDiaryDate(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7))
    last = shiftDiaryDate(first, 7)
  } else if (view === "month") {
    first = `${date.slice(0, 7)}-01`
    const next = new Date(`${first}T12:00:00Z`)
    next.setUTCMonth(next.getUTCMonth() + 1)
    last = next.toISOString().slice(0, 10)
  }
  return { first, last, startAt: londonInstant(first, "00:00")!, endAt: londonInstant(last, "00:00")! }
}

export function adjacentDiaryDate(date: string, view: DiaryView, direction: -1 | 1) {
  if (view !== "month") return shiftDiaryDate(date, direction * (view === "week" ? 7 : 1))
  const next = new Date(`${date.slice(0, 7)}-01T12:00:00Z`)
  next.setUTCMonth(next.getUTCMonth() + direction)
  return next.toISOString().slice(0, 10)
}
