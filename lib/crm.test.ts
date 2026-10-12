import { describe, expect, it } from "vitest"
import {
  buildCrmContacts,
  deriveCrmStage,
  normalizeCrmEmail,
  validateCrmContactInput,
  validateCrmContactUpdate,
  type CrmAccountFact,
  type CrmContactRecord,
  type CrmMeetingFact,
} from "@/lib/crm"

const manual = (overrides: Partial<CrmContactRecord> = {}): Omit<CrmContactRecord, "auditEvents"> => ({
  id: "c1", type: "crm_contact", email: "sam@example.com", firstName: "Sam", lastName: "Shaw", phone: "", company: "Shaw Lettings",
  town: "Leeds", note: "Met at expo", source: "manual", createdAt: "2026-01-01T00:00:00.000Z", createdBy: "admin@example.com",
  updatedAt: "2026-01-01T00:00:00.000Z", updatedBy: "admin@example.com", ...overrides,
})
const meeting = (overrides: Partial<CrmMeetingFact> = {}): CrmMeetingFact => ({
  id: "m1", firstName: "Sam", lastName: "Shaw", email: "sam@example.com", phone: "07700900000", town: "Leeds",
  status: "new", createdAt: "2026-02-01T00:00:00.000Z", doneAt: [], ...overrides,
})
const account = (overrides: Partial<CrmAccountFact> = {}): CrmAccountFact => ({
  id: "u1", email: "sam@example.com", role: "landlord", approval_status: "pending_verification", createdAt: "2026-03-01T00:00:00.000Z", ...overrides,
})
const build = (input: Partial<Parameters<typeof buildCrmContacts>[0]>) => buildCrmContacts({ contacts: [], meetings: [], accounts: [], ...input })

describe("CRM stage lifecycle", () => {
  it("treats a manual contact without a meeting as a Suspect", () => {
    const [contact] = build({ contacts: [manual()] })
    expect(contact.stage).toBe("Suspect")
    expect(contact.stageReasons.join(" ")).toContain("Added manually")
    expect(contact.manual?.id).toBe("c1")
  })
  it.each(["new", "confirmed"])("keeps a %s meeting request as a Suspect", (status) => {
    const [contact] = build({ meetings: [meeting({ status })] })
    expect(contact.stage).toBe("Suspect")
    expect(contact.stageReasons.join(" ")).toContain("must be marked done")
  })
  it("treats a cancelled meeting as a Suspect", () => {
    expect(build({ meetings: [meeting({ status: "cancelled" })] })[0].stage).toBe("Suspect")
  })
  it("becomes a Prospect only once a meeting is marked done", () => {
    const [contact] = build({ contacts: [manual()], meetings: [meeting({ status: "done", doneAt: ["2026-02-05T10:00:00.000Z"] })] })
    expect(contact.stage).toBe("Prospect")
    expect(contact.meetings[0]).toMatchObject({ id: "m1", done: true, doneAt: "2026-02-05T10:00:00.000Z" })
    expect(contact.stageReasons[0]).toBe("Meeting request m1 is marked done.")
  })
  it("treats a done status without history as a Prospect", () => {
    expect(build({ meetings: [meeting({ status: "done" })] })[0].stage).toBe("Prospect")
  })
  it("keeps Prospect when a done meeting is followed by a new booking", () => {
    const [contact] = build({ meetings: [
      meeting({ id: "m1", status: "done", doneAt: ["2026-02-05T10:00:00.000Z"] }),
      meeting({ id: "m2", status: "new", createdAt: "2026-04-01T00:00:00.000Z" }),
    ] })
    expect(contact.stage).toBe("Prospect")
    expect(contact.meetings.map((item) => [item.id, item.done])).toEqual([["m2", false], ["m1", true]])
  })
  it("keeps Prospect when a meeting marked done is later moved to another status", () => {
    const [contact] = build({ meetings: [meeting({ status: "confirmed", doneAt: ["2026-02-05T10:00:00.000Z"] })] })
    expect(contact.stage).toBe("Prospect")
    expect(contact.stageReasons[0]).toContain("was marked done earlier")
  })
  it.each(["pending_verification", "pending_approval", "approved", "rejected"])("becomes Allocated for a registered %s account", (approval_status) => {
    const [contact] = build({ contacts: [manual()], meetings: [meeting()], accounts: [account({ approval_status })] })
    expect(contact.stage).toBe("Allocated")
    expect(contact.accounts).toEqual([{ id: "u1", role: "landlord", approval_status, createdAt: "2026-03-01T00:00:00.000Z" }])
    expect(contact.stageReasons[0]).toContain("Verification or approval does not affect the CRM stage")
  })
  it("ranks Allocated above Prospect and records prior done meetings", () => {
    const result = deriveCrmStage({ hasManualContact: false, meetings: [{ id: "m1", status: "done", doneAt: [] }], accounts: [{ id: "u1", approval_status: "approved" }] })
    expect(result.stage).toBe("Allocated")
    expect(result.reasons).toContain("Previously a Prospect: 1 meeting marked done.")
  })
})

describe("CRM contact merging", () => {
  it("merges manual contacts and meeting requests by normalized email without duplicates", () => {
    const contacts = build({
      contacts: [manual({ email: "sam@example.com" })],
      meetings: [meeting({ email: " SAM@Example.com " }), meeting({ id: "m2", email: "sam@example.com" })],
    })
    expect(contacts).toHaveLength(1)
    expect(contacts[0].meetings.map((item) => item.id).sort()).toEqual(["m1", "m2"])
    expect(contacts[0].company).toBe("Shaw Lettings")
  })
  it("never matches contacts or accounts by name", () => {
    const contacts = build({
      contacts: [manual()],
      meetings: [meeting({ id: "m2", email: "other@example.com" })],
      accounts: [account({ id: "u2", email: "third@example.com" })],
    })
    expect(contacts).toHaveLength(2)
    expect(contacts.every((contact) => contact.stage === "Suspect" && contact.accounts.length === 0)).toBe(true)
  })
  it("does not list accounts that have no manual contact or meeting request", () => {
    expect(build({ accounts: [account()] })).toEqual([])
  })
  it("normalizes email identity", () => {
    expect(normalizeCrmEmail("  Sam@Example.COM ")).toBe("sam@example.com")
  })
})

describe("CRM validation", () => {
  const valid = { firstName: " Sam ", lastName: "Shaw", email: " Sam@Example.com ", phone: "", company: "", town: "", note: "" }
  it("normalizes valid input", () => {
    expect(validateCrmContactInput(valid)).toEqual({ ok: true, value: { ...valid, firstName: "Sam", email: "sam@example.com" } })
  })
  it("returns field errors", () => {
    const result = validateCrmContactInput({ ...valid, firstName: "", email: "bad", phone: "12", note: "x".repeat(2001) })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["email", "firstName", "note", "phone"])
  })
  it.each(["stage", "status", "role", "approval_status"])("rejects attempts to set %s", (field) => {
    const result = validateCrmContactInput({ ...valid, [field]: "Prospect" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.form).toContain("cannot be set directly")
  })
  it("rejects email changes and requires the contact version on update", () => {
    const result = validateCrmContactUpdate({ ...valid })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["email", "expectedUpdatedAt"])
  })
  it("accepts a valid update", () => {
    const { email: _email, ...details } = valid
    void _email
    const result = validateCrmContactUpdate({ ...details, expectedUpdatedAt: "2026-01-01T00:00:00.000Z" })
    expect(result.ok).toBe(true)
  })
})
