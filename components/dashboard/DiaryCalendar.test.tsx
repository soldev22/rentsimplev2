import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import DiaryCalendar from "./DiaryCalendar"
import type { DiaryEntry } from "@/lib/diary"

const entry: DiaryEntry = {
  id: "11111111-1111-4111-8111-111111111111", firstName: "Taylor", lastName: "Landlord", meetingType: "phone", status: "confirmed",
  appointment: { startAt: "2026-10-12T09:00:00.000Z", endAt: "2026-10-12T09:30:00.000Z", timeZone: "Europe/London", location: "Glasgow office" },
}
describe("shared diary UI", () => {
  it("shows a confirmed meeting in UK time with a direct expandable meeting link", () => {
    const html = renderToStaticMarkup(<DiaryCalendar date="2026-10-12" today="2026-10-12" view="day" entries={[entry]} />)
    expect(html).toContain("10:00 - 10:30")
    expect(html).toContain("Taylor Landlord")
    expect(html).toContain("Glasgow office")
    expect(html).toContain("Confirmed")
    expect(html).toContain(`request=${entry.id}#meeting-${entry.id}`)
    expect(html).toContain("(Today)")
    expect(html).toContain('aria-current="page"')
  })
  it("renders a Monday-first seven-day week with each appointment exactly once", () => {
    const html = renderToStaticMarkup(<DiaryCalendar date="2026-10-12" today="2026-10-12" view="week" entries={[entry]} />)
    expect(html.match(/<section/g)).toHaveLength(8)
    expect(html.indexOf('aria-label="Monday 12 October"')).toBeLessThan(html.indexOf('aria-label="Sunday 18 October"'))
    expect(html).toContain('aria-label="Monday 12 October"')
    expect(html).toContain('aria-label="Sunday 18 October"')
    expect(html.match(/Taylor Landlord/g)).toHaveLength(1)
    expect(html).toContain("view=week")
  })
  it("renders a complete month grid and keeps completed appointments identifiable", () => {
    const html = renderToStaticMarkup(<DiaryCalendar date="2026-10-12" today="2026-10-12" view="month" entries={[{ ...entry, status: "done" }]} />)
    expect(html).toContain("October 2026")
    expect(html.match(/<section/g)).toHaveLength(36)
    expect(html.match(/Taylor Landlord/g)).toHaveLength(1)
    expect(html).toContain("Completed")
    expect(html).toContain("date=2026-11-01")
    expect(html).toContain("date=2026-09-01")
  })
  it("shows empty states and safely escapes appointment locations", () => {
    expect(renderToStaticMarkup(<DiaryCalendar date="2026-10-12" today="2026-10-12" view="day" entries={[]} />)).toContain("No scheduled meetings in this day.")
    const html = renderToStaticMarkup(<DiaryCalendar date="2026-10-12" today="2026-10-12" view="day" entries={[{ ...entry, appointment: { ...entry.appointment, location: "<script>alert(1)</script>" } }]} />)
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")
  })
})
