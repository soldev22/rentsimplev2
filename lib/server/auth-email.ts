import "server-only"

import { sendEmail } from "@/lib/server/email"

type AuthEmailResult = {
  status: "sent" | "skipped" | "failed"
  detail: string
}

type EmailBlock = string | { link: string; label: string }

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function renderText(blocks: EmailBlock[]) {
  return blocks.map((block) => (typeof block === "string" ? block : block.link)).join("\n\n")
}

function renderHtml(blocks: EmailBlock[]) {
  const paragraphStyle = "margin:0 0 16px;font-size:15px;line-height:1.5;color:#1f2937;"
  const body = blocks
    .map((block) => {
      if (typeof block === "string") {
        return `<p style="${paragraphStyle}">${escapeHtml(block)}</p>`
      }
      const href = escapeHtml(block.link)
      return [
        `<p style="margin:0 0 16px;">`,
        `<a href="${href}" style="display:inline-block;padding:12px 20px;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;">${escapeHtml(block.label)}</a>`,
        `</p>`,
        `<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#6b7280;">If the button doesn't work, copy this link into your browser:<br><a href="${href}" style="color:#0f766e;word-break:break-all;">${href}</a></p>`,
      ].join("")
    })
    .join("")

  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;"><div style="max-width:560px;margin:0 auto;background:#ffffff;padding:24px;border-radius:8px;">${body}</div></body></html>`
}

async function sendAuthEmail(to: string, subject: string, blocks: EmailBlock[]): Promise<AuthEmailResult> {
  const result = await sendEmail({
    to,
    subject,
    text: renderText(blocks),
    html: renderHtml(blocks),
    fromName: "RentSimple",
    tag: "account",
  })
  return { status: result.status, detail: result.detail }
}

export async function sendVerificationEmail(to: string, verificationUrl: string) {
  return sendAuthEmail(to, "Verify your RentSimple email", [
    "Welcome to RentSimple.",
    "Use the link below to verify your email address and activate your account:",
    { link: verificationUrl, label: "Verify my email" },
    "If you did not create this account, you can ignore this email.",
  ])
}

export async function sendEmailChangeVerificationEmail(to: string, confirmUrl: string) {
  return sendAuthEmail(to, "Confirm your new RentSimple email address", [
    "We received a request to change the email address on your RentSimple account to this address.",
    "Use the link below to confirm the change:",
    { link: confirmUrl, label: "Confirm new email" },
    "If you did not request this change, you can ignore this email and your account will not be changed.",
  ])
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  return sendAuthEmail(to, "Reset your RentSimple password", [
    "We received a request to reset your RentSimple password.",
    "Use the link below to choose a new password:",
    { link: resetUrl, label: "Reset my password" },
    "If you did not request this reset, you can ignore this email.",
  ])
}

export async function sendLandlordWelcomeEmail(to: string, firstName: string, termsUrl: string) {
  const greetingName = firstName.trim() || "there"

  return sendAuthEmail(to, "Welcome to RentSimple - please review your Landlord terms", [
    `Hi ${greetingName},`,
    "Welcome to RentSimple! Your account has been set up as a Landlord, and we're delighted to have you on board.",
    "RentSimple helps you manage your properties, Applicants and Tenants in one place, from listing a property through to managing compliance and maintenance.",
    "Before you can use your Landlord dashboard, please read and accept our Landlord terms:",
    { link: termsUrl, label: "Review Landlord terms" },
    "If you have any questions, just reply to this email and our team will be happy to help.",
    "The RentSimple team",
  ])
}

export async function sendLandlordTermsUpdatedEmail(to: string, firstName: string, termsUrl: string) {
  const greetingName = firstName.trim() || "there"

  return sendAuthEmail(to, "We've updated our Landlord terms - please review and accept", [
    `Hi ${greetingName},`,
    "We've updated the RentSimple Landlord terms.",
    "Please read the updated terms and accept them to keep using your Landlord dashboard:",
    { link: termsUrl, label: "Review updated terms" },
    "You'll also be asked to review them the next time you sign in.",
    "If you have any questions, just reply to this email and our team will be happy to help.",
    "The RentSimple team",
  ])
}