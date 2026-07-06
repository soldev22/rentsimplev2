import { Anthropic } from "@anthropic-ai/sdk"
import type {
  AnalyticsMetrics,
  CaseAnalytics,
  ContractorPerformanceMetric,
  TimeSeriesDataPoint,
  ThreadSummary,
  CaseType,
  CaseStatus,
  EscalationLevel,
} from "@/lib/auth"
import { getCasesContainer, getCaseMessagesContainer } from "./cosmos"
import { randomUUID } from "crypto"

const client = new Anthropic()

export async function generateThreadSummary(
  caseId: string,
  propertyId: string
): Promise<ThreadSummary> {
  const messageContainer = await getCaseMessagesContainer()

  // Fetch all messages for case
  const messages = await messageContainer.items
    .query({
      query: "SELECT * FROM c WHERE c.caseId = @caseId ORDER BY c.createdAt ASC",
      parameters: [{ name: "@caseId", value: caseId }],
    })
    .fetchAll()

  if (messages.resources.length === 0) {
    throw new Error("No messages found for case")
  }

  // Build thread content for Claude
  const threadContent = messages.resources
    .map(
      (m) =>
        `[${new Date(m.createdAt).toLocaleTimeString()}] ${m.senderName} (${m.senderRole}):\n${m.content}`
    )
    .join("\n\n")

  // Call Claude API to generate summary
  const response = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `Please provide a concise summary of this property case discussion thread. Focus on key issues, actions taken, and current status. Keep it under 200 words.\n\nThread:\n${threadContent}`,
      },
    ],
  })

  const summary =
    response.content[0].type === "text"
      ? response.content[0].text
      : "Unable to generate summary"

  const threadSummary: ThreadSummary = {
    id: randomUUID(),
    caseId,
    summary,
    messageCount: messages.resources.length,
    generatedAt: new Date().toISOString(),
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    isStale: false,
  }

  return threadSummary
}

export async function calculateCaseAnalytics(
  cases: Array<{
    id: string
    propertyId: string
    caseType: CaseType
    createdAt: string
    updatedAt: string
    status: CaseStatus
    stages: Array<{ status: string; completedAt?: string }>
    messageCount: number
    attachmentCount: number
  }>,
  contractorsByCase: Record<string, number>,
  escalationsByCase: Record<string, { count: number; levels: EscalationLevel[] }>
): Promise<CaseAnalytics[]> {
  return cases.map((c) => {
    const completedStages = c.stages.filter((s) => s.status === "completed")
    const firstIncompleteStage = c.stages.find((s) => s.status !== "completed")

    let daysToResolve: number | undefined
    let resolvedAt: string | undefined

    if (c.status === "resolved" && completedStages.length > 0) {
      const lastCompletedStage = completedStages[completedStages.length - 1]
      if (lastCompletedStage.completedAt) {
        resolvedAt = lastCompletedStage.completedAt
        daysToResolve = Math.floor(
          (new Date(resolvedAt).getTime() - new Date(c.createdAt).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      }
    }

    return {
      caseId: c.id,
      propertyId: c.propertyId,
      caseType: c.caseType,
      createdAt: c.createdAt,
      resolvedAt,
      daysToResolve,
      messageCount: c.messageCount,
      attachmentCount: c.attachmentCount,
      contractorsInvolved: contractorsByCase[c.id] || 0,
      escalationCount: escalationsByCase[c.id]?.count || 0,
      escalationLevels: escalationsByCase[c.id]?.levels || [],
      currentStatus: c.status,
    }
  })
}

export async function aggregateAnalyticsMetrics(
  caseAnalytics: CaseAnalytics[]
): Promise<AnalyticsMetrics> {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Count by type and status
  const casesByType: Record<CaseType, number> = {} as Record<CaseType, number>
  const casesByStatus: Record<CaseStatus, number> = {} as Record<CaseStatus, number>
  const timeSeriesData: Record<string, TimeSeriesDataPoint> = {}

  let resolvedCount = 0
  let totalResolutionDays = 0
  let overdueCases = 0
  let totalMessageCount = 0
  let totalAttachmentCount = 0

  for (const c of caseAnalytics) {
    // Count by type
    casesByType[c.caseType] = (casesByType[c.caseType] || 0) + 1

    // Count by status
    casesByStatus[c.currentStatus] = (casesByStatus[c.currentStatus] || 0) + 1

    // Resolution stats
    if (c.currentStatus === "resolved" && c.daysToResolve) {
      resolvedCount++
      totalResolutionDays += c.daysToResolve
    }

    // Overdue check
    if (c.currentStatus !== "resolved" && c.currentStatus !== "archived") {
      const createdDate = new Date(c.createdAt)
      const daysSinceCreation = Math.floor(
        (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysSinceCreation > 30) {
        overdueCases++
      }
    }

    // Message and attachment totals
    totalMessageCount += c.messageCount
    totalAttachmentCount += c.attachmentCount

    // Time series
    const dateKey = c.createdAt.split("T")[0]
    if (!timeSeriesData[dateKey]) {
      timeSeriesData[dateKey] = {
        date: dateKey,
        createdCount: 0,
        resolvedCount: 0,
        escalationCount: 0,
      }
    }
    timeSeriesData[dateKey].createdCount++

    if (c.resolvedAt) {
      const resolvedDateKey = c.resolvedAt.split("T")[0]
      if (!timeSeriesData[resolvedDateKey]) {
        timeSeriesData[resolvedDateKey] = {
          date: resolvedDateKey,
          createdCount: 0,
          resolvedCount: 0,
          escalationCount: 0,
        }
      }
      timeSeriesData[resolvedDateKey].resolvedCount++
    }

    timeSeriesData[dateKey].escalationCount += c.escalationCount
  }

  // Convert time series to array and sort
  const timeSeriesArray = Object.values(timeSeriesData).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  // Calculate SLA compliance (cases resolved within 30 days)
  const resolvedWithinSla = caseAnalytics.filter(
    (c) => c.currentStatus === "resolved" && c.daysToResolve! <= 30
  ).length
  const slaComplianceRate =
    resolvedCount > 0 ? (resolvedWithinSla / resolvedCount) * 100 : 0

  return {
    totalCases: caseAnalytics.length,
    resolvedCases: resolvedCount,
    averageResolutionDays:
      resolvedCount > 0 ? Math.round(totalResolutionDays / resolvedCount) : 0,
    casesByType,
    casesByStatus,
    slaComplianceRate: Math.round(slaComplianceRate * 10) / 10,
    contractorPerformance: [], // Will be populated separately
    timeSeriesData: timeSeriesArray,
    overdueCases,
    averageMessageCount:
      caseAnalytics.length > 0
        ? Math.round(
            (totalMessageCount / caseAnalytics.length) * 10
          ) / 10
        : 0,
    averageAttachmentCount:
      caseAnalytics.length > 0
        ? Math.round(
            (totalAttachmentCount / caseAnalytics.length) * 10
          ) / 10
        : 0,
  }
}

export async function getPropertyAnalytics(
  propertyId: string
): Promise<AnalyticsMetrics> {
  const casesContainer = await getCasesContainer()

  // Fetch all cases for property
  const result = await casesContainer.items
    .query({
      query: "SELECT * FROM c WHERE c.propertyId = @propertyId",
      parameters: [{ name: "@propertyId", value: propertyId }],
    })
    .fetchAll()

  const cases = result.resources

  // Count contractors per case (simplified - would need to query invites separately in production)
  const contractorsByCase: Record<string, number> = {}
  const escalationsByCase: Record<string, { count: number; levels: EscalationLevel[] }> = {}

  for (const c of cases) {
    const escalationCount = c.stages.reduce(
      (sum: number, s: any) => sum + (s.escalations?.length || 0),
      0
    )
    const escalationLevels = Array.from(
      new Set(
        c.stages.flatMap(
          (s: any) =>
            s.escalations?.map((e: any) => e.level) || []
        )
      )
    ) as EscalationLevel[]

    escalationsByCase[c.id] = {
      count: escalationCount,
      levels: escalationLevels,
    }
    contractorsByCase[c.id] = 0 // Would be populated from contractor invites
  }

  // Calculate case analytics
  const caseAnalytics = await calculateCaseAnalytics(
    cases,
    contractorsByCase,
    escalationsByCase
  )

  // Aggregate metrics
  const metrics = await aggregateAnalyticsMetrics(caseAnalytics)

  return metrics
}

export async function getPortfolioAnalytics(
  propertyIds: string[]
): Promise<AnalyticsMetrics> {
  const casesContainer = await getCasesContainer()

  // Fetch all cases across properties
  const query = propertyIds
    .map((_, i) => `c.propertyId = @propertyId${i}`)
    .join(" OR ")

  const parameters = propertyIds.map((id, i) => ({
    name: `@propertyId${i}`,
    value: id,
  }))

  const result = await casesContainer.items
    .query({
      query: `SELECT * FROM c WHERE ${query}`,
      parameters,
    })
    .fetchAll()

  const cases = result.resources

  // Same as property analytics but across multiple properties
  const contractorsByCase: Record<string, number> = {}
  const escalationsByCase: Record<string, { count: number; levels: EscalationLevel[] }> = {}

  for (const c of cases) {
    const escalationCount = c.stages.reduce(
      (sum: number, s: any) => sum + (s.escalations?.length || 0),
      0
    )
    const escalationLevels = Array.from(
      new Set(
        c.stages.flatMap(
          (s: any) =>
            s.escalations?.map((e: any) => e.level) || []
        )
      )
    ) as EscalationLevel[]

    escalationsByCase[c.id] = {
      count: escalationCount,
      levels: escalationLevels,
    }
    contractorsByCase[c.id] = 0
  }

  const caseAnalytics = await calculateCaseAnalytics(
    cases,
    contractorsByCase,
    escalationsByCase
  )

  return aggregateAnalyticsMetrics(caseAnalytics)
}
