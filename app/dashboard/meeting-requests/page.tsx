import Link from "next/link"
import { redirect } from "next/navigation"
import MeetingRequestManager from "@/components/dashboard/MeetingRequestManager"
import { getSessionUser } from "@/lib/server/session"
import { canManageMeetingRequests, getMeetingRequest, listMeetingRequests } from "@/lib/server/meeting-requests"
import { getMeetingEmailConfigurationError } from "@/lib/server/meeting-email"

export const dynamic = "force-dynamic"

export default async function MeetingRequestsPage({ searchParams }: { searchParams: Promise<{ page?: string; request?: string }> }) {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!canManageMeetingRequests(user)) redirect("/dashboard")
  const params = await searchParams
  const requestedPage = Number(params.page ?? 1)
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const focusedId = typeof params.request === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.request) ? params.request : undefined
  const focused = focusedId ? await getMeetingRequest(user, focusedId) : null
  const { requests, totalPages } = focusedId ? { requests: focused ? [focused] : [], totalPages: 1 } : await listMeetingRequests(user, page)

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Meeting requests</h1>
      <p className="text-sm text-slate-600">Prospective Landlord enquiries, newest first. Agree the details directly, then enter the date and start/end times before confirming. Confirmed meetings appear in the <Link href="/dashboard/diary" className="underline">shared diary</Link>.</p>
      {params.request !== undefined && !focusedId ? <p role="alert" className="text-sm text-red-700">Invalid meeting reference. Showing all meeting requests.</p> : null}
      {focusedId ? <Link href="/dashboard/meeting-requests" className="block text-sm text-cyan-800 underline">All meeting requests</Link> : null}
      {requests.length ? <MeetingRequestManager requests={requests} emailConfigurationError={getMeetingEmailConfigurationError()} expanded={Boolean(focusedId)} /> : <p className="rounded-xl border border-slate-200 bg-white p-6">{focusedId ? "Meeting request not found." : "No meeting requests on this page."}</p>}
      {!focusedId ? <nav aria-label="Meeting request pages" className="flex items-center gap-4 text-sm">
        {page > 1 ? <Link href={`/dashboard/meeting-requests?page=${page - 1}`} className="text-cyan-800 underline">Previous</Link> : null}
        <span>Page {page} of {totalPages}</span>
        {page < totalPages ? <Link href={`/dashboard/meeting-requests?page=${page + 1}`} className="text-cyan-800 underline">Next</Link> : null}
      </nav> : null}
    </div>
  )
}
