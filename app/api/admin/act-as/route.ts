import { NextResponse } from "next/server"

import { getDefaultDashboardPath, getUserRole, isPendingApproval } from "@/lib/auth"
import { createSession, getSessionUser } from "@/lib/server/session"
import { getUserByEmail, getUserById } from "@/lib/server/users"

export async function POST(request: Request) {
  const adminUser = await getSessionUser()

  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (getUserRole(adminUser) !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = (await request.json()) as {
      userId?: string
      email?: string
    }

    const targetUserId = body.userId?.trim()
    const targetEmail = body.email?.trim().toLowerCase()

    if (!targetUserId && !targetEmail) {
      return NextResponse.json({ error: "Target user is required." }, { status: 400 })
    }

    const targetUser = targetUserId ? await getUserById(targetUserId) : await getUserByEmail(targetEmail!)

    if (!targetUser) {
      return NextResponse.json({ error: "Target user not found." }, { status: 404 })
    }

    if (isPendingApproval(targetUser)) {
      return NextResponse.json(
        { error: "Cannot act as a user pending approval." },
        { status: 400 },
      )
    }

    await createSession(targetUser.id)

    return NextResponse.json({
      ok: true,
      switchedTo: targetUser.email,
      role: targetUser.role,
      redirectTo: getDefaultDashboardPath(targetUser),
    })
  } catch {
    return NextResponse.json({ error: "Unable to switch user." }, { status: 500 })
  }
}
