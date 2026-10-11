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
})
