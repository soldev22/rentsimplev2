import Link from "next/link"
import { redirect } from "next/navigation"
import CrmContactManager from "@/components/dashboard/CrmContactManager"
import { CRM_STAGES } from "@/lib/crm"
import { getSessionUser } from "@/lib/server/session"
import { canManageCrm, listCrmContacts } from "@/lib/server/crm"

export const dynamic = "force-dynamic"

export default async function CrmPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!canManageCrm(user)) redirect("/dashboard")
  const contacts = await listCrmContacts(user)
  const counts = Object.fromEntries(CRM_STAGES.map((stage) => [stage, contacts.filter((contact) => contact.stage === stage).length]))

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">CRM</h1>
      <p className="text-sm text-slate-600">
        Contacts are matched by email address. Stages are worked out from saved facts: <strong>Suspect</strong> until a meeting is marked done, <strong>Prospect</strong> once a meeting has been marked done, and <strong>Allocated</strong> as soon as an account is registered with the same email. CRM stages never grant access or change approval. Manage enquiries in <Link href="/dashboard/meeting-requests" className="text-cyan-800 underline">meeting requests</Link> and the <Link href="/dashboard/diary" className="text-cyan-800 underline">shared diary</Link>; manage approvals in <Link href="/dashboard/users" className="text-cyan-800 underline">users</Link>.
      </p>
      <dl className="grid gap-4 sm:grid-cols-3">
        {CRM_STAGES.map((stage) => (
          <div key={stage} className="rounded-xl border border-slate-200 bg-white p-4">
            <dt className="text-sm text-slate-600">{stage}</dt>
            <dd className="text-2xl font-bold text-slate-900">{counts[stage]}</dd>
          </div>
        ))}
      </dl>
      <CrmContactManager contacts={contacts} />
    </div>
  )
}
