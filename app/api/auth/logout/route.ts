import { NextResponse } from "next/server"

import { destroySession } from "@/lib/server/session"

export async function POST() {
  await destroySession()
  return NextResponse.json({ success: true })
}