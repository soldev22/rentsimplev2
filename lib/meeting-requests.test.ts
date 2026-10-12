import { describe, expect, it } from "vitest"
import { meetingEmailDraft, validateMeetingEmail, validateMeetingRequest, validateMeetingRequestUpdate, type MeetingRequest } from "@/lib/meeting-requests"

const valid = {
  firstName: " Taylor ", lastName: " Landlord ", phone: "07739 870670",
  email: " TAYLOR@example.com ", numberOfProperties: 2, town: " Glasgow ",
  preferredDays: ["Mon", "Sat"], preferredTime: "morning", meetingType: "phone",
  notes: " Please call first. ", website: "",
}

describe("meeting request validation", () => {
  it("normalizes text and excludes honeypot and untrusted fields", () => {
    const result = validateMeetingRequest({ ...valid, id: "injected", status: "confirmed", adminNotes: ["injected"] })
    expect(result).toEqual({
      success: true, data: {
        firstName: "Taylor", lastName: "Landlord", phone: "07739 870670",
        email: "taylor@example.com", numberOfProperties: 2, town: "Glasgow",
        preferredDays: ["Mon", "Sat"], preferredTime: "morning", meetingType: "phone", notes: "Please call first.",
      },
    })
  })
  describe("meeting email drafts", () => {
    const request: MeetingRequest = {
      ...valid, preferredDays: ["Mon"], preferredTime: "morning", meetingType: "video",
      firstName: "Taylor", notes: "Private prospect notes",
      id: "one", type: "meeting_request", status: "new",
      createdAt: "2026-10-11T09:00:00.000Z", updatedAt: "2026-10-11T09:00:00.000Z",
      adminNotes: [{ text: "Private admin note", performedBy: "admin", createdAt: "" }], auditEvents: [],
    }
    it("includes a friendly greeting, exact UK date/times, meeting type and link without private notes", () => {
      const draft = meetingEmailDraft(request, {
        startAt: "2026-10-12T09:00:00.000Z", endAt: "2026-10-12T09:30:00.000Z",
        timeZone: "Europe/London", location: "https://example.com/meeting",
      })
      expect(draft.subject).toBe("Your RentSimple meeting details")
      expect(draft.text).toContain("Hi Taylor,")
      expect(draft.text).toContain("Monday, 12 October 2026")
      expect(draft.text).toContain("10:00 - 10:30 (UK time, Europe/London)")
      expect(draft.text).toContain("Meeting type: Video meeting")
      expect(draft.text).toContain("https://example.com/meeting")
      expect(draft.text).toContain("Please reply")
      expect(draft.text).not.toContain("Private")
      expect(validateMeetingEmail({ ...draft, id: "11111111-1111-4111-8111-111111111111" })).not.toBeNull()
    })
    it.each(["phone", "in person"] as const)("handles winter times and optional locations for %s meetings", (meetingType) => {
      const draft = meetingEmailDraft({ ...request, meetingType }, {
        startAt: "2026-12-14T10:00:00.000Z", endAt: "2026-12-14T10:30:00.000Z",
        timeZone: "Europe/London", location: "",
      })
      expect(draft.text).toContain("Monday, 14 December 2026")
      expect(draft.text).toContain("10:00 - 10:30")
      expect(draft.text).toContain(meetingType === "phone" ? "Phone call" : "In-person meeting")
      expect(draft.text).not.toContain("Location or video link:")
    })
  })
  it.each([null, [], "text", 42])("rejects a non-object body (%j)", (value) => {
    expect(validateMeetingRequest(value).success).toBe(false)
  })
  it.each([
    ["firstName", ""], ["lastName", " "], ["town", ""], ["email", "bad@email"],
    ["email", "a@example.com\nBcc: other@example.com"], ["phone", "123"], ["phone", "abc07739870670"],
    ["phone", "1".repeat(16)], ["numberOfProperties", 0], ["numberOfProperties", -1],
    ["numberOfProperties", 1.5], ["numberOfProperties", "2"], ["numberOfProperties", Number.MAX_SAFE_INTEGER + 1],
    ["preferredDays", []], ["preferredDays", ["Mon", "Tue", "Wed", "Thu"]],
    ["preferredDays", ["Mon", "Mon"]], ["preferredDays", ["Sun"]], ["preferredDays", "Mon"],
    ["preferredTime", "night"], ["meetingType", "anything"],
    ["notes", "n".repeat(2001)], ["notes", {}], ["firstName", "n".repeat(101)],
    ["lastName", "n".repeat(101)], ["town", "n".repeat(121)], ["email", "a".repeat(255)],
    ["website", "bot"], ["website", " "], ["website", {}],
  ])("rejects invalid %s (%j)", (field, value) => {
    const result = validateMeetingRequest({ ...valid, [field]: value })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.errors).toHaveProperty(field)
  })
  it("accepts exactly three distinct days, optional notes and international phone numbers", () => {
    const result = validateMeetingRequest({ ...valid, preferredDays: ["Mon", "Wed", "Sat"], notes: undefined, phone: "+44 (7739) 870670" })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.notes).toBe("")
  })
  it("validates admin updates without coercing statuses or notes", () => {
    const update = { status: "done", note: " Called ", expectedUpdatedAt: "2026-10-11T09:00:00.000Z" }
    expect(validateMeetingRequestUpdate(update)).toEqual({ ...update, note: "Called" })
    for (const invalid of [null, { ...update, status: "bogus" }, { ...update, note: [] }, { ...update, note: "x".repeat(2001) }, { ...update, expectedUpdatedAt: "" }]) {
      expect(validateMeetingRequestUpdate(invalid)).toBeNull()
    }
  })
})
