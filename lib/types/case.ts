export type CaseType = "damp" | "flood" | "maintenance_request" | "complaint" | "rent_dispute" | "legal_notice"

export type CaseStatus = "open" | "investigating" | "in_repair" | "resolved" | "archived"

export type StageStatus = "pending" | "in_progress" | "completed" | "overdue"

export type EscalationLevel = "alert_24h" | "alert_72h" | "alert_5d"

export type CaseMessageSenderRole = "tenant" | "landlord" | "contractor" | "advisor" | "system"

export type LegalTimerRequirement = {
  id: string
  order: number
  requirement: string
  daysAllowed: number
  workingDaysOnly: boolean
  escalationAlerts: EscalationLevel[]
  notifyOnCreation: boolean
  notifyOnEscalation: boolean
}

export type LegalTimerConfiguration = {
  id: string
  caseType: CaseType
  displayName: string
  description: string
  requirements: LegalTimerRequirement[]
  createdAt: string
  updatedAt: string
}

export type EscalationEvent = {
  level: EscalationLevel
  triggeredAt: string
  notified: boolean
}

export type CaseStage = {
  id: string
  requirementId: string
  requirement: string
  daysAllowed: number
  workingDaysOnly: boolean
  startedAt: string
  dueAt: string
  completedAt?: string
  status: StageStatus
  escalations: EscalationEvent[]
}

export type CaseAttachment = {
  id: string
  fileName: string
  fileType: string
  url: string
  uploadedAt: string
  uploadedBy: string
  size: number
}

export type CaseMessageRead = {
  email: string
  readAt: string
}

export type CaseMessage = {
  id: string
  caseId: string
  senderRole: CaseMessageSenderRole
  senderEmail: string
  senderName: string
  content: string
  attachmentIds: string[]
  readBy: CaseMessageRead[]
  createdAt: string
}

export type PropertyCase = {
  id: string
  propertyId: string
  tenancyId?: string
  caseType: CaseType
  title: string
  description: string
  createdAt: string
  updatedAt: string
  createdBy: string
  status: CaseStatus
  stages: CaseStage[]
  messageCount: number
  attachmentCount: number
  archived: boolean
  lastMessageAt?: string
}

export type ContractorInviteRole = "contractor" | "advisor"

export type ContractorInvite = {
  id: string
  caseId: string
  propertyId: string
  invitedEmail: string
  invitedName: string
  role: ContractorInviteRole
  status: "pending" | "accepted" | "declined"
  invitedAt: string
  acceptedAt?: string
  invitedBy: string
  inviteUrl?: string
  expiresAt: string
}

// Phase 4: Analytics & AI Features

export type ThreadSummary = {
  id: string
  caseId: string
  summary: string
  messageCount: number
  generatedAt: string
  tokensUsed: number
  isStale: boolean
}

export type CaseAnalytics = {
  caseId: string
  propertyId: string
  caseType: CaseType
  createdAt: string
  resolvedAt?: string
  daysToResolve?: number
  messageCount: number
  attachmentCount: number
  contractorsInvolved: number
  escalationCount: number
  escalationLevels: EscalationLevel[]
  currentStatus: CaseStatus
}

export type AnalyticsMetrics = {
  totalCases: number
  resolvedCases: number
  averageResolutionDays: number
  casesByType: Record<CaseType, number>
  casesByStatus: Record<CaseStatus, number>
  slaComplianceRate: number
  contractorPerformance: ContractorPerformanceMetric[]
  timeSeriesData: TimeSeriesDataPoint[]
  overdueCases: number
  averageMessageCount: number
  averageAttachmentCount: number
}

export type ContractorPerformanceMetric = {
  email: string
  name: string
  casesInvolved: number
  averageResponseTime: number
  completionRate: number
  averageRating: number
}

export type TimeSeriesDataPoint = {
  date: string
  createdCount: number
  resolvedCount: number
  escalationCount: number
}

export type AdvisoryNotification = {
  id: string
  caseId: string
  propertyId: string
  caseType: CaseType
  status: "pending" | "sent" | "failed"
  sentAt?: string
  failureReason?: string
  deliveryAttempts: number
  nextRetryAt?: string
}

export type WebhookEventType = 
  | "case_created"
  | "case_updated"
  | "case_resolved"
  | "stage_completed"
  | "escalation_triggered"
  | "message_added"
  | "attachment_uploaded"
  | "contractor_invited"

export type WebhookDeliveryAttempt = {
  attemptNumber: number
  attemptedAt: string
  statusCode?: number
  responseBody?: string
  error?: string
}

export type WebhookEvent = {
  id: string
  caseId: string
  propertyId: string
  eventType: WebhookEventType
  payload: Record<string, unknown>
  status: "pending" | "delivered" | "failed" | "retrying"
  createdAt: string
  deliveryAttempts: WebhookDeliveryAttempt[]
  nextRetryAt?: string
  maxRetries: number
}
