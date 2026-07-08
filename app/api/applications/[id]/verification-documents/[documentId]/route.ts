import { NextResponse } from "next/server"

import { isPendingApproval } from "@/lib/auth"
import { listAuditEventsForEntity } from "@/lib/server/audit"
import {
  deleteVerificationDocumentForApplication,
  getVerificationDocumentForApplication,
} from "@/lib/server/applications"
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
    const result = await getVerificationDocumentForApplication(user, id, documentId)

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
        "Content-Disposition": `inline; filename="${contentDispositionFileName(result.document.fileName)}"`,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({ error: "Unable to download verification document." }, { status: 500 })
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
    const result = await deleteVerificationDocumentForApplication(user, id, documentId)

    if (!result) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 })
    }

    const auditEvents = await listAuditEventsForEntity("application", result.application.id)

    return NextResponse.json({
      application: result.application,
      auditEvents,
      deleted: result.deleted,
      message: result.deleted ? "Verification document deleted." : "Document was already removed.",
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({ error: "Unable to delete verification document." }, { status: 500 })
  }
}
