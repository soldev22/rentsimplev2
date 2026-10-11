import type { AuditEventRecord } from "@/lib/types/audit"
import { validateAppointment, type MeetingAppointment } from "@/lib/diary"

export const MEETING_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
export const MEETING_TIMES = ["morning", "afternoon", "evening"] as const
export const MEETING_TYPES = ["phone", "video", "in person"] as const
export const MEETING_STATUSES = ["new", "confirmed", "done", "cancelled"] as const

export type MeetingRequestInput = {
  firstName: string
  lastName: string
  phone: string
  email: string
  numberOfProperties: number
  town: string
  preferredDays: (typeof MEETING_DAYS)[number][]
  preferredTime: (typeof MEETING_TIMES)[number]
  meetingType: (typeof MEETING_TYPES)[number]
  notes: string
}

export type MeetingRequest = MeetingRequestInput & {
  id: string
  type: "meeting_request"
  status: (typeof MEETING_STATUSES)[number]
  createdAt: string
  updatedAt: string
  adminNotes: { text: string; performedBy: string; createdAt: string }[]
  auditEvents: AuditEventRecord[]
  emailReplyToken?: string
  emailMessages?: MeetingEmailMessage[]
  appointment?: MeetingAppointment
}

export type MeetingEmailMessage = {
  id: string
  direction: "inbound" | "outbound"
  subject: string
  text: string
  from: string
  to: string
  createdAt: string
  status: "received" | "sending" | "sent" | "failed" | "skipped"
  performedBy?: string
  providerMessageId?: string
  attachmentCount?: number
}

export type MeetingEmailInput = { id: string; subject: string; text: string }

export function validateMeetingEmail(value: unknown): MeetingEmailInput | null {
  if (!isRecord(value) || typeof value.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id) ||
      typeof value.subject !== "string" || typeof value.text !== "string") return null
  const subject = value.subject.trim()
  const text = value.text.trim()
  if (!subject || subject.length > 200 || /[\r\n]/.test(subject) || !text || text.length > 10000) return null
  return { id: value.id, subject, text }
}

export type MeetingErrors = Partial<Record<keyof MeetingRequestInput | "website" | "form", string>>

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isOption<T extends string>(options: readonly T[], value: unknown): value is T {
  return typeof value === "string" && options.some((option) => option === value)
}

export function validateMeetingRequest(value: unknown):
  | { success: true; data: MeetingRequestInput }
  | { success: false; errors: MeetingErrors } {
  if (!isRecord(value)) return { success: false, errors: { form: "Invalid request." } }

  const body = value
  const errors: MeetingErrors = {}
  function text(field: keyof MeetingRequestInput, label: string, max: number, required = true) {
    const raw = body[field]
    if (typeof raw !== "string" && !(raw === undefined && !required)) {
      errors[field] = `${label} is ${required ? "required" : "invalid"}.`
      return ""
    }
    const normalized = typeof raw === "string" ? raw.trim() : ""
    if (required && !normalized) errors[field] = `${label} is required.`
    if (normalized.length > max) errors[field] = `${label} must be ${max} characters or fewer.`
    return normalized
  }

  const firstName = text("firstName", "First name", 100)
  const lastName = text("lastName", "Last name", 100)
  const phone = text("phone", "Phone", 30)
  const email = text("email", "Email", 254).toLowerCase()
  const town = text("town", "Town", 120)
  const notes = text("notes", "Notes", 2000, false)
  if (phone && (!/^\+?[\d ()-]+$/.test(phone) || !/^\d{7,15}$/.test(phone.replace(/\D/g, "")))) {
    errors.phone = "Enter a valid phone number with 7 to 15 digits."
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address."
  const numberOfProperties = value.numberOfProperties
  if (typeof numberOfProperties !== "number" || !Number.isSafeInteger(numberOfProperties) || numberOfProperties < 1) {
    errors.numberOfProperties = "Enter a whole number of properties, at least 1."
  }
  const days = value.preferredDays
  const preferredDays = Array.isArray(days) ? days.filter((day) => isOption(MEETING_DAYS, day)) : []
  if (!Array.isArray(days) || days.length < 1 || days.length > 3 || preferredDays.length !== days.length || new Set(days).size !== days.length) {
    errors.preferredDays = "Choose between 1 and 3 different days, Monday to Saturday."
  }
  if (!isOption(MEETING_TIMES, value.preferredTime)) errors.preferredTime = "Choose a preferred time."
  if (!isOption(MEETING_TYPES, value.meetingType)) errors.meetingType = "Choose a meeting type."
  if (value.website !== undefined && (typeof value.website !== "string" || value.website.length > 0)) {
    errors.website = "Unable to accept this request."
  }
  if (Object.keys(errors).length || typeof numberOfProperties !== "number" ||
      !isOption(MEETING_TIMES, value.preferredTime) || !isOption(MEETING_TYPES, value.meetingType)) {
    return { success: false, errors }
  }
  return {
    success: true,
    data: { firstName, lastName, phone, email, numberOfProperties, town, preferredDays, preferredTime: value.preferredTime, meetingType: value.meetingType, notes },
  }
}

export type MeetingRequestUpdate = {
  status: MeetingRequest["status"]
  note: string
  expectedUpdatedAt: string
  appointment?: MeetingAppointment
}

export function validateMeetingRequestUpdate(value: unknown): MeetingRequestUpdate | null {
  if (!isRecord(value) || !isOption(MEETING_STATUSES, value.status) ||
      typeof value.expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(value.expectedUpdatedAt)) ||
      (value.note !== undefined && typeof value.note !== "string")) return null
  const note = typeof value.note === "string" ? value.note.trim() : ""
  if (note.length > 2000) return null
  const appointment = value.appointment === undefined ? undefined : validateAppointment(value.appointment)
  if (appointment === null) return null
  return { status: value.status, note, expectedUpdatedAt: value.expectedUpdatedAt, ...(appointment ? { appointment } : {}) }
}
