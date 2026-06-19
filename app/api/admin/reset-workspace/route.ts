import { NextResponse } from "next/server"

import { resetWorkspaceForTesting } from "@/lib/server/admin-reset"
import { getSessionUser } from "@/lib/server/session"

export async function POST() {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await resetWorkspaceForTesting(user)
    return NextResponse.json({ result })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({ error: "Unable to reset workspace data." }, { status: 500 })
  }
}