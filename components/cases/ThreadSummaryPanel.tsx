"use client"

import { useState } from "react"
import type { ThreadSummary } from "@/lib/auth"

type ThreadSummaryPanelProps = {
  caseId: string
  propertyId: string
}

export default function ThreadSummaryPanel({ caseId, propertyId }: ThreadSummaryPanelProps) {
  const [summary, setSummary] = useState<ThreadSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerateSummary = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/properties/${propertyId}/cases/${caseId}/summary`,
        {
          method: "POST",
        }
      )

      if (response.ok) {
        const data = await response.json()
        setSummary(data)
      } else {
        const data = await response.json()
        setError(data.error || "Failed to generate summary")
      }
    } catch (err) {
      console.error("Error generating summary:", err)
      setError("Error generating summary")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          🤖 Case Summary (AI)
        </h3>
        <button
          onClick={handleGenerateSummary}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors text-sm"
          aria-label="Generate AI summary of case discussion thread"
          title="Use Claude AI to analyze and summarize all messages in this case"
        >
          {loading ? "Generating..." : "Generate Summary"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {summary ? (
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-gray-900 leading-relaxed">{summary.summary}</p>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>
              📝 {summary.messageCount} messages analyzed • 🔤 {summary.tokensUsed}{" "}
              tokens
            </span>
            <span>
              {new Date(summary.generatedAt).toLocaleDateString("en-GB", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-600">
          <p>No summary generated yet.</p>
          <p className="text-sm mt-2">
            Click &quot;Generate Summary&quot; to use AI to summarize the case discussion.
          </p>
        </div>
      )}

      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
        <span className="font-semibold">💡 Tip:</span> AI summaries use Claude to
        analyze all messages and provide a concise overview of key issues, actions,
        and status.
      </div>
    </div>
  )
}
