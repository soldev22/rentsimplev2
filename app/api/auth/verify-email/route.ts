import { NextResponse } from "next/server"

import { verifyUserEmail } from "@/lib/server/users"

export async function POST(request: Request) {
  const body = (await request.json()) as {
    token?: string
  }

  if (!body.token?.trim()) {
    return NextResponse.json({ error: "Verification token is required." }, { status: 400 })
  }

  const result = await verifyUserEmail(body.token)

  if (!result.user || result.error) {
    return NextResponse.json({ error: "This verification link is invalid or has expired." }, { status: 400 })
  }

  return NextResponse.json({ message: "Your email address has been verified." })
}