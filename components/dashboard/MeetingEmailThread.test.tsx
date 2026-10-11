import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import type { MeetingRequest } from "@/lib/meeting-requests"
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
import MeetingEmailThread from "./MeetingEmailThread"

const request: MeetingRequest = {
  id: "one", type: "meeting_request", firstName: "Test", lastName: "Landlord",
  phone: "07700000000", email: "test@example.com", numberOfProperties: 1, town: "Glasgow",
  preferredDays: ["Mon"], preferredTime: "morning", meetingType: "phone", notes: "Private internal notes",
  status: "new", createdAt: "2026-10-11T09:00:00.000Z", updatedAt: "2026-10-11T09:00:00.000Z",
  adminNotes: [], auditEvents: [],
}
describe("meeting email thread UI", () => {
  it("supports legacy meetings with an empty conversation and labelled composer", () => {
    const html = renderToStaticMarkup(<MeetingEmailThread request={request} />)
    expect(html).toContain("No emails recorded yet")
    expect(html).toContain("Refresh replies")
    expect(html).toContain('for="one-email-subject"')
    expect(html).toContain("Send email")
    expect(html).not.toContain(request.notes)
  })
  it("escapes inbound email content, shows outbound failures and missing attachment notices", () => {
    const html = renderToStaticMarkup(<MeetingEmailThread request={{
      ...request, emailMessages: [
        { id: "incoming", direction: "inbound", subject: "<img onerror=alert(1)>", text: "<script>alert(1)</script>", from: request.email, to: "", createdAt: request.createdAt, status: "received", attachmentCount: 1 },
        { id: "outgoing", direction: "outbound", subject: "Meeting", text: "Can you meet Monday?", from: "", to: request.email, createdAt: request.createdAt, status: "failed", performedBy: "admin@example.com" },
      ],
    }} />)
    expect(html).toContain("&lt;script&gt;")
    expect(html).not.toContain("<script>")
    expect(html).toContain("Sending failed")
    expect(html).toContain("attachment(s) were not imported")
    expect(html).toContain("admin@example.com")
  })
  it("disables sending and explains missing configuration", () => {
    const html = renderToStaticMarkup(<MeetingEmailThread request={request} configurationError="Configure Postmark inbound" />)
    expect(html).toContain('disabled=""')
    expect(html).toContain("Configure Postmark inbound")
  })
})
