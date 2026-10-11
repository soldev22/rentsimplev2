import Link from "next/link"
import { redirect } from "next/navigation"
import MeetingRequestManager from "@/components/dashboard/MeetingRequestManager"
import { getSessionUser } from "@/lib/server/session"
import { canManageMeetingRequests, listMeetingRequests } from "@/lib/server/meeting-requests"
import { getMeetingEmailConfigurationError } from "@/lib/server/meeting-email"

export const dynamic = "force-dynamic"

export default async function MeetingRequestsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!canManageMeetingRequests(user)) redirect("/dashboard")
  const params = await searchParams
  const requestedPage = Number(params.page ?? 1)
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const { requests, totalPages } = await listMeetingRequests(user, page)

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Meeting requests</h1>
      <p className="text-sm text-slate-600">Prospective Landlord enquiries, newest first. Confirm the meeting details directly before marking a request confirmed.</p>
      {requests.length ? <MeetingRequestManager requests={requests} emailConfigurationError={getMeetingEmailConfigurationError()} /> : <p className="rounded-xl border border-slate-200 bg-white p-6">No meeting requests on this page.</p>}
      <nav aria-label="Meeting request pages" className="flex items-center gap-4 text-sm">
        {page > 1 ? <Link href={`/dashboard/meeting-requests?page=${page - 1}`} className="text-cyan-800 underline">Previous</Link> : null}
        <span>Page {page} of {totalPages}</span>
        {page < totalPages ? <Link href={`/dashboard/meeting-requests?page=${page + 1}`} className="text-cyan-800 underline">Next</Link> : null}
      </nav>
    </div>
  )
}
