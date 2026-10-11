import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AuthUser } from "@/lib/auth"
vi.mock("server-only", () => ({}))
const mocks = vi.hoisted(() => ({ admins: vi.fn(), email: vi.fn(), sms: vi.fn() }))
vi.mock("@/lib/server/users", () => ({ listApprovedGlobalAdmins: mocks.admins }))
vi.mock("@/lib/server/email", () => ({ sendEmail: mocks.email }))
vi.mock("@/lib/server/sms", () => ({ sendSms: mocks.sms }))
import { sendLandlordApplicationNotifications } from "./landlord-application-notifications"

const user: AuthUser = { id: "prospect", first_name: "Test", last_name: "Landlord", email: "prospect@example.com", mobile: "07700000000", role: "unallocated", requestedRole: "landlord", approval_status: "pending_approval", createdAt: "", updatedAt: "" }
describe("Landlord application alerts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.admins.mockResolvedValue([{ email: "admin@example.com", mobile: "07711111111" }])
    mocks.email.mockResolvedValue({ status: "sent" })
    mocks.sms.mockResolvedValue({ status: "sent" })
  })
  it("sends approved Global admins email and SMS with a link to Users", async () => {
    await sendLandlordApplicationNotifications(user)
    expect(mocks.email).toHaveBeenCalledWith(expect.objectContaining({ to: "admin@example.com", subject: "New verified Landlord application", text: expect.stringContaining("/dashboard/users") }))
    expect(mocks.sms).toHaveBeenCalledWith("07711111111", expect.stringContaining("/dashboard/users"))
    expect(mocks.email).not.toHaveBeenCalledWith(expect.objectContaining({ to: user.email }))
  })
  it("isolates email failures so SMS still runs and reports failed delivery", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    mocks.email.mockRejectedValue(new Error("Provider rejected"))
    await expect(sendLandlordApplicationNotifications(user)).resolves.toBeUndefined()
    expect(mocks.sms).toHaveBeenCalledOnce()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
