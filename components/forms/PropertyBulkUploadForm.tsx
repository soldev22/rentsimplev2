"use client"

import { useState, useRef } from "react"
import type { BulkUploadPreviewResult, BulkUploadValidationError } from "@/lib/types/bulk-upload"

interface PropertyBulkUploadFormProps {
  landlordEmail: string
  landlordId?: string
  onSuccess?: (createdCount: number, propertyIds: string[]) => void
}

export default function PropertyBulkUploadForm({
  landlordEmail,
  landlordId,
  onSuccess,
}: PropertyBulkUploadFormProps) {
  const [state, setState] = useState<
    "idle" | "uploading" | "preview" | "confirming" | "success" | "error"
  >("idle")
  const [error, setError] = useState<string>("")
  const [preview, setPreview] = useState<BulkUploadPreviewResult | null>(null)
  const [previewHash, setPreviewHash] = useState<string>("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [successData, setSuccessData] = useState<{
    createdCount: number
    errorCount: number
    errors: BulkUploadValidationError[]
    propertyIds: string[]
  } | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)
  const [isDragging, setIsDragging] = useState(false)

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    dragCounter.current = 0

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith(".zip")) {
      setError("Please select a .zip file")
      setState("error")
      return
    }

    setSelectedFile(file)
    handlePreview(file)
  }

  const handlePreview = async (file: File) => {
    setState("uploading")
    setError("")

    try {
      const formData = new FormData()
      formData.append("action", "preview")
      formData.append("file", file)

      const response = await fetch("/api/properties/bulk-upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Preview failed")
      }

      const data = await response.json()
      setPreview(data.preview)
      setPreviewHash(data.previewHash)
      setState("preview")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed")
      setState("error")
    }
  }

  const handleConfirm = async () => {
    if (!selectedFile || !preview || !previewHash) return

    if (!acknowledged) {
      setError("You must acknowledge legal responsibility")
      return
    }

    setState("confirming")
    setError("")

    try {
      const formData = new FormData()
      formData.append("action", "confirm")
      formData.append("file", selectedFile)
      formData.append("preview", JSON.stringify(preview))
      formData.append("previewHash", previewHash)
      formData.append("landlordEmail", landlordEmail)
      if (landlordId) {
        formData.append("landlordId", landlordId)
      }
      formData.append("acknowledgedLegal", "true")

      const response = await fetch("/api/properties/bulk-upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Upload failed")
      }

      const data = await response.json()
      setSuccessData({
        createdCount: data.createdCount,
        errorCount: data.errorCount,
        errors: data.errors || [],
        propertyIds: data.propertyIds || [],
      })
      setState("success")

      if (onSuccess) {
        onSuccess(data.createdCount, data.propertyIds)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
      setState("error")
    }
  }

  const handleReset = () => {
    setState("idle")
    setError("")
    setPreview(null)
    setPreviewHash("")
    setSelectedFile(null)
    setSuccessData(null)
    setAcknowledged(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  if (state === "success" && successData) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <h3 className="text-lg font-semibold text-green-900 mb-2">Upload Complete</h3>
          <p className="text-green-700 mb-4">
            Successfully created {successData.createdCount} propert{successData.createdCount === 1 ? "y" : "ies"}
          </p>

          {successData.errorCount > 0 && (
            <div className="mb-4 rounded bg-red-100 p-3">
              <p className="text-sm font-semibold text-red-900 mb-2">
                {successData.errorCount} row{successData.errorCount === 1 ? "" : "s"} had errors:
              </p>
              <ul className="space-y-1">
                {successData.errors.map((err, idx) => (
                  <li key={idx} className="text-xs text-red-700">
                    Row {err.rowIndex}, {err.field}: {err.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={handleReset}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            Upload More Properties
          </button>
        </div>
      </div>
    )
  }

  if (state === "preview" && preview) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Preview Upload</h3>

          <div className="mb-6 grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-blue-600 font-semibold">{preview.properties.length}</p>
              <p className="text-blue-700 text-xs">Valid Properties</p>
            </div>
            <div>
              <p className="text-red-600 font-semibold">{preview.errors.length}</p>
              <p className="text-red-700 text-xs">Validation Errors</p>
            </div>
            <div>
              <p className="text-purple-600 font-semibold">{preview.imageCount}</p>
              <p className="text-purple-700 text-xs">Total Images</p>
            </div>
          </div>

          {preview.errors.length > 0 && (
            <div className="mb-6 max-h-48 overflow-y-auto rounded bg-red-100 p-3">
              <p className="font-semibold text-red-900 mb-2 text-sm">Validation Issues:</p>
              {preview.errors.map((err, idx) => (
                <p key={idx} className="text-xs text-red-700 mb-1">
                  <span className="font-mono">Row {err.rowIndex}</span> - {err.field}: {err.error}
                </p>
              ))}
            </div>
          )}

          <div className="mb-6">
            <h4 className="font-semibold text-blue-900 mb-3 text-sm">Properties to Create:</h4>
            <div className="grid gap-3 max-h-96 overflow-y-auto">
              {preview.properties.map((prop, idx) => (
                <div key={idx} className="rounded border border-blue-200 bg-white p-3">
                  <p className="font-semibold text-sm text-slate-900">{prop.address}</p>
                  <p className="text-xs text-slate-600">
                    {prop.city}, {prop.postcode}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-slate-600">
                      {prop.bedrooms}bd • {prop.bathrooms}ba • £{prop.monthlyRent}/mo
                    </span>
                    {prop.images.length > 0 && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                        {prop.images.length} image{prop.images.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6 rounded bg-yellow-50 border border-yellow-200 p-3">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-1"
              />
              <span className="text-xs text-yellow-900">
                I acknowledge that I have reviewed all properties and confirm this bulk upload
                on behalf of the landlord. I understand that all properties will be created in
                draft status and must be reviewed before publishing.
              </span>
            </label>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="flex-1 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!acknowledged}
              className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Confirm & Upload
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (state === "error") {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <h3 className="text-lg font-semibold text-red-900 mb-2">Upload Error</h3>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={handleReset}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-slate-300 bg-slate-50 hover:border-slate-400"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          aria-label="Upload properties ZIP file"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              handleFileSelect(e.target.files[0])
            }
          }}
          className="hidden"
        />

        <div className="space-y-2">
          <svg
            className="mx-auto h-12 w-12 text-slate-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v28a4 4 0 004 4h24a4 4 0 004-4V20m-14-12v16m0 0l-4-4m4 4l4-4"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="text-sm font-semibold text-slate-900">
            Drag and drop your properties ZIP file here
          </p>
          <p className="text-xs text-slate-600">
            or{" "}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="font-semibold text-blue-600 hover:underline"
            >
              click to select
            </button>
          </p>
        </div>
      </div>

      <div className="text-xs text-slate-600 space-y-1">
        <p className="font-semibold text-slate-700 mb-2">Requirements:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>ZIP file containing: properties.csv + images/ folder</li>
          <li>CSV headers: address, city, postcode, propertyType, bedrooms, bathrooms, monthlyRent, (optional: status, shortDescription, longDescription, imageFiles)</li>
          <li>Images: JPG, PNG, WebP, GIF (max 5MB each)</li>
          <li>Max 500 properties per upload</li>
          <li>Max 10 images per property</li>
        </ul>
      </div>
    </div>
  )
}
