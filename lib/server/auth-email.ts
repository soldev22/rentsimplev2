import "server-only"

import { sendEmail } from "@/lib/server/email"

type AuthEmailResult = {
  status: "sent" | "skipped" | "failed"
  detail: string
}

async function sendAuthEmail(to: string, subject: string, text: string): Promise<AuthEmailResult> {
  const result = await sendEmail({ to, subject, text, fromName: "RentSimple", tag: "account" })
  return { status: result.status, detail: result.detail }
}

export async function sendVerificationEmail(to: string, verificationUrl: string) {
  return sendAuthEmail(
    to,
    "Verify your RentSimple email",
    [
      "Welcome to RentSimple.",
      "",
      "Use the link below to verify your email address and activate your account:",
      verificationUrl,
      "",
      "If you did not create this account, you can ignore this email.",
    ].join("\n"),
  )
}

export async function sendEmailChangeVerificationEmail(to: string, confirmUrl: string) {
  return sendAuthEmail(
    to,
    "Confirm your new RentSimple email address",
    [
      "We received a request to change the email address on your RentSimple account to this address.",
      "",
      "Use the link below to confirm the change:",
      confirmUrl,
      "",
      "If you did not request this change, you can ignore this email and your account will not be changed.",
    ].join("\n"),
  )
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  return sendAuthEmail(
    to,
    "Reset your RentSimple password",
    [
      "We received a request to reset your RentSimple password.",
      "",
      "Use the link below to choose a new password:",
      resetUrl,
      "",
      "If you did not request this reset, you can ignore this email.",
    ].join("\n"),
  )
}

export async function sendLandlordWelcomeEmail(to: string, firstName: string, termsUrl: string) {
  const greetingName = firstName.trim() || "there"

  return sendAuthEmail(
    to,
    "Welcome to RentSimple - please review your Landlord terms",
    [
      `Hi ${greetingName},`,
      "",
      "Welcome to RentSimple! Your account has been set up as a Landlord, and we're delighted to have you on board.",
      "",
      "RentSimple helps you manage your properties, Applicants and Tenants in one place, from listing a property through to managing compliance and maintenance.",
      "",
      "Before you can use your Landlord dashboard, please read and accept our Landlord terms:",
      termsUrl,
      "",
      "If you have any questions, just reply to this email and our team will be happy to help.",
      "",
      "The RentSimple team",
    ].join("\n"),
  )
}

export async function sendLandlordTermsUpdatedEmail(to: string, firstName: string, termsUrl: string) {
  const greetingName = firstName.trim() || "there"

  return sendAuthEmail(
    to,
    "We've updated our Landlord terms - please review and accept",
    [
      `Hi ${greetingName},`,
      "",
      "We've updated the RentSimple Landlord terms.",
      "",
      "Please read the updated terms and accept them to keep using your Landlord dashboard:",
      termsUrl,
      "",
      "You'll also be asked to review them the next time you sign in.",
      "",
      "If you have any questions, just reply to this email and our team will be happy to help.",
      "",
      "The RentSimple team",
    ].join("\n"),
  )
}