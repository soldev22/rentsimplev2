import { redirect } from "next/navigation";

import DashboardShell from "@/components/layout/DashboardShell";
import { getUserRole, isPendingApproval } from "@/lib/auth";
import { getSessionUser } from "@/lib/server/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  if (isPendingApproval(user)) {
    redirect("/waiting")
  }

  return <DashboardShell initialUser={{ displayName: `${user.first_name} ${user.last_name}`.trim() || "User", displayRole: getUserRole(user) }}>{children}</DashboardShell>;
}
