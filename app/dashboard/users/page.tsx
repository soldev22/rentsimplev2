import { redirect } from "next/navigation"

import AdminUserManager from "@/components/forms/AdminUserManager"
import { getUserRole, isPendingApproval } from "@/lib/auth"
import { getSessionUser } from "@/lib/server/session"
import { listUsersForAdmin } from "@/lib/server/users"

export const dynamic = "force-dynamic"

export default async function UsersPage() {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  if (isPendingApproval(user)) {
    redirect("/waiting")
  }

  if (getUserRole(user) !== "admin") {
    redirect("/dashboard")
  }

  const users = await listUsersForAdmin(user)

  return <AdminUserManager initialUsers={users} currentUserEmail={user.email} />
}