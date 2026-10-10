import { NextResponse } from "next/server"

import { getSessionUser } from "@/lib/server/session"
import { deleteUserForAdmin, eraseApplicantAccountForAdmin, getUserByEmail, getUserById, listAgentsForAdmin, listUsersForAdmin, sendLandlordWelcomeForUser, updateUserForAdmin } from "@/lib/server/users"

async function resolveTargetUserId(body: { userId?: string; email?: string }) {
  const userId = body.userId?.trim()

  if (userId) {
    return userId
  }

  const email = body.email?.trim()

  if (!email) {
    return null
  }

  const user = await getUserByEmail(email)
  return user?.id ?? null
}

export async function GET() {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const [users, agents] = await Promise.all([listUsersForAdmin(user), listAgentsForAdmin(user)])
    return NextResponse.json({ users, agents })
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
      userId?: string
      email?: string
      newEmail?: string
      first_name?: string
      last_name?: string
      mobile?: string
      role?: "unallocated" | "admin" | "agent" | "landlord" | "tenant" | "applicant" | "builder"
      approval_status?: "pending_verification" | "pending_approval" | "approved"
      managedByAgentId?: string | null
      notificationProfile?: {
        outboundEmail?: string
        copyLandlordOnTenantEmails?: boolean
      } | null
    }

    if ((!body.userId?.trim() && !body.email?.trim()) || !body.role || !body.approval_status) {
      return NextResponse.json({ error: "userId, role, and approval_status are required." }, { status: 400 })
    }

    const targetUserId = await resolveTargetUserId(body)

    if (!targetUserId) {
      return NextResponse.json({ error: "User not found." }, { status: 404 })
    }

    const previousUser = await getUserById(targetUserId)

    const updatedUser = await updateUserForAdmin(user, targetUserId, {
      email: body.newEmail,
      first_name: body.first_name,
      last_name: body.last_name,
      mobile: body.mobile,
      role: body.role,
      approval_status: body.approval_status,
      managedByAgentId: body.managedByAgentId,
      notificationProfile: body.notificationProfile,
    })

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 })
    }

    if (previousUser?.role !== "landlord" && updatedUser.role === "landlord") {
      const welcomeEmail = await sendLandlordWelcomeForUser(updatedUser, new URL(request.url).origin)
      return NextResponse.json({ user: updatedUser, welcomeEmail })
    }

    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (error instanceof Error && error.message === "CannotChangeOwnAdminRole") {
      return NextResponse.json({ error: "You cannot remove your own admin access from this screen." }, { status: 400 })
    }

    if (error instanceof Error && error.message === "InvalidEmail") {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })
    }

    if (error instanceof Error && error.message === "EmailAlreadyInUse") {
      return NextResponse.json({ error: "That email address is already used by another account." }, { status: 409 })
    }

    return NextResponse.json({ error: "Unable to update user." }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as { userId?: string; email?: string; accountErasure?: boolean }

    if (!body.userId?.trim() && !body.email?.trim()) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 })
    }

    const targetUserId = await resolveTargetUserId(body)

    if (!targetUserId) {
      return NextResponse.json({ error: "User not found." }, { status: 404 })
    }

    const deletedUser = body.accountErasure
      ? await eraseApplicantAccountForAdmin(user, targetUserId)
      : await deleteUserForAdmin(user, targetUserId)

    if (!deletedUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 })
    }

    return NextResponse.json({ user: deletedUser, deleted: true })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (error instanceof Error && error.message === "CannotDeleteOwnAccount") {
      return NextResponse.json({ error: "You cannot delete your own admin account." }, { status: 400 })
    }

    if (error instanceof Error && error.message === "ApplicantAccountErasureWorkflowRequired") {
      return NextResponse.json({ error: "Applicants must submit an account-erasure request before a Global admin can remove their account." }, { status: 400 })
    }

    if (error instanceof Error && error.message === "AccountErasureNotRequested") {
      return NextResponse.json({ error: "Only an Applicant who has requested account erasure can be removed through this workflow." }, { status: 400 })
    }

    if (error instanceof Error && error.message === "ActiveTenancyHistoryExists") {
      return NextResponse.json({ error: "This Applicant has an active tenancy history and cannot be erased through this workflow." }, { status: 400 })
    }

    return NextResponse.json({ error: "Unable to delete user." }, { status: 500 })
  }
}