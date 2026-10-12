import { isRecord } from "@/lib/meeting-requests"

export const CRM_STAGES = ["Suspect", "Prospect", "Allocated"] as const
export type CrmStage = (typeof CRM_STAGES)[number]

export const CRM_LIMITS = { name: 80, email: 254, company: 120, town: 80, note: 2000 } as const

/** Manually added CRM contact persisted in the dedicated `crm-contacts` container (partition key `/id`). */
export type CrmContactRecord = {
  id: string
  type: "crm_contact"
  email: string
  firstName: string
  lastName: string
  phone: string
  company: string
  town: string
  note: string
  source: "manual"
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  auditEvents: CrmAuditEvent[]
}

export type CrmAuditEvent = {
  id: string
  entityType: "crm_contact"
  entityId: string
  entityKey: string
  action: "created" | "field_changed"
  fieldPath?: string
  oldValue?: string | null
  newValue?: string | null
  performedBy: string
  timestamp: string
}

/** Meeting request projection: no notes, emails, tokens or appointment details. */
export type CrmMeetingFact = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  town: string
  status: string
  createdAt: string
  doneAt: string[]
}

/** Account projection: never includes password, credential or contact-detail fields. */
export type CrmAccountFact = {
  id: string
  email: string
  role: string
  approval_status: string
  createdAt?: string
}

export type CrmContactView = {
  key: string
  email: string
  firstName: string
  lastName: string
  phone: string
  company: string
  town: string
  manual: Pick<CrmContactRecord, "id" | "note" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy"> | null
  meetings: { id: string; status: string; createdAt: string; done: boolean; doneAt: string | null }[]
  accounts: { id: string; role: string; approval_status: string; createdAt: string | null }[]
  stage: CrmStage
  stageReasons: string[]
}

export type CrmContactInput = {
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
  town: string
  note: string
}

export type CrmContactUpdate = Omit<CrmContactInput, "email"> & { expectedUpdatedAt: string }

export type CrmErrors = Partial<Record<keyof CrmContactInput | "expectedUpdatedAt" | "form", string>>

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeCrmEmail(value: string) {
  return value.trim().toLowerCase()
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function validateDetails(body: Record<string, unknown>, errors: CrmErrors) {
  const firstName = text(body.firstName)
  const lastName = text(body.lastName)
  const phone = text(body.phone)
  const company = text(body.company)
  const town = text(body.town)
  const note = text(body.note)
  if (!firstName) errors.firstName = "Enter a first name."
  else if (firstName.length > CRM_LIMITS.name) errors.firstName = `First name must be ${CRM_LIMITS.name} characters or fewer.`
  if (!lastName) errors.lastName = "Enter a last name."
  else if (lastName.length > CRM_LIMITS.name) errors.lastName = `Last name must be ${CRM_LIMITS.name} characters or fewer.`
  if (phone) {
    const digits = phone.replace(/\D/g, "")
    if (!/^\+?[\d\s()-]+$/.test(phone) || digits.length < 7 || digits.length > 15) errors.phone = "Enter a valid phone number (7–15 digits) or leave it blank."
  }
  if (company.length > CRM_LIMITS.company) errors.company = `Company must be ${CRM_LIMITS.company} characters or fewer.`
  if (town.length > CRM_LIMITS.town) errors.town = `Town must be ${CRM_LIMITS.town} characters or fewer.`
  if (note.length > CRM_LIMITS.note) errors.note = `Note must be ${CRM_LIMITS.note} characters or fewer.`
  for (const field of ["stage", "status", "role", "approval_status"]) {
    if (field in body) errors.form = "The CRM stage is derived from meeting and account facts and cannot be set directly."
  }
  return { firstName, lastName, phone, company, town, note }
}

export function validateCrmContactInput(value: unknown): { ok: true; value: CrmContactInput } | { ok: false; errors: CrmErrors } {
  if (!isRecord(value)) return { ok: false, errors: { form: "Send the contact details as a JSON object." } }
  const errors: CrmErrors = {}
  const details = validateDetails(value, errors)
  const email = normalizeCrmEmail(typeof value.email === "string" ? value.email : "")
  if (!email) errors.email = "Enter an email address."
  else if (email.length > CRM_LIMITS.email || !emailPattern.test(email)) errors.email = "Enter a valid email address."
  if (Object.keys(errors).length) return { ok: false, errors }
  return { ok: true, value: { ...details, email } }
}

export function validateCrmContactUpdate(value: unknown): { ok: true; value: CrmContactUpdate } | { ok: false; errors: CrmErrors } {
  if (!isRecord(value)) return { ok: false, errors: { form: "Send the contact details as a JSON object." } }
  const errors: CrmErrors = {}
  const details = validateDetails(value, errors)
  if ("email" in value) errors.email = "The email is the contact's identity and cannot be changed. Add a new contact for a different email."
  const expectedUpdatedAt = text(value.expectedUpdatedAt)
  if (!expectedUpdatedAt || Number.isNaN(Date.parse(expectedUpdatedAt))) errors.expectedUpdatedAt = "The contact version is required. Refresh and try again."
  if (Object.keys(errors).length) return { ok: false, errors }
  return { ok: true, value: { ...details, expectedUpdatedAt } }
}

/** A meeting counts as done if it is done now or its audit history ever recorded a change to done. */
export function meetingDoneAt(meeting: Pick<CrmMeetingFact, "status" | "doneAt">) {
  const history = [...(meeting.doneAt ?? [])].filter((value) => typeof value === "string").sort()
  if (history.length) return history[0]
  return meeting.status === "done" ? "" : null
}

/**
 * Stage is derived only from persisted facts, highest stage wins:
 * Allocated = an account exists with the same normalized email (any verification/approval status).
 * Prospect = at least one meeting with that email has been marked done (now or in its history).
 * Suspect = everything else, including manual contacts and new/confirmed/cancelled meetings.
 */
export function deriveCrmStage(facts: {
  hasManualContact: boolean
  meetings: Pick<CrmMeetingFact, "id" | "status" | "doneAt">[]
  accounts: Pick<CrmAccountFact, "id" | "approval_status">[]
}): { stage: CrmStage; reasons: string[] } {
  const done = facts.meetings.filter((meeting) => meetingDoneAt(meeting) !== null)
  const reasons: string[] = []
  if (facts.accounts.length) {
    for (const account of facts.accounts) {
      reasons.push(`Registered account ${account.id} uses this email (status: ${account.approval_status.replaceAll("_", " ")}). Verification or approval does not affect the CRM stage.`)
    }
    if (done.length) reasons.push(`Previously a Prospect: ${done.length} meeting${done.length === 1 ? "" : "s"} marked done.`)
    return { stage: "Allocated", reasons }
  }
  if (done.length) {
    for (const meeting of done) {
      reasons.push(meeting.status === "done"
        ? `Meeting request ${meeting.id} is marked done.`
        : `Meeting request ${meeting.id} was marked done earlier (now ${meeting.status}); completed meetings stay in the history.`)
    }
    return { stage: "Prospect", reasons: [...reasons, "No registered account uses this email yet."] }
  }
  const open = facts.meetings.filter((meeting) => meeting.status !== "cancelled")
  if (open.length) reasons.push(`${open.length} meeting request${open.length === 1 ? " is" : "s are"} ${[...new Set(open.map((meeting) => meeting.status))].join("/")}; a meeting must be marked done to become a Prospect.`)
  if (facts.meetings.length > open.length) reasons.push(`${facts.meetings.length - open.length} cancelled meeting request${facts.meetings.length - open.length === 1 ? "" : "s"}.`)
  if (facts.hasManualContact && !facts.meetings.length) reasons.push("Added manually; no meeting has been requested or completed.")
  reasons.push("No registered account uses this email yet.")
  return { stage: "Suspect", reasons }
}

/** Merges manual contacts, meeting requests and accounts into one contact per normalized email. */
export function buildCrmContacts(input: {
  contacts: Omit<CrmContactRecord, "auditEvents">[]
  meetings: CrmMeetingFact[]
  accounts: CrmAccountFact[]
}): CrmContactView[] {
  const groups = new Map<string, { manual?: Omit<CrmContactRecord, "auditEvents">; meetings: CrmMeetingFact[]; accounts: CrmAccountFact[] }>()
  const group = (email: string) => {
    const key = normalizeCrmEmail(email)
    if (!key) return null
    let entry = groups.get(key)
    if (!entry) {
      entry = { meetings: [], accounts: [] }
      groups.set(key, entry)
    }
    return entry
  }
  for (const contact of input.contacts) {
    const entry = group(contact.email)
    if (entry && (!entry.manual || contact.createdAt < entry.manual.createdAt)) entry.manual = contact
  }
  for (const meeting of input.meetings) group(meeting.email)?.meetings.push(meeting)
  // Accounts only attach to contacts that already exist through a manual record or meeting request.
  for (const account of input.accounts) {
    const entry = groups.get(normalizeCrmEmail(account.email))
    if (entry && !entry.accounts.some((existing) => existing.id === account.id)) entry.accounts.push(account)
  }
  return [...groups.entries()].map(([key, entry]) => {
    const meetings = [...entry.meetings].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const latest = meetings[0]
    const { stage, reasons } = deriveCrmStage({ hasManualContact: Boolean(entry.manual), meetings, accounts: entry.accounts })
    return {
      key,
      email: key,
      firstName: entry.manual?.firstName || latest?.firstName || "",
      lastName: entry.manual?.lastName || latest?.lastName || "",
      phone: entry.manual?.phone || latest?.phone || "",
      company: entry.manual?.company ?? "",
      town: entry.manual?.town || latest?.town || "",
      manual: entry.manual ? {
        id: entry.manual.id, note: entry.manual.note, createdAt: entry.manual.createdAt, createdBy: entry.manual.createdBy,
        updatedAt: entry.manual.updatedAt, updatedBy: entry.manual.updatedBy,
      } : null,
      meetings: meetings.map((meeting) => {
        const doneAt = meetingDoneAt(meeting)
        return { id: meeting.id, status: meeting.status, createdAt: meeting.createdAt, done: doneAt !== null, doneAt: doneAt || null }
      }),
      accounts: entry.accounts.map((account) => ({ id: account.id, role: account.role, approval_status: account.approval_status, createdAt: account.createdAt ?? null })),
      stage,
      stageReasons: reasons,
    }
  }).sort((a, b) => `${a.lastName} ${a.firstName} ${a.email}`.localeCompare(`${b.lastName} ${b.firstName} ${b.email}`, "en-GB", { sensitivity: "base" }))
}
