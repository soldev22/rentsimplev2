import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json({ error: "Use Clerk sign-out instead of the legacy logout endpoint." }, { status: 410 })
}