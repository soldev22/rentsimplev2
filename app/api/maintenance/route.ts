import { NextResponse } from "next/server"

import { canAccessMaintenance, getUserRole, isPendingApproval } from "@/lib/auth"
import {
  createMaintenanceIssue,
  listMaintenanceIssuesForUserByContinuation,
  listMaintenanceIssuesForUserPage,
} from "@/lib/server/maintenance"
import { getSessionUser } from "@/lib/server/session"

export async function GET(request: Request) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPendingApproval(user)) {
    return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
  }

  if (!canAccessMaintenance(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const url = new URL(request.url)
    const page = Number.isFinite(Number(url.searchParams.get("page"))) ? Number(url.searchParams.get("page")) : 1
    const pageSize = Number.isFinite(Number(url.searchParams.get("pageSize")))
      ? Number(url.searchParams.get("pageSize"))
      : 25
    const continuationToken = url.searchParams.get("continuationToken") ?? undefined
    const maxItemCount = Number.isFinite(Number(url.searchParams.get("maxItemCount")))
      ? Number(url.searchParams.get("maxItemCount"))
      : 50

    if (continuationToken) {
      const continuationPage = await listMaintenanceIssuesForUserByContinuation(user, {
        continuationToken,
        maxItemCount,
      })

      return NextResponse.json({
        issues: continuationPage.items,
        pagination: {
          mode: "continuation",
          continuationToken: continuationPage.continuationToken,
          maxItemCount: continuationPage.maxItemCount,
        },
      })
    }

    const paged = await listMaintenanceIssuesForUserPage(user, { page, pageSize })
    return NextResponse.json({ issues: paged.items, pagination: { mode: "offset", ...paged } })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({ error: "Unable to load maintenance issues." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPendingApproval(user)) {
    return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
  }

  if (getUserRole(user) !== "tenant") {
    return NextResponse.json({ error: "Only tenants can report faults from this screen." }, { status: 403 })
  }

  try {
    const body = await request.json()
    const issue = await createMaintenanceIssue(user, body)
    return NextResponse.json({ issue }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (error instanceof Error && error.message === "MaintenanceIssueValidationError") {
      return NextResponse.json({ error: "Property, title, and description are required." }, { status: 400 })
    }

    return NextResponse.json({ error: "Unable to create maintenance issue." }, { status: 500 })
  }
}