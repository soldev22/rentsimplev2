"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { CaseAttachment } from "@/lib/auth"

type CaseAttachmentManagerProps = {
  caseId: string
  propertyId: string
  readOnly?: boolean
}

const ALLOWED_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png", "gif", "txt", "csv"]

function getFileIcon(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase()
  switch (ext) {
    case "pdf":
      return "📄"
    case "doc":
    case "docx":
      return "📝"
    case "xls":
    case "xlsx":
      return "📊"
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
      return "🖼️"
    case "txt":
    case "csv":
      return "📋"
    default:
      return "📎"
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
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

export default function CaseAttachmentManager({ caseId, propertyId, readOnly = false }: CaseAttachmentManagerProps) {
  const [attachments, setAttachments] = useState<CaseAttachment[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadAttachments = useCallback(async () => {
    try {
      const response = await fetch(`/api/properties/${propertyId}/cases/${caseId}/attachments`)
      if (response.ok) {
        const data = await response.json()
        setAttachments(data)
        setError(null)
      } else {
        setError("Failed to load attachments")
      }
    } catch (err) {
      console.error("Error loading attachments:", err)
      setError("Error loading attachments")
    } finally {
      setLoading(false)
    }
  }, [propertyId, caseId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAttachments()
  }, [loadAttachments])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file extension
    const ext = file.name.split(".").pop()?.toLowerCase()
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      setError(`File type not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`)
      return
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("File size exceeds 10MB limit")
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch(`/api/properties/${propertyId}/cases/${caseId}/attachments`, {
        method: "POST",
        body: formData,
      })

      if (response.ok) {
        await loadAttachments()
        setError(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      } else {
        const data = await response.json()
        setError(data.error || "Failed to upload file")
      }
    } catch (err) {
      console.error("Error uploading file:", err)
      setError("Error uploading file")
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!window.confirm("Are you sure you want to delete this attachment?")) {
      return
    }

    setDeleting(attachmentId)
    try {
      const response = await fetch(`/api/properties/${propertyId}/cases/${caseId}/attachments/${attachmentId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        await loadAttachments()
        setError(null)
      } else {
        setError("Failed to delete attachment")
      }
    } catch (err) {
      console.error("Error deleting attachment:", err)
      setError("Error deleting attachment")
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return <div className="text-center py-6 text-gray-600">Loading attachments...</div>
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Case Documents & Files</h3>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">{error}</div>}

      {/* Upload section */}
      {!readOnly && (
        <div className="mb-6 p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
          <div className="flex items-center justify-center">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
              accept={ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
              aria-label="Upload case attachment file"
              title="Select a file to upload (PDF, images, Office documents, or text files)"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
              aria-label="Click to upload a file"
              title="Upload attachment for this case"
            >
              {uploading ? "Uploading..." : "Upload File"}
            </button>
          </div>
          <p className="text-xs text-gray-600 text-center mt-3">
            Max 10MB. Allowed: PDF, Word, Excel, Images, Text, CSV
          </p>
        </div>
      )}

      {/* Attachments list */}
      {attachments.length === 0 ? (
        <p className="text-gray-600 text-center py-8">No files attached yet.</p>
      ) : (
        <div className="space-y-3">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="flex items-start justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
              <div className="flex-1 flex items-start gap-4">
                <div className="text-2xl mt-1">{getFileIcon(attachment.fileName)}</div>
                <div className="flex-1 min-w-0">
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-blue-600 hover:text-blue-700 hover:underline break-words"
                    title={attachment.fileName}
                  >
                    {attachment.fileName}
                  </a>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-600">
                    <span>{formatFileSize(attachment.size)}</span>
                    <span>•</span>
                    <span>{formatDate(attachment.uploadedAt)}</span>
                    <span>•</span>
                    <span>by {attachment.uploadedBy.split("@")[0]}</span>
                  </div>
                </div>
              </div>

              {!readOnly && (
                <button
                  onClick={() => handleDeleteAttachment(attachment.id)}
                  disabled={deleting === attachment.id}
                  className="ml-4 px-3 py-1 text-red-600 hover:text-red-700 disabled:text-gray-400 font-medium text-sm transition-colors flex-shrink-0"
                  title="Delete attachment"
                >
                  {deleting === attachment.id ? "..." : "✕"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-900">
          <span className="font-semibold">📎 Audit Trail:</span> All file uploads and deletions are automatically logged for tribunal evidence.
          Files are stored securely in Azure Blob Storage and can be accessed anytime.
        </p>
      </div>
    </div>
  )
}
