import { NextResponse } from "next/server"

import { isPendingApproval } from "@/lib/auth"
import { deleteDepositDocumentForApplication, getDepositDocumentForApplication } from "@/lib/server/applications"
import { getSessionUser } from "@/lib/server/session"

type RouteContext = {
  params: Promise<{
    id: string
    documentId: string
  }>
}

function contentDispositionFileName(fileName: string) {
  return fileName.replace(/[\r\n"]/g, "_")
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPendingApproval(user)) {
    return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
  }

  try {
    const { id, documentId } = await context.params
    const result = await getDepositDocumentForApplication(user, id, documentId)

    if (!result) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 })
    }

    if (!result.document || !result.download) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 })
    }

    return new Response(result.download.stream, {
      status: 200,
      headers: {
        "Content-Type": result.download.contentType,
        "Content-Length": String(result.download.contentLength ?? 0),
        "Content-Disposition": `inline; filename="${contentDispositionFileName(result.document.fileName)}"`,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({ error: "Unable to download deposit document." }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPendingApproval(user)) {
    return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
  }

  try {
    const { id, documentId } = await context.params
    const result = await deleteDepositDocumentForApplication(user, id, documentId)

    if (!result) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 })
    }

    return NextResponse.json({
      application: result.application,
      message: result.deleted ? "Deposit document deleted." : "Document was already removed.",
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({ error: "Unable to delete deposit document." }, { status: 500 })
  }
}