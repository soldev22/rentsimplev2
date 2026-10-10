import { NextResponse } from "next/server"

import { getSessionUser } from "@/lib/server/session"
import { acceptLandlordTerms } from "@/lib/server/users"

export async function POST() {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (user.role !== "landlord") {
    return NextResponse.json({ error: "Only Landlords can accept the Landlord terms." }, { status: 403 })
  }

  try {
    const updatedUser = await acceptLandlordTerms(user)
    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Only Landlords can accept the Landlord terms." }, { status: 403 })
    }

    return NextResponse.json({ error: "Unable to record your acceptance. Please try again." }, { status: 500 })
  }
}
