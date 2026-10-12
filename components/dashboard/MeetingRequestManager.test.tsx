import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import type { MeetingRequest } from "@/lib/meeting-requests"
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
import MeetingRequestManager from "./MeetingRequestManager"

describe("meeting request accordion", () => {
  it("renders separate initially collapsed panels with contact details and delete actions", () => {
    const request: MeetingRequest = {
      id: "one", type: "meeting_request", firstName: "Test", lastName: "Landlord",
      phone: "07700000000", email: "test@example.com", numberOfProperties: 1, town: "Glasgow",
      preferredDays: ["Mon"], preferredTime: "morning", meetingType: "phone", notes: "",
      status: "new", createdAt: "2026-10-11T09:00:00.000Z", updatedAt: "2026-10-11T09:00:00.000Z",
      adminNotes: [], auditEvents: [],
    }
    const html = renderToStaticMarkup(<MeetingRequestManager requests={[request, { ...request, id: "two", firstName: "Second" }]} />)
    expect(html.match(/<details /g)).toHaveLength(2)
    expect(html.match(/<summary /g)).toHaveLength(2)
    expect(html).not.toContain('open=""')
    expect(html.match(/Delete meeting/g)).toHaveLength(2)
    expect(html).toContain("test@example.com")
  })
  it("opens a diary-linked meeting with required UK appointment fields and preserved times", () => {
    const request: MeetingRequest = {
      id: "one", type: "meeting_request", firstName: "Test", lastName: "Landlord",
      phone: "07700000000", email: "test@example.com", numberOfProperties: 1, town: "Glasgow",
      preferredDays: ["Mon"], preferredTime: "morning", meetingType: "phone", notes: "",
      status: "confirmed", createdAt: "2026-10-11T09:00:00.000Z", updatedAt: "2026-10-11T09:00:00.000Z",
      adminNotes: [], auditEvents: [],
      appointment: { startAt: "2026-10-12T09:00:00.000Z", endAt: "2026-10-12T09:30:00.000Z", timeZone: "Europe/London", location: "Office" },
    }
    const html = renderToStaticMarkup(<MeetingRequestManager requests={[request]} expanded />)
    expect(html).toContain('id="meeting-one" open=""')
    expect(html).toContain('name="date"')
    expect(html).toContain('value="2026-10-12"')
    expect(html).toContain('value="10:00"')
    expect(html).toContain('value="10:30"')
    expect(html).toContain('value="Office"')
    expect(html.match(/required=""/g)?.length).toBeGreaterThanOrEqual(3)
    expect(html).toContain("Saving does not send an email invitation.")
    expect(html).toContain("Use meeting details")
    expect(html).toContain("No email is sent until you select Send email.")
  })
})
