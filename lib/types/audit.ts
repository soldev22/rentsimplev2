export type AuditValue = string | number | boolean | null | string[] | Record<string, unknown> | Array<Record<string, unknown>>

export const AUDIT_ACTION_TYPES = {
  SUGGESTED: "SUGGESTED",
  APPROVED_BY_LANDLORD: "APPROVED_BY_LANDLORD",
  EXECUTED_BY_SYSTEM: "EXECUTED_BY_SYSTEM",
} as const

export type AuditActionType = (typeof AUDIT_ACTION_TYPES)[keyof typeof AUDIT_ACTION_TYPES]

export type AuditEventRecord = {
  id: string
  entityType: string
  entityId: string
  entityKey: string
  action: string | AuditActionType
  fieldPath?: string
  oldValue?: AuditValue
  newValue?: AuditValue
  performedBy: string
  timestamp: string
  metadata?: Record<string, unknown>
}