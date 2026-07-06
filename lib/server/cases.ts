import "server-only"

import { randomUUID } from "node:crypto"

import {
  type AuthUser,
  canManageProperties,
  type CaseType,
  type LegalTimerConfiguration,
  type LegalTimerRequirement,
  type PropertyCase,
  type CaseStatus,
} from "@/lib/auth"
import { AUDIT_ACTION_TYPES } from "@/lib/types/audit"
import { writeAuditEvent } from "@/lib/server/audit"

// Default Damp configuration per UK Housing Act legislation
const DEFAULT_DAMP_CONFIG: LegalTimerConfiguration = {
  id: randomUUID(),
  caseType: "damp",
  displayName: "Damp & Mould",
  description: "UK legislation: Housing Act 2004, Environmental Protection Act 1990",
  requirements: [
    {
      id: randomUUID(),
      order: 1,
      requirement: "Investigate a report of damp or mould",
      daysAllowed: 10,
      workingDaysOnly: true,
      escalationAlerts: ["alert_24h", "alert_72h"],
      notifyOnCreation: true,
      notifyOnEscalation: true,
    },
    {
      id: randomUUID(),
      order: 2,
      requirement: "Provide tenant with a written summary of the investigation",
      daysAllowed: 3,
      workingDaysOnly: true,
      escalationAlerts: ["alert_24h"],
      notifyOnCreation: false,
      notifyOnEscalation: true,
    },
    {
      id: randomUUID(),
      order: 3,
      requirement: "Begin any necessary repairs",
      daysAllowed: 5,
      workingDaysOnly: true,
      escalationAlerts: ["alert_24h", "alert_72h", "alert_5d"],
      notifyOnCreation: false,
      notifyOnEscalation: true,
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

// Default Flood configuration
const DEFAULT_FLOOD_CONFIG: LegalTimerConfiguration = {
  id: randomUUID(),
  caseType: "flood",
  displayName: "Flood & Water Damage",
  description: "Emergency response protocol",
  requirements: [
    {
      id: randomUUID(),
      order: 1,
      requirement: "Acknowledge tenant report",
      daysAllowed: 1,
      workingDaysOnly: false,
      escalationAlerts: ["alert_24h"],
      notifyOnCreation: true,
      notifyOnEscalation: true,
    },
    {
      id: randomUUID(),
      order: 2,
      requirement: "Emergency contractor assessment",
      daysAllowed: 1,
      workingDaysOnly: false,
      escalationAlerts: [],
      notifyOnCreation: false,
      notifyOnEscalation: false,
    },
    {
      id: randomUUID(),
      order: 3,
      requirement: "Begin mitigation and repairs",
      daysAllowed: 5,
      workingDaysOnly: true,
      escalationAlerts: ["alert_24h", "alert_72h"],
      notifyOnCreation: false,
      notifyOnEscalation: true,
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const DEFAULT_CONFIGURATIONS: Record<CaseType, LegalTimerConfiguration> = {
  damp: DEFAULT_DAMP_CONFIG,
  flood: DEFAULT_FLOOD_CONFIG,
  maintenance_request: {
    id: randomUUID(),
    caseType: "maintenance_request",
    displayName: "Maintenance Request",
    description: "Standard maintenance handling",
    requirements: [
      {
        id: randomUUID(),
        order: 1,
        requirement: "Acknowledge maintenance request",
        daysAllowed: 1,
        workingDaysOnly: true,
        escalationAlerts: ["alert_24h"],
        notifyOnCreation: true,
        notifyOnEscalation: true,
      },
      {
        id: randomUUID(),
        order: 2,
        requirement: "Arrange contractor inspection",
        daysAllowed: 7,
        workingDaysOnly: true,
        escalationAlerts: ["alert_72h"],
        notifyOnCreation: false,
        notifyOnEscalation: true,
      },
      {
        id: randomUUID(),
        order: 3,
        requirement: "Complete repairs",
        daysAllowed: 14,
        workingDaysOnly: true,
        escalationAlerts: ["alert_5d"],
        notifyOnCreation: false,
        notifyOnEscalation: true,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  complaint: {
    id: randomUUID(),
    caseType: "complaint",
    displayName: "Tenant Complaint",
    description: "Complaints handling procedure",
    requirements: [
      {
        id: randomUUID(),
        order: 1,
        requirement: "Acknowledge complaint receipt",
        daysAllowed: 2,
        workingDaysOnly: true,
        escalationAlerts: ["alert_24h"],
        notifyOnCreation: true,
        notifyOnEscalation: true,
      },
      {
        id: randomUUID(),
        order: 2,
        requirement: "Investigate and propose resolution",
        daysAllowed: 10,
        workingDaysOnly: true,
        escalationAlerts: ["alert_72h"],
        notifyOnCreation: false,
        notifyOnEscalation: true,
      },
      {
        id: randomUUID(),
        order: 3,
        requirement: "Provide formal written response",
        daysAllowed: 3,
        workingDaysOnly: true,
        escalationAlerts: ["alert_24h"],
        notifyOnCreation: false,
        notifyOnEscalation: true,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  rent_dispute: {
    id: randomUUID(),
    caseType: "rent_dispute",
    displayName: "Rent Dispute",
    description: "Rent payment dispute handling",
    requirements: [
      {
        id: randomUUID(),
        order: 1,
        requirement: "Issue first arrears notice",
        daysAllowed: 7,
        workingDaysOnly: true,
        escalationAlerts: ["alert_72h"],
        notifyOnCreation: true,
        notifyOnEscalation: true,
      },
      {
        id: randomUUID(),
        order: 2,
        requirement: "Issue formal warning",
        daysAllowed: 14,
        workingDaysOnly: true,
        escalationAlerts: ["alert_5d"],
        notifyOnCreation: false,
        notifyOnEscalation: true,
      },
      {
        id: randomUUID(),
        order: 3,
        requirement: "Consider legal action",
        daysAllowed: 21,
        workingDaysOnly: true,
        escalationAlerts: ["alert_5d"],
        notifyOnCreation: false,
        notifyOnEscalation: true,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  legal_notice: {
    id: randomUUID(),
    caseType: "legal_notice",
    displayName: "Legal Notice",
    description: "Legal notice service tracking",
    requirements: [
      {
        id: randomUUID(),
        order: 1,
        requirement: "Serve notice to tenant",
        daysAllowed: 1,
        workingDaysOnly: false,
        escalationAlerts: [],
        notifyOnCreation: true,
        notifyOnEscalation: false,
      },
      {
        id: randomUUID(),
        order: 2,
        requirement: "Notice period expires",
        daysAllowed: 28,
        workingDaysOnly: false,
        escalationAlerts: ["alert_5d"],
        notifyOnCreation: false,
        notifyOnEscalation: true,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
}

/**
 * Get default legal timer configuration for a case type.
 * In future, these will be overridable by landlords via dashboard.
 */
export function getDefaultLegalTimerConfig(caseType: CaseType): LegalTimerConfiguration {
  return DEFAULT_CONFIGURATIONS[caseType] ?? DEFAULT_CONFIGURATIONS.maintenance_request
}

/**
 * Calculate working days (excluding weekends, optionally holidays)
 */
export function calculateDueDate(startDate: Date, workingDays: number, workingDaysOnly: boolean): Date {
  const due = new Date(startDate)

  if (!workingDaysOnly) {
    due.setDate(due.getDate() + workingDays)
    return due
  }

  let daysAdded = 0
  while (daysAdded < workingDays) {
    due.setDate(due.getDate() + 1)
    const dayOfWeek = due.getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Not Sunday (0) or Saturday (6)
      daysAdded++
    }
  }

  return due
}

/**
 * Check if a date is overdue and which escalation alerts apply
 */
export function getEscalationStatus(dueAt: string) {
  const due = new Date(dueAt)
  const now = new Date()
  const hoursOverdue = (now.getTime() - due.getTime()) / (1000 * 60 * 60)

  return {
    isOverdue: hoursOverdue > 0,
    hoursOverdue: Math.max(0, hoursOverdue),
    alert_24h: hoursOverdue > 24,
    alert_72h: hoursOverdue > 72,
    alert_5d: hoursOverdue > 120,
  }
}

/**
 * Create a property case from a trigger (tenant message, complaint, etc.)
 */
export async function createPropertyCase(
  user: AuthUser,
  propertyId: string,
  caseType: CaseType,
  title: string,
  description: string,
  tenancyId?: string,
) {
  if (!canManageProperties(user)) {
    throw new Error("Forbidden: must have property management permission")
  }

  const config = getDefaultLegalTimerConfig(caseType)
  const now = new Date()

  const stages = config.requirements.map((req) => ({
    id: randomUUID(),
    requirementId: req.id,
    requirement: req.requirement,
    daysAllowed: req.daysAllowed,
    workingDaysOnly: req.workingDaysOnly,
    startedAt: now.toISOString(),
    dueAt: calculateDueDate(now, req.daysAllowed, req.workingDaysOnly).toISOString(),
    completedAt: undefined,
    status: "pending" as const,
    escalations: [],
  }))

  const case_: PropertyCase = {
    id: randomUUID(),
    propertyId,
    tenancyId,
    caseType,
    title,
    description,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    createdBy: user.email,
    status: "open",
    stages,
    messageCount: 0,
    attachmentCount: 0,
    archived: false,
  }

  await writeAuditEvent({
    entityType: "property_case",
    entityId: case_.id,
    action: AUDIT_ACTION_TYPES.EXECUTED_BY_SYSTEM,
    fieldPath: "case_created",
    oldValue: null,
    newValue: case_,
    performedBy: user.email,
    metadata: {
      propertyId,
      caseType,
      tenancyId,
      requirementCount: stages.length,
    },
  })

  // Save to database
  const saved = await saveCaseToDb(case_)
  return saved
}

/**
 * Mark a case stage as completed
 */
export async function completeCaseStage(
  user: AuthUser,
  case_: PropertyCase,
  stageId: string,
  completionNotes?: string,
) {
  if (!canManageProperties(user)) {
    throw new Error("Forbidden: must have property management permission")
  }

  const stage = case_.stages.find((s) => s.id === stageId)
  if (!stage) {
    throw new Error("Stage not found")
  }

  // For damp cases, require inspection report
  if (case_.caseType === "damp") {
    const hasReport = case_.dampInspectionReports?.some((r) => r.stageId === stageId)
    if (!hasReport) {
      throw new Error("Damp case stages require an inspection report before completion")
    }
  }

  const now = new Date()
  stage.completedAt = now.toISOString()
  stage.status = "completed"

  case_.updatedAt = now.toISOString()

  // Check if all stages are complete
  const allComplete = case_.stages.every((s) => s.status === "completed" || s.status === "in_progress")
  if (allComplete) {
    case_.status = "resolved"
  }

  await writeAuditEvent({
    entityType: "property_case",
    entityId: case_.id,
    action: AUDIT_ACTION_TYPES.EXECUTED_BY_SYSTEM,
    fieldPath: `stages.${stageId}.completed`,
    oldValue: { status: "pending", completedAt: null },
    newValue: { status: "completed", completedAt: stage.completedAt },
    performedBy: user.email,
    metadata: {
      propertyId: case_.propertyId,
      caseType: case_.caseType,
      stageIndex: case_.stages.findIndex((s) => s.id === stageId),
      completionNotes,
      hasDampReport: !!case_.dampInspectionReports?.some((r) => r.stageId === stageId),
    },
  })

  // Save to database
  const saved = await saveCaseToDb(case_)
  return saved
}

/**
 * Archive a case (soft delete - nothing is ever truly deleted)
 */
export async function archivePropertyCase(user: AuthUser, case_: PropertyCase, reason: string) {
  if (!canManageProperties(user)) {
    throw new Error("Forbidden: must have property management permission")
  }

  const now = new Date()
  const wasArchived = case_.archived

  case_.archived = true
  case_.updatedAt = now.toISOString()

  await writeAuditEvent({
    entityType: "property_case",
    entityId: case_.id,
    action: AUDIT_ACTION_TYPES.EXECUTED_BY_SYSTEM,
    fieldPath: "archived",
    oldValue: { archived: wasArchived },
    newValue: { archived: true },
    performedBy: user.email,
    metadata: {
      propertyId: case_.propertyId,
      caseType: case_.caseType,
      reason,
    },
  })

  return case_
}

// ==================== DATABASE PERSISTENCE ====================

import { getCasesContainer } from "@/lib/server/cosmos"

/**
 * Save a property case to Cosmos DB
 */
export async function saveCaseToDb(case_: PropertyCase): Promise<PropertyCase> {
  const container = await getCasesContainer()
  const { resource } = await container.items.upsert({
    ...case_,
    id: case_.id,
    propertyId: case_.propertyId,
    tenancyId: case_.tenancyId || "",
  })
  return resource as unknown as PropertyCase
}

/**
 * Retrieve a single case by ID
 */
export async function getCaseById(caseId: string, propertyId: string): Promise<PropertyCase | null> {
  const container = await getCasesContainer()
  try {
    const { resource } = await container.item(caseId, propertyId).read<PropertyCase>()
    return (resource as unknown as PropertyCase) || null
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 404) {
      return null
    }
    throw error
  }
}

/**
 * List all cases for a property
 */
export async function getCasesByProperty(propertyId: string, includeArchived = false): Promise<PropertyCase[]> {
  const container = await getCasesContainer()
  const query = `
    SELECT * FROM c
    WHERE c.propertyId = @propertyId
    ${!includeArchived ? "AND c.archived = false" : ""}
    ORDER BY c.createdAt DESC
  `
  const { resources } = await container.items
    .query<PropertyCase>({
      query,
      parameters: [{ name: "@propertyId", value: propertyId }],
    })
    .fetchAll()
  return resources
}

/**
 * Find cases by type (e.g., all "damp" cases)
 */
export async function getCasesByType(propertyId: string, caseType: CaseType): Promise<PropertyCase[]> {
  const container = await getCasesContainer()
  const query = `
    SELECT * FROM c
    WHERE c.propertyId = @propertyId
    AND c.caseType = @caseType
    AND c.archived = false
    ORDER BY c.createdAt DESC
  `
  const { resources } = await container.items
    .query<PropertyCase>({
      query,
      parameters: [
        { name: "@propertyId", value: propertyId },
        { name: "@caseType", value: caseType },
      ],
    })
    .fetchAll()
  return resources
}

/**
 * List overdue cases (any stage that's overdue)
 */
export async function getOverdueCases(): Promise<PropertyCase[]> {
  const container = await getCasesContainer()
  const query = `
    SELECT * FROM c
    WHERE c.archived = false
    AND c.status != "resolved"
    ORDER BY c.createdAt DESC
  `
  const { resources } = await container.items.query<PropertyCase>({ query }).fetchAll()
  // Filter for overdue stages in-memory
  return resources.filter((c) => c.stages.some((s) => !s.completedAt && s.status === "overdue"))
}

/**
 * Update case in database (after completing stage or status change)
 */
export async function updateCaseInDb(case_: PropertyCase): Promise<PropertyCase> {
  return saveCaseToDb(case_)
}

/**
 * Delete/Archive case
 */
export async function archiveCaseInDb(caseId: string, propertyId: string): Promise<void> {
  const container = await getCasesContainer()
  const case_ = await getCaseById(caseId, propertyId)
  if (!case_) throw new Error(`Case ${caseId} not found`)
  case_.archived = true
  await saveCaseToDb(case_)
}

// ==================== CASE MESSAGES ====================

import { getCaseMessagesContainer } from "@/lib/server/cosmos"
import type { CaseMessage, CaseMessageRead } from "@/lib/types/case"

/**
 * Save a case message to Cosmos DB
 */
export async function saveCaseMessageToDb(message: CaseMessage): Promise<CaseMessage> {
  const container = await getCaseMessagesContainer()
  const { resource } = await container.items.upsert({
    ...message,
    id: message.id,
    caseId: message.caseId,
  })
  return resource as unknown as CaseMessage
}

/**
 * Get all messages for a case (sorted by newest first)
 */
export async function getCaseMessagesByCaseId(caseId: string): Promise<CaseMessage[]> {
  const container = await getCaseMessagesContainer()
  const query = `
    SELECT * FROM c
    WHERE c.caseId = @caseId
    ORDER BY c.createdAt DESC
  `
  const { resources } = await container.items
    .query<CaseMessage>({
      query,
      parameters: [{ name: "@caseId", value: caseId }],
    })
    .fetchAll()
  return resources
}

/**
 * Get a single message by ID
 */
export async function getCaseMessageById(messageId: string, caseId: string): Promise<CaseMessage | null> {
  const container = await getCaseMessagesContainer()
  try {
    const { resource } = await container.item(messageId, caseId).read<CaseMessage>()
    return (resource as unknown as CaseMessage) || null
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 404) {
      return null
    }
    throw error
  }
}

/**
 * Mark a message as read by a user
 */
export async function markCaseMessageAsRead(message: CaseMessage, userEmail: string): Promise<CaseMessage> {
  const alreadyRead = message.readBy.some((r) => r.email === userEmail)
  if (!alreadyRead) {
    message.readBy.push({
      email: userEmail,
      readAt: new Date().toISOString(),
    })
  }
  return saveCaseMessageToDb(message)
}

/**
 * Get unread message count for a user in a case
 */
export async function getUnreadMessageCount(caseId: string, userEmail: string): Promise<number> {
  const messages = await getCaseMessagesByCaseId(caseId)
  return messages.filter((m) => !m.readBy.some((r) => r.email === userEmail)).length
}

// ==================== ESCALATION NOTIFICATIONS ====================

/**
 * Get cases with overdue stages that need escalation notification
 */
export async function getEscalationNotificationCandidates(): Promise<
  Array<{
    case_: PropertyCase
    propertyId: string
    stageId: string
    escalationLevel: "alert_24h" | "alert_72h" | "alert_5d"
  }>
> {
  const allCases = await getAllCases()
  const candidates: Array<{
    case_: PropertyCase
    propertyId: string
    stageId: string
    escalationLevel: "alert_24h" | "alert_72h" | "alert_5d"
  }> = []

  allCases.forEach((case_) => {
    case_.stages.forEach((stage) => {
      if (stage.completedAt || stage.status === "completed") return

      const escalationStatus = getEscalationStatus(stage.dueAt)

      // Check each escalation threshold
      if (escalationStatus.alert_24h && !stage.escalations.some((e) => e.level === "alert_24h" && e.notified)) {
        candidates.push({
          case_,
          propertyId: case_.propertyId,
          stageId: stage.id,
          escalationLevel: "alert_24h",
        })
      }

      if (escalationStatus.alert_72h && !stage.escalations.some((e) => e.level === "alert_72h" && e.notified)) {
        candidates.push({
          case_,
          propertyId: case_.propertyId,
          stageId: stage.id,
          escalationLevel: "alert_72h",
        })
      }

      if (escalationStatus.alert_5d && !stage.escalations.some((e) => e.level === "alert_5d" && e.notified)) {
        candidates.push({
          case_,
          propertyId: case_.propertyId,
          stageId: stage.id,
          escalationLevel: "alert_5d",
        })
      }
    })
  })

  return candidates
}

/**
 * Mark escalation as notified
 */
export async function markEscalationAsNotified(
  case_: PropertyCase,
  stageId: string,
  escalationLevel: "alert_24h" | "alert_72h" | "alert_5d",
): Promise<PropertyCase> {
  const stage = case_.stages.find((s) => s.id === stageId)
  if (!stage) throw new Error(`Stage ${stageId} not found in case ${case_.id}`)

  let escalation = stage.escalations.find((e) => e.level === escalationLevel)
  if (!escalation) {
    escalation = {
      level: escalationLevel,
      triggeredAt: new Date().toISOString(),
      notified: true,
    }
    stage.escalations.push(escalation)
  } else {
    escalation.notified = true
  }

  case_.updatedAt = new Date().toISOString()
  return saveCaseToDb(case_)
}

/**
 * Get all active cases (not archived, not resolved)
 */
async function getAllCases(): Promise<PropertyCase[]> {
  const container = await getCasesContainer()
  const query = `
    SELECT * FROM c
    WHERE c.archived = false
    AND c.status != "resolved"
    ORDER BY c.createdAt DESC
  `
  const { resources } = await container.items.query<PropertyCase>({ query }).fetchAll()
  return resources
}

// ==================== CONTRACTOR INVITES ====================

import type { ContractorInvite, ContractorInviteRole } from "@/lib/types/case"

/**
 * Save a contractor invite to Cosmos DB
 */
export async function saveContractorInviteToDb(invite: ContractorInvite): Promise<ContractorInvite> {
  const container = await getCasesContainer()
  const { resource } = await container.items.upsert({
    ...invite,
    id: invite.id,
    caseId: invite.caseId,
    type: "contractor_invite",
  })
  return resource as unknown as ContractorInvite
}

/**
 * Get all invites for a case
 */
export async function getContractorInvitesByCaseId(caseId: string): Promise<ContractorInvite[]> {
  const container = await getCasesContainer()
  const query = `
    SELECT * FROM c
    WHERE c.caseId = @caseId
    AND c.type = "contractor_invite"
    ORDER BY c.invitedAt DESC
  `
  const { resources } = await container.items
    .query<ContractorInvite>({
      query,
      parameters: [{ name: "@caseId", value: caseId }],
    })
    .fetchAll()
  return resources
}

/**
 * Get a single invite by ID
 */
export async function getContractorInviteById(inviteId: string, caseId: string): Promise<ContractorInvite | null> {
  const container = await getCasesContainer()
  try {
    const { resource } = await container.item(inviteId, caseId).read<ContractorInvite>()
    return (resource as unknown as ContractorInvite) || null
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 404) {
      return null
    }
    throw error
  }
}

/**
 * Get all active invites for a user across all cases (for accept/view)
 */
export async function getActiveInvitesForEmail(email: string): Promise<ContractorInvite[]> {
  const container = await getCasesContainer()
  const query = `
    SELECT * FROM c
    WHERE c.invitedEmail = @email
    AND c.type = "contractor_invite"
    AND c.status IN ("pending", "accepted")
    AND c.expiresAt > @now
    ORDER BY c.invitedAt DESC
  `
  const { resources } = await container.items
    .query<ContractorInvite>({
      query,
      parameters: [
        { name: "@email", value: email },
        { name: "@now", value: new Date().toISOString() },
      ],
    })
    .fetchAll()
  return resources
}

/**
 * Create and send a contractor invite
 */
export async function createContractorInvite(
  caseId: string,
  propertyId: string,
  invitedEmail: string,
  invitedName: string,
  role: ContractorInviteRole,
  invitedBy: string,
): Promise<ContractorInvite> {
  const invite: ContractorInvite = {
    id: randomUUID(),
    caseId,
    propertyId,
    invitedEmail,
    invitedName,
    role,
    status: "pending",
    invitedAt: new Date().toISOString(),
    invitedBy,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
  }

  return saveContractorInviteToDb(invite)
}

/**
 * Accept a contractor invite
 */
export async function acceptContractorInvite(invite: ContractorInvite): Promise<ContractorInvite> {
  invite.status = "accepted"
  invite.acceptedAt = new Date().toISOString()
  return saveContractorInviteToDb(invite)
}

/**
 * Decline/revoke a contractor invite
 */
export async function declineContractorInvite(invite: ContractorInvite): Promise<ContractorInvite> {
  invite.status = "declined"
  return saveContractorInviteToDb(invite)
}

// ==================== CASE ATTACHMENTS ====================

import type { CaseAttachment } from "@/lib/types/case"

/**
 * Save attachment metadata to Cosmos DB
 */
export async function saveCaseAttachmentToDb(attachment: CaseAttachment): Promise<CaseAttachment> {
  const container = await getCasesContainer()
  const { resource } = await container.items.upsert({
    ...attachment,
    id: attachment.id,
    caseId: attachment.id.split("-")[0], // Extract caseId from attachment ID for querying
    type: "attachment",
  })
  return resource as unknown as CaseAttachment
}

/**
 * Get all attachments for a case
 */
export async function getCaseAttachmentsByCaseId(caseId: string): Promise<CaseAttachment[]> {
  const container = await getCasesContainer()
  const query = `
    SELECT * FROM c
    WHERE c.caseId = @caseId
    AND c.type = "attachment"
    ORDER BY c.uploadedAt DESC
  `
  const { resources } = await container.items
    .query<CaseAttachment>({
      query,
      parameters: [{ name: "@caseId", value: caseId }],
    })
    .fetchAll()
  return resources
}

/**
 * Get a single attachment by ID
 */
export async function getCaseAttachmentById(attachmentId: string, caseId: string): Promise<CaseAttachment | null> {
  const container = await getCasesContainer()
  try {
    const { resource } = await container.item(attachmentId, caseId).read<CaseAttachment>()
    return (resource as unknown as CaseAttachment) || null
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 404) {
      return null
    }
    throw error
  }
}

/**
 * Mark attachment as deleted (soft delete)
 */
export async function deleteCaseAttachmentMetadata(attachment: CaseAttachment): Promise<void> {
  const container = await getCasesContainer()
  // Create a deleted marker instead of full deletion
  await container.items.create({
    id: attachment.id + "-deleted",
    caseId: attachment.id.split("-")[0],
    type: "attachment-deleted",
    originalId: attachment.id,
    deletedAt: new Date().toISOString(),
  })
}
