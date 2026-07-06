import {
  BlobServiceClient,
  ContainerClient,
} from "@azure/storage-blob"
import type { WebhookEvent, WebhookEventType, AdvisoryNotification } from "@/lib/auth"
import { randomUUID } from "crypto"

const blobConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
const cosmosEndpoint = process.env.COSMOS_ENDPOINT
const cosmosKey = process.env.COSMOS_KEY

// In-memory storage for webhooks (in production, use Cosmos DB)
const webhookStore: Map<string, WebhookEvent> = new Map()
const advisoryNotificationStore: Map<string, AdvisoryNotification> = new Map()

/**
 * Create and track a webhook event for delivery
 */
export async function createWebhookEvent(input: {
  caseId: string
  propertyId: string
  eventType: WebhookEventType
  payload: Record<string, unknown>
}): Promise<WebhookEvent> {
  const webhookEvent: WebhookEvent = {
    id: randomUUID(),
    caseId: input.caseId,
    propertyId: input.propertyId,
    eventType: input.eventType,
    payload: input.payload,
    status: "pending",
    createdAt: new Date().toISOString(),
    deliveryAttempts: [],
    nextRetryAt: new Date().toISOString(),
    maxRetries: 5,
  }

  webhookStore.set(webhookEvent.id, webhookEvent)
  return webhookEvent
}

/**
 * Record a delivery attempt for a webhook event
 */
export async function recordWebhookDeliveryAttempt(
  webhookId: string,
  result: {
    statusCode?: number
    responseBody?: string
    error?: string
  }
): Promise<WebhookEvent | null> {
  const webhook = webhookStore.get(webhookId)
  if (!webhook) return null

  const attempt = {
    attemptNumber: webhook.deliveryAttempts.length + 1,
    attemptedAt: new Date().toISOString(),
    ...result,
  }

  webhook.deliveryAttempts.push(attempt)

  // Determine if successful
  if (result.statusCode && result.statusCode >= 200 && result.statusCode < 300) {
    webhook.status = "delivered"
  } else if (webhook.deliveryAttempts.length >= webhook.maxRetries) {
    webhook.status = "failed"
  } else {
    webhook.status = "retrying"
    // Exponential backoff: 5m, 15m, 1h, 4h, 24h
    const backoffMinutes = [5, 15, 60, 240, 1440]
    const backoffMs =
      backoffMinutes[Math.min(attempt.attemptNumber - 1, 4)] * 60 * 1000
    webhook.nextRetryAt = new Date(
      new Date().getTime() + backoffMs
    ).toISOString()
  }

  webhookStore.set(webhookId, webhook)
  return webhook
}

/**
 * Get webhook event by ID
 */
export async function getWebhookEvent(webhookId: string): Promise<WebhookEvent | null> {
  return webhookStore.get(webhookId) || null
}

/**
 * Get all webhook events for a case
 */
export async function getWebhookEventsByCaseId(caseId: string): Promise<WebhookEvent[]> {
  return Array.from(webhookStore.values()).filter((w) => w.caseId === caseId)
}

/**
 * Get webhook events pending delivery
 */
export async function getPendingWebhookEvents(): Promise<WebhookEvent[]> {
  const now = new Date()
  return Array.from(webhookStore.values()).filter(
    (w) =>
      (w.status === "pending" || w.status === "retrying") &&
      (!w.nextRetryAt || new Date(w.nextRetryAt) <= now)
  )
}

/**
 * Create advisory notification on case creation
 */
export async function createAdvisoryNotification(input: {
  caseId: string
  propertyId: string
  caseType: string
}): Promise<AdvisoryNotification> {
  const notification: AdvisoryNotification = {
    id: randomUUID(),
    caseId: input.caseId,
    propertyId: input.propertyId,
    caseType: input.caseType as any,
    status: "pending",
    deliveryAttempts: 0,
    nextRetryAt: new Date().toISOString(),
  }

  advisoryNotificationStore.set(notification.id, notification)
  return notification
}

/**
 * Record successful advisory notification delivery
 */
export async function markAdvisoryNotificationSent(
  notificationId: string
): Promise<AdvisoryNotification | null> {
  const notification = advisoryNotificationStore.get(notificationId)
  if (!notification) return null

  notification.status = "sent"
  notification.sentAt = new Date().toISOString()

  advisoryNotificationStore.set(notificationId, notification)
  return notification
}

/**
 * Record advisory notification delivery failure
 */
export async function recordAdvisoryNotificationFailure(
  notificationId: string,
  reason: string
): Promise<AdvisoryNotification | null> {
  const notification = advisoryNotificationStore.get(notificationId)
  if (!notification) return null

  notification.deliveryAttempts++
  notification.failureReason = reason

  if (notification.deliveryAttempts >= 5) {
    notification.status = "failed"
  } else {
    // Retry in 5 minutes
    notification.nextRetryAt = new Date(
      new Date().getTime() + 5 * 60 * 1000
    ).toISOString()
  }

  advisoryNotificationStore.set(notificationId, notification)
  return notification
}

/**
 * Get advisory notifications pending delivery
 */
export async function getPendingAdvisoryNotifications(): Promise<AdvisoryNotification[]> {
  const now = new Date()
  return Array.from(advisoryNotificationStore.values()).filter(
    (n) =>
      n.status === "pending" &&
      (!n.nextRetryAt || new Date(n.nextRetryAt) <= now)
  )
}

/**
 * Get advisor bureau email list
 */
export function getAdvisoryBureauEmails(): string[] {
  const emails = process.env.ADVISORY_BUREAU_EMAILS
  if (!emails) {
    console.warn("ADVISORY_BUREAU_EMAILS environment variable not set")
    return []
  }
  return emails.split(",").map((e) => e.trim())
}

/**
 * Send advisory notification email
 */
export async function sendAdvisoryNotificationEmail(
  notification: AdvisoryNotification,
  advisoryBureauEmail: string
): Promise<boolean> {
  try {
    // In production, call email service (Nodemailer, SendGrid, etc.)
    console.log(
      `Sending advisory notification for case ${notification.caseId} to ${advisoryBureauEmail}`
    )

    // Simulate successful send
    await markAdvisoryNotificationSent(notification.id)
    return true
  } catch (error) {
    console.error("Failed to send advisory notification:", error)
    await recordAdvisoryNotificationFailure(
      notification.id,
      error instanceof Error ? error.message : "Unknown error"
    )
    return false
  }
}

/**
 * Get webhook delivery statistics
 */
export async function getWebhookDeliveryStats(): Promise<{
  total: number
  delivered: number
  failed: number
  pending: number
  retrying: number
  avgAttemptsPerEvent: number
}> {
  const events = Array.from(webhookStore.values())
  const total = events.length
  const delivered = events.filter((e) => e.status === "delivered").length
  const failed = events.filter((e) => e.status === "failed").length
  const pending = events.filter((e) => e.status === "pending").length
  const retrying = events.filter((e) => e.status === "retrying").length

  const totalAttempts = events.reduce(
    (sum, e) => sum + e.deliveryAttempts.length,
    0
  )
  const avgAttemptsPerEvent =
    total > 0 ? Math.round((totalAttempts / total) * 100) / 100 : 0

  return {
    total,
    delivered,
    failed,
    pending,
    retrying,
    avgAttemptsPerEvent,
  }
}

/**
 * Process pending webhooks and advisory notifications
 * Call periodically (every minute) to handle delivery
 */
export async function processPendingDeliveries(): Promise<{
  webhooksProcessed: number
  advisoriesProcessed: number
  successCount: number
  failureCount: number
}> {
  let webhooksProcessed = 0
  let advisoriesProcessed = 0
  let successCount = 0
  let failureCount = 0

  // Process pending webhooks
  const pendingWebhooks = await getPendingWebhookEvents()
  for (const webhook of pendingWebhooks) {
    webhooksProcessed++
    try {
      // In production, make actual HTTP request to webhook endpoint
      // For now, simulate success for delivered status demo
      if (webhook.deliveryAttempts.length === 0) {
        await recordWebhookDeliveryAttempt(webhook.id, {
          statusCode: 200,
          responseBody: "OK",
        })
        successCount++
      }
    } catch (error) {
      failureCount++
      await recordWebhookDeliveryAttempt(webhook.id, {
        statusCode: 500,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Process pending advisory notifications
  const pendingAdvisories = await getPendingAdvisoryNotifications()
  const advisoryEmails = getAdvisoryBureauEmails()

  for (const advisory of pendingAdvisories) {
    for (const email of advisoryEmails) {
      advisoriesProcessed++
      const success = await sendAdvisoryNotificationEmail(advisory, email)
      if (success) {
        successCount++
      } else {
        failureCount++
      }
    }
  }

  return {
    webhooksProcessed,
    advisoriesProcessed,
    successCount,
    failureCount,
  }
}
