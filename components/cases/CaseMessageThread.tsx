"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { CaseMessage } from "@/lib/auth"

type CaseMessageThreadProps = {
  caseId: string
  propertyId: string
  currentUserEmail: string
  onMessageAdded?: () => void
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getSenderBadgeColor(role: string): string {
  switch (role) {
    case "landlord":
      return "bg-blue-100 text-blue-800"
    case "tenant":
      return "bg-green-100 text-green-800"
    case "contractor":
      return "bg-orange-100 text-orange-800"
    case "advisor":
      return "bg-purple-100 text-purple-800"
    case "system":
      return "bg-gray-100 text-gray-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

export default function CaseMessageThread({
  caseId,
  propertyId,
  currentUserEmail,
  onMessageAdded,
}: CaseMessageThreadProps) {
  const [messages, setMessages] = useState<CaseMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadMessages = useCallback(async () => {
    try {
      const response = await fetch(`/api/properties/${propertyId}/cases/${caseId}/messages`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data)
        setError(null)
      } else {
        setError("Failed to load messages")
      }
    } catch (err) {
      console.error("Error loading messages:", err)
      setError("Error loading messages")
    } finally {
      setLoading(false)
    }
  }, [propertyId, caseId])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/properties/${propertyId}/cases/${caseId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newMessage,
          senderRole: "landlord",
          attachmentIds: [],
        }),
      })

      if (response.ok) {
        setNewMessage("")
        await loadMessages()
        onMessageAdded?.()
      } else {
        setError("Failed to send message")
      }
    } catch (err) {
      console.error("Error sending message:", err)
      setError("Error sending message")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const response = await fetch(`/api/properties/${propertyId}/cases/${caseId}/messages/${messageId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        await loadMessages()
      } else {
        setError("Failed to delete message")
      }
    } catch (err) {
      console.error("Error deleting message:", err)
      setError("Error deleting message")
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading messages...</div>
  }

  return (
    <div className="space-y-6">
      {/* Messages */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Case Discussion</h3>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">{error}</div>}

        <div className="space-y-4 max-h-96 overflow-y-auto mb-6">
          {messages.length === 0 ? (
            <p className="text-gray-600 text-center py-8">No messages yet. Start the conversation.</p>
          ) : (
            messages.map((message) => {
              const isOwn = message.senderEmail === currentUserEmail
              const isRead = message.readBy.some((r) => r.email === currentUserEmail)

              return (
                <div key={message.id} className={`p-4 rounded-lg border ${isOwn ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSenderBadgeColor(message.senderRole)}`}>
                        {message.senderRole}
                      </span>
                      <p className="font-semibold text-gray-900 text-sm">{message.senderName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-gray-600">{formatDate(message.createdAt)}</p>
                      {isOwn && (
                        <button
                          onClick={() => handleDeleteMessage(message.id)}
                          className="text-xs text-gray-600 hover:text-red-600 transition-colors"
                          title="Delete message"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-gray-900 text-sm mb-2 whitespace-pre-wrap">{message.content}</p>

                  {/* Read receipts */}
                  {message.readBy.length > 0 && (
                    <p className="text-xs text-gray-600 mt-2">
                      Read by {message.readBy.length} person{message.readBy.length !== 1 ? "s" : ""}
                    </p>
                  )}

                  {/* Attachments */}
                  {message.attachmentIds && message.attachmentIds.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-300">
                      <p className="text-xs text-gray-600 mb-2">Attachments:</p>
                      <div className="space-y-1">
                        {message.attachmentIds.map((attId) => (
                          <div key={attId} className="text-xs text-blue-600 hover:underline cursor-pointer">
                            📎 Attachment
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Message input */}
        <form onSubmit={handleSubmit} className="border-t border-gray-200 pt-4">
          <div className="flex gap-3">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Add a comment or note to this case..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              disabled={submitting}
            />
            <button
              type="submit"
              disabled={submitting || !newMessage.trim()}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors h-fit"
            >
              {submitting ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
