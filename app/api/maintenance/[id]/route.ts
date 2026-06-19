import { NextResponse } from "next/server"

import { getUserRole, isPendingApproval } from "@/lib/auth"
import { addMaintenanceBid, updateMaintenanceIssue } from "@/lib/server/maintenance"
import { getSessionUser } from "@/lib/server/session"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isPendingApproval(user)) {
    return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
  }

  try {
    const { id } = await context.params
    const body = await request.json()
    const issue =
      getUserRole(user) === "builder"
        ? await addMaintenanceBid(user, id, body)
        : await updateMaintenanceIssue(user, id, body)

    if (!issue) {
      return NextResponse.json({ error: "Maintenance issue not found." }, { status: 404 })
    }

    return NextResponse.json({ issue })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (error instanceof Error && error.message === "BiddingClosed") {
      return NextResponse.json({ error: "Bidding is closed for this issue." }, { status: 400 })
    }

    return NextResponse.json({ error: "Unable to update maintenance issue." }, { status: 500 })
  }
}