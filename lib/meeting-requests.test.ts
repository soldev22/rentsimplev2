import { describe, expect, it } from "vitest"
import { validateMeetingRequest, validateMeetingRequestUpdate } from "@/lib/meeting-requests"

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
