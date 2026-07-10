import { NextResponse } from "next/server"

import { isPendingApproval } from "@/lib/auth"
import { uploadDepositDocumentForApplication } from "@/lib/server/applications"
import { getSessionUser } from "@/lib/server/session"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPendingApproval(user)) {
    return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const categoryValue = formData.get("category")
    const category = typeof categoryValue === "string" ? categoryValue.trim() : "other"
    const replaceDocumentIdValue = formData.get("replaceDocumentId")
    const replaceDocumentId =
      typeof replaceDocumentIdValue === "string" && replaceDocumentIdValue.trim().length > 0
        ? replaceDocumentIdValue.trim()
        : undefined
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 })
    }

    const { id } = await context.params
    const result = await uploadDepositDocumentForApplication(user, id, category, file, replaceDocumentId)

    if (!result) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 })
    }

    return NextResponse.json({
      application: result.application,
      document: result.document,
      message: replaceDocumentId ? "Deposit document replaced." : "Deposit document uploaded.",
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (error instanceof Error && error.message === "FileSizeExceeded") {
      return NextResponse.json({ error: "File size exceeds maximum 10MB." }, { status: 400 })
    }

    if (error instanceof Error && error.message === "FileTypeNotAllowed") {
      return NextResponse.json({ error: "File type not allowed. Upload PDF, images, Word, Excel, TXT, or CSV." }, { status: 400 })
    }

    return NextResponse.json({ error: "Unable to upload deposit document." }, { status: 500 })
  }
}