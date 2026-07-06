"use client"

import { useState, useEffect } from "react"
import type { WebhookEvent } from "@/lib/auth"

type WebhookStatusWidgetProps = {
  caseId: string
  propertyId: string
}

export default function WebhookStatusWidget({
  caseId,
  propertyId,
}: WebhookStatusWidgetProps) {
  const [webhooks, setWebhooks] = useState<WebhookEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadWebhooks()
  }, [caseId])

  const loadWebhooks = async () => {
    try {
      const response = await fetch(
        `/api/properties/${propertyId}/cases/${caseId}/webhooks`
      )
      if (response.ok) {
        const data = await response.json()
        setWebhooks(data)
        setError(null)
      } else {
        setError("Failed to load webhook status")
      }
    } catch (err) {
      console.error("Error loading webhooks:", err)
      setError("Error loading webhook status")
    } finally {
      setLoading(false)
    }
  }

  function getStatusIcon(status: string): string {
    switch (status) {
      case "delivered":
        return "✅"
      case "failed":
        return "❌"
      case "retrying":
        return "🔄"
      case "pending":
        return "⏳"
      default:
        return "❓"
    }
  }

  function getEventIcon(eventType: string): string {
    switch (eventType) {
      case "case_created":
        return "📋"
      case "case_updated":
        return "✏️"
      case "case_resolved":
        return "✅"
      case "stage_completed":
        return "🎯"
      case "escalation_triggered":
        return "🚨"
      case "message_added":
        return "💬"
      case "attachment_uploaded":
        return "📎"
      case "contractor_invited":
        return "👤"
      default:
        return "📌"
    }
  }

  if (loading) {
    return <div className="text-center py-6 text-gray-600">Loading webhook status...</div>
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">🔗 Webhook Events</h3>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {webhooks.length === 0 ? (
        <p className="text-gray-600 text-center py-8">No webhook events yet.</p>
      ) : (
        <div className="space-y-3">
          {webhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
            >
              <div className="text-2xl">{getEventIcon(webhook.eventType)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 capitalize">
                    {webhook.eventType.replace(/_/g, " ")}
                  </span>
                  <span className="text-xl">{getStatusIcon(webhook.status)}</span>
                  <span className="text-xs font-medium px-2 py-1 rounded bg-gray-200 text-gray-700 capitalize" aria-label={`Webhook status: ${webhook.status}`} title={`Delivery status: ${webhook.status}`}>
                    {webhook.status}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Created: {new Date(webhook.createdAt).toLocaleString("en-GB")}
                </p>
                <p className="text-xs text-gray-600">
                  Attempts: {webhook.deliveryAttempts.length} / {webhook.maxRetries}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900">
        <span className="font-semibold">ℹ️ Info:</span> Webhooks track all case events
        (creation, updates, messages, etc.) for external system integration and audit
        trail.
      </div>
    </div>
  )
}
