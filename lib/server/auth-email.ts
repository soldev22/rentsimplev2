import "server-only"

import nodemailer from "nodemailer"

type AuthEmailResult = {
  status: "sent" | "skipped" | "failed"
  detail: string
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim()
  const port = Number(process.env.SMTP_PORT ?? "587")
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  const from = process.env.SMTP_FROM?.trim()

  if (!host || !user || !pass || !from || !Number.isFinite(port)) {
    return null
  }

  return { host, port, user, pass, from }
}

async function sendAuthEmail(to: string, subject: string, text: string): Promise<AuthEmailResult> {
  const config = getSmtpConfig()

  if (!config) {
    return {
      status: "skipped",
      detail: "SMTP configuration is missing.",
    }
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  })

  try {
    await transporter.sendMail({
      from: config.from,
      to,
      subject,
      text,
    })

    return {
      status: "sent",
      detail: `Delivered using the platform SMTP sender ${config.from}.`,
    }
  } catch (error) {
    return {
      status: "failed",
      detail: error instanceof Error ? error.message : "Unable to send email.",
    }
  }
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