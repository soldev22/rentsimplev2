import "server-only"

import type { AuthUser } from "@/lib/auth"
import { sendEmail } from "@/lib/server/email"
import { sendSms } from "@/lib/server/sms"
import { listApprovedGlobalAdmins } from "@/lib/server/users"

export async function sendLandlordApplicationNotifications(user: AuthUser) {
  const admins = await listApprovedGlobalAdmins()
  if (!admins.length) {
    console.warn("No Global admin recipients for Landlord application.", { userId: user.id })
    return
  }
  const origin = process.env.NEXT_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") || "http://localhost:3000"
  const reviewUrl = `${origin}/dashboard/users`
  const results = await Promise.allSettled(admins.flatMap((admin) => [
    sendEmail({
      to: admin.email,
      fromName: "RentSimple Notifications",
      tag: "landlord-application",
      subject: "New verified Landlord application",
      text: [
        "A prospective Landlord has verified their email and is awaiting approval.",
        `Name: ${user.first_name} ${user.last_name}`,
        `Email: ${user.email}`,
        `Phone: ${user.mobile || "Not supplied"}`,
        `Review: ${reviewUrl}`,
      ].join("\n"),
    }),
    admin.mobile?.trim()
      ? sendSms(admin.mobile, `RentSimple: new verified Landlord application. Review: ${reviewUrl}`)
      : Promise.resolve({ status: "skipped" as const }),
  ]))
  if (results.some((result) => result.status === "rejected" || result.value.status !== "sent")) {
    console.warn("Landlord application notifications incomplete.", {
      userId: user.id,
      outcomes: results.map((result) => result.status === "fulfilled" ? result.value.status : "failed"),
    })
  }
}
