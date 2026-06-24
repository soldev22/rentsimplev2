import { NextResponse } from "next/server"

import { getDefaultDashboardPath, getUserRole, isPendingApproval } from "@/lib/auth"
import { createSession, getSessionUser } from "@/lib/server/session"
import { getUserByEmail } from "@/lib/server/users"

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
      email?: string
    }

    const targetEmail = body.email?.trim().toLowerCase()

    if (!targetEmail) {
      return NextResponse.json({ error: "Target email is required." }, { status: 400 })
    }

    const targetUser = await getUserByEmail(targetEmail)

    if (!targetUser) {
      return NextResponse.json({ error: "Target user not found." }, { status: 404 })
    }

    if (isPendingApproval(targetUser)) {
      return NextResponse.json(
        { error: "Cannot act as a user pending approval." },
        { status: 400 },
      )
    }

    await createSession(targetUser.email)

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
