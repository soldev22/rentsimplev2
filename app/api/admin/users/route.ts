import { NextResponse } from "next/server"

import { getSessionUser } from "@/lib/server/session"
import { listUsersForAdmin, updateUserForAdmin } from "@/lib/server/users"

export async function GET() {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const users = await listUsersForAdmin(user)
    return NextResponse.json({ users })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({ error: "Unable to load users." }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as {
      email?: string
      role?: "unallocated" | "admin" | "agent" | "landlord" | "tenant" | "applicant" | "builder"
      approval_status?: "pending_approval" | "approved"
    }

    if (!body.email?.trim() || !body.role || !body.approval_status) {
      return NextResponse.json({ error: "email, role, and approval_status are required." }, { status: 400 })
    }

    const updatedUser = await updateUserForAdmin(user, body.email, {
      role: body.role,
      approval_status: body.approval_status,
    })

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 })
    }

    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (error instanceof Error && error.message === "CannotChangeOwnAdminRole") {
      return NextResponse.json({ error: "You cannot remove your own admin access from this screen." }, { status: 400 })
    }

    return NextResponse.json({ error: "Unable to update user." }, { status: 500 })
  }
}