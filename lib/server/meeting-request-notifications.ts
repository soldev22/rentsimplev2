import "server-only"

import type { MeetingRequest } from "@/lib/meeting-requests"
import { sendEmail } from "@/lib/server/email"
import { sendSms } from "@/lib/server/sms"
import { listApprovedGlobalAdmins } from "@/lib/server/users"
import { CONTACT_PHONE } from "@/lib/public-config"
import { getMeetingEmailConfigurationError, sendMeetingConfirmationEmail } from "@/lib/server/meeting-email"

export async function sendMeetingRequestNotifications(request: MeetingRequest) {
  const confirmationEmail = {
    to: request.email, fromName: "RentSimple", tag: "meeting-request",
    subject: "Less rental hassle. More time for you. Let's talk.",
    text: [
      `Hello ${request.firstName},`, "",
      "Your rental property should work for you, not take over your day.",
      "Thanks for requesting a meeting with RentSimple. We're looking forward to showing you how rental property management can be simpler, less stressful and easier to stay on top of.", "",
      "Rentals are all we do. That means our attention stays on your property, your Tenants and the jobs that need doing:",
      "- Fewer calls to chase and less paperwork to juggle.",
      "- Our own maintenance team for small jobs, keeping costs low.",
      "- Compliance and repair records kept together, so you know where things stand.", "",
      "Let's talk about what that could mean for you.",
      "We'll contact you to agree a date and time using the preferences below. This is a request, not a confirmed booking.", "",
      `Preferred days: ${request.preferredDays.join(", ")}`,
      `Preferred time: ${request.preferredTime}`,
      `Meeting type: ${request.meetingType}`, "",
      `If you don't want to wait, please feel free to call me, Mike, on ${CONTACT_PHONE}.`,
      "Ask me about our early bird offer: up to 50% off for the lifetime of your tenancy.", "",
      "Rental property management. Pure and simple.",
      "Mike and the RentSimple team",
    ].join("\n"),
  }
  const confirmation = getMeetingEmailConfigurationError()
    ? sendEmail(confirmationEmail)
    : sendMeetingConfirmationEmail(request, confirmationEmail.subject, confirmationEmail.text).then((sent) => ({ status: sent ? "sent" as const : "failed" as const }))
  const adminNotifications = (async () => {
    const admins = await listApprovedGlobalAdmins()
    if (!admins.length) {
      console.warn("No Global admin recipients for meeting request.", { requestId: request.id })
      return false
    }
    const origin = process.env.NEXT_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") || "http://localhost:3000"
    const reviewUrl = `${origin}/dashboard/meeting-requests`
    const text = [
      "A prospective Landlord requested a meeting.", "",
      `Name: ${request.firstName} ${request.lastName}`,
      `Phone: ${request.phone}`, `Email: ${request.email}`,
      `Properties: ${request.numberOfProperties}`, `Town: ${request.town}`,
      `Preferred days: ${request.preferredDays.join(", ")}`,
      `Preferred time: ${request.preferredTime}`, `Meeting type: ${request.meetingType}`,
      `Notes: ${request.notes || "None"}`, `Reference: ${request.id}`, "", `Review: ${reviewUrl}`,
    ].join("\n")
    const deliveries = await Promise.allSettled(admins.flatMap((admin) => [
      sendEmail({ to: admin.email, fromName: "RentSimple Notifications", replyTo: request.email, tag: "meeting-request", subject: "New Landlord meeting request", text }),
      admin.mobile?.trim()
        ? sendSms(admin.mobile, `RentSimple: new Landlord meeting request. Review: ${reviewUrl}`)
        : Promise.resolve({ status: "skipped" as const, detail: "Global admin has no mobile number." }),
    ]))
    const complete = deliveries.every((result) => result.status === "fulfilled" && result.value.status === "sent")
    if (!complete) {
      console.warn(`Meeting request admin notifications incomplete. ${JSON.stringify({
        requestId: request.id,
        outcomes: deliveries.map((result) => result.status === "fulfilled" ? result.value.status : "failed"),
      })}`)
    }
    return complete
  })()
  const [prospect, admins] = await Promise.allSettled([confirmation, adminNotifications])
  const confirmationSent = prospect.status === "fulfilled" && prospect.value.status === "sent"
  const adminsNotified = admins.status === "fulfilled" && admins.value
  if (!confirmationSent || !adminsNotified) {
    console.warn(`Meeting request notifications incomplete. ${JSON.stringify({ requestId: request.id, confirmationSent, adminsNotified })}`)
  }
  return { confirmationSent, adminsNotified }
}
