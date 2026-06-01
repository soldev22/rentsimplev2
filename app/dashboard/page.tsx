import { redirect } from "next/navigation"

import { getDefaultDashboardPath } from "@/lib/auth"
import { getSessionUser } from "@/lib/server/session"

export const dynamic = "force-dynamic"

export default async function Page() {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  redirect(getDefaultDashboardPath(user))
}
