import { NextRequest, NextResponse } from "next/server"

import { getSessionUser } from "@/lib/server/session"
import { getUserRole, isPendingApproval } from "@/lib/auth"
import {
  parseZipFile,
  parsePropertyCSV,
  generateBulkUploadPreview,
  generatePreviewHash,
  processBulkUpload,
} from "@/lib/server/bulk-upload"
import type { BulkUploadPreviewResult } from "@/lib/types/bulk-upload"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (isPendingApproval(user)) {
      return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
    }

    const role = getUserRole(user)
    if (!["landlord", "agent", "admin"].includes(role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const formData = await request.formData()
    const action = formData.get("action") as string
    const zipFile = formData.get("file") as File | null

    if (action === "preview") {
      if (!zipFile) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 })
      }

      const buffer = Buffer.from(await zipFile.arrayBuffer())

      // Parse zip file
      const { csvContent, images, errorMessage } = await parseZipFile(buffer)

      if (errorMessage) {
        return NextResponse.json({ error: errorMessage }, { status: 400 })
      }

      if (!csvContent) {
        return NextResponse.json(
          { error: "No CSV content found in zip file" },
          { status: 400 },
        )
      }

      try {
        // Parse CSV
        const rows = parsePropertyCSV(csvContent)

        if (rows.length === 0) {
          return NextResponse.json({ error: "No properties found in CSV" }, { status: 400 })
        }

        // Generate preview
        const preview = await generateBulkUploadPreview(rows, images)

        // Generate hash for tamper detection
        const previewHash = generatePreviewHash(preview)

        return NextResponse.json({
          preview,
          previewHash,
          totalPropertiesAttempted: rows.length,
          totalPropertiesValid: preview.properties.length,
          totalValidationErrors: preview.errors.length,
          totalImages: images.size,
        })
      } catch (error) {
        return NextResponse.json(
          {
            error: `Failed to process upload: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
          { status: 400 },
        )
      }
    }

    if (action === "confirm") {
      const previewJson = formData.get("preview") as string | null
      const previewHash = formData.get("previewHash") as string | null
      const landlordEmail = formData.get("landlordEmail") as string | null
      const landlordId = formData.get("landlordId") as string | null
      const acknowledgedLegal = formData.get("acknowledgedLegal") as string | null
      const zipFile = formData.get("file") as File | null

      if (!previewJson || !previewHash || !landlordEmail || !zipFile) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
      }

      if (acknowledgedLegal !== "true") {
        return NextResponse.json(
          { error: "Must acknowledge legal responsibility" },
          { status: 400 },
        )
      }

      // Verify landlord control
      if (role === "landlord" && user.email !== landlordEmail) {
        return NextResponse.json(
          { error: "Landlords can only bulk upload to their own properties" },
          { status: 403 },
        )
      }

      try {
        const preview: BulkUploadPreviewResult = JSON.parse(previewJson)

        // Verify hash hasn't been tampered with
        const currentHash = generatePreviewHash(preview)
        if (currentHash !== previewHash) {
          return NextResponse.json(
            { error: "Preview data was modified. Please upload again." },
            { status: 400 },
          )
        }

        // Re-parse zip to get actual images
        const buffer = Buffer.from(await zipFile.arrayBuffer())
        const { csvContent, images, errorMessage } = await parseZipFile(buffer)

        if (errorMessage) {
          return NextResponse.json({ error: errorMessage }, { status: 400 })
        }

        // Process bulk upload (all-or-nothing)
        const result = await processBulkUpload(
          user,
          preview,
          images,
          landlordEmail,
          landlordId || undefined,
          role === "agent", // acting as agent?
        )

        return NextResponse.json({
          success: result.success,
          createdCount: result.createdPropertyIds.length,
          errorCount: result.errors.length,
          errors: result.errors,
          propertyIds: result.createdPropertyIds,
        })
      } catch (error) {
        return NextResponse.json(
          {
            error: `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
          { status: 400 },
        )
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Bulk upload error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
