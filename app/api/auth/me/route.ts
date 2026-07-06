import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/server/session"
import { getUserRole } from "@/lib/auth"

export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const displayName = `${user.first_name} ${user.last_name}`.trim() || user.email
    const displayRole = getUserRole(user) || "guest"

    return NextResponse.json({
      id: user.id,
      email: user.email,
      displayName,
      displayRole,
    })
  } catch (error) {
    console.error("Error fetching user:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
