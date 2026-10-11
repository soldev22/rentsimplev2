import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import type { MeetingRequest } from "@/lib/meeting-requests"

const mocks = vi.hoisted(() => ({ email: vi.fn(), sms: vi.fn(), admins: vi.fn(), configuration: vi.fn(), confirmation: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/server/email", () => ({ sendEmail: mocks.email }))
vi.mock("@/lib/server/sms", () => ({ sendSms: mocks.sms }))
vi.mock("@/lib/server/users", () => ({ listApprovedGlobalAdmins: mocks.admins }))
vi.mock("@/lib/server/meeting-email", () => ({ getMeetingEmailConfigurationError: mocks.configuration, sendMeetingConfirmationEmail: mocks.confirmation }))
import { sendMeetingRequestNotifications } from "@/lib/server/meeting-request-notifications"

const request: MeetingRequest = {
  id: "meeting-1", type: "meeting_request", firstName: "Taylor", lastName: "Landlord", phone: "07739870670",
  email: "taylor@example.com", numberOfProperties: 2, town: "Glasgow", preferredDays: ["Mon"],
  preferredTime: "morning", meetingType: "phone", notes: "Private notes", status: "new",
  createdAt: "", updatedAt: "", adminNotes: [], auditEvents: [],
}
describe("meeting notifications", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://rent.example/")
    vi.spyOn(console, "warn").mockImplementation(() => {})
    mocks.email.mockResolvedValue({ status: "sent" })
    mocks.sms.mockResolvedValue({ status: "sent" })
    mocks.admins.mockResolvedValue([{ email: "admin@example.com", mobile: "+447700900123" }])
    mocks.configuration.mockReturnValue("Not configured")
  })
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs() })
  it("emails the prospect, emails admins and sends admins a PII-free dashboard SMS", async () => {
    expect(await sendMeetingRequestNotifications(request)).toEqual({ confirmationSent: true, adminsNotified: true })
    expect(mocks.email).toHaveBeenCalledWith(expect.objectContaining({ to: request.email, text: expect.stringContaining("not a confirmed booking") }))
    expect(mocks.email).toHaveBeenCalledWith(expect.objectContaining({ to: "admin@example.com", replyTo: request.email, text: expect.stringContaining("Private notes") }))
    expect(mocks.sms).toHaveBeenCalledWith("+447700900123", "RentSimple: new Landlord meeting request. Review: https://rent.example/dashboard/meeting-requests")
    expect(mocks.sms.mock.calls[0][1]).not.toContain(request.email)
    expect(mocks.sms.mock.calls[0][1]).not.toContain(request.notes)
  })
  it("isolates delivery failures so other channels are still attempted", async () => {
    mocks.email.mockRejectedValueOnce(new Error("prospect email failed"))
    mocks.sms.mockRejectedValueOnce(new Error("SMS failed"))
    expect(await sendMeetingRequestNotifications(request)).toEqual({ confirmationSent: false, adminsNotified: false })
    expect(mocks.email).toHaveBeenCalledTimes(2)
    expect(mocks.sms).toHaveBeenCalledOnce()
    expect(console.warn).toHaveBeenCalled()
  })
  it("makes the first email benefit-led while preserving the booking caveat and preferences", async () => {
    await sendMeetingRequestNotifications(request)
    const prospectEmail = mocks.email.mock.calls.find(([message]) => message.to === request.email)?.[0]
    expect(prospectEmail).toBeDefined()
    expect(prospectEmail.subject).toBe("Less rental hassle. More time for you. Let's talk.")
    expect(prospectEmail.text).toContain("Hello Taylor,")
    expect(prospectEmail.text).toContain("Your rental property should work for you, not take over your day.")
    expect(prospectEmail.text).toContain("Our own maintenance team for small jobs, keeping costs low.")
    expect(prospectEmail.text).toContain("This is a request, not a confirmed booking.")
    expect(prospectEmail.text).toContain("Preferred days: Mon")
    expect(prospectEmail.text).toContain("Preferred time: morning")
    expect(prospectEmail.text).toContain("Meeting type: phone")
    expect(prospectEmail.text).toContain("If you don't want to wait, please feel free to call me, Mike, on 07739 870670.")
    expect(prospectEmail.text).toContain("up to 50% off for the lifetime of your tenancy")
    expect(prospectEmail.text).not.toContain(request.id)
    expect(prospectEmail.text).not.toContain("Reference:")
    expect(prospectEmail.text).not.toContain(request.notes)
    expect(prospectEmail.text).not.toContain("Tell us about your properties")
  })
  it("still confirms to the prospect when admin lookup fails", async () => {
    mocks.admins.mockRejectedValue(new Error("lookup failed"))
    expect(await sendMeetingRequestNotifications(request)).toEqual({ confirmationSent: true, adminsNotified: false })
  })
  it("reports missing admins and mobile numbers", async () => {
    mocks.admins.mockResolvedValue([])
    expect((await sendMeetingRequestNotifications(request)).adminsNotified).toBe(false)
    mocks.admins.mockResolvedValue([{ email: "admin@example.com", mobile: "" }])
    expect((await sendMeetingRequestNotifications(request)).adminsNotified).toBe(false)
    expect(mocks.sms).not.toHaveBeenCalled()
  })
  it("uses the tracked conversation path for new acknowledgement emails when configured", async () => {
    mocks.configuration.mockReturnValue(null)
    mocks.confirmation.mockResolvedValue(true)
    expect((await sendMeetingRequestNotifications(request)).confirmationSent).toBe(true)
    expect(mocks.confirmation).toHaveBeenCalledWith(request, expect.any(String), expect.stringContaining("not a confirmed booking"))
    expect(mocks.email).toHaveBeenCalledTimes(1)
    expect(mocks.email).not.toHaveBeenCalledWith(expect.objectContaining({ to: request.email }))
  })
})
