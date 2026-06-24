import { getUserRole, isPendingVerification } from "@/lib/auth"
import { getSessionUser } from "@/lib/server/session"

export default async function WaitingPage() {
  const user = await getSessionUser()
  const role = getUserRole(user)
  const awaitingVerification = isPendingVerification(user)

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
          {awaitingVerification ? "Email Verification" : "Approval Queue"}
        </p>
        <h1 className="mb-4 mt-3 text-3xl font-semibold text-slate-900">
          {awaitingVerification ? "Verify Your Email" : "Account Pending Approval"}
        </h1>

        <p className="text-slate-600">
          {awaitingVerification
            ? "Your account has been created, but you must verify your email before you can sign in. Return to the login screen if you need to request another verification email."
            : "Your account has been created. An administrator will assign your role shortly."}
        </p>

        <div className="mt-6 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
          Current role: <span className="ml-2 font-semibold text-slate-900">{role}</span>
        </div>
      </div>
    </div>
  )
}

