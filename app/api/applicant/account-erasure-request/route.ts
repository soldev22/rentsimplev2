import { NextResponse } from "next/server"

import { getUserRole, isPendingApproval } from "@/lib/auth"
import { getSessionUser } from "@/lib/server/session"
import { requestApplicantAccountErasure } from "@/lib/server/users"

export async function POST() {
  const user = await getSessionUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (isPendingApproval(user)) return NextResponse.json({ error: "Account pending approval" }, { status: 403 })
  if (getUserRole(user) !== "applicant") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const updatedUser = await requestApplicantAccountErasure(user)

    if (!updatedUser) return NextResponse.json({ error: "Applicant account not found." }, { status: 404 })

    return NextResponse.json({ requestedAt: updatedUser.accountErasureRequestedAt })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({ error: "Unable to request account erasure." }, { status: 500 })
  }
}