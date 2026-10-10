import "server-only"

export type SmsDeliveryResult = {
  status: "sent" | "skipped" | "failed"
  detail: string
  messageId?: string
}

function getTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim()
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim()

  if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) {
    return null
  }

  return { accountSid, authToken, fromNumber, messagingServiceSid }
}

export function isSmsConfigured() {
  return getTwilioConfig() !== null
}

/**
 * Sends an SMS through the Twilio Messages API. Uses a Messaging Service when
 * TWILIO_MESSAGING_SERVICE_SID is set, otherwise TWILIO_FROM_NUMBER.
 */
export async function sendSms(to: string, body: string): Promise<SmsDeliveryResult> {
  const config = getTwilioConfig()

  if (!config) {
    return { status: "skipped", detail: "Twilio SMS configuration is missing." }
  }

  const params = new URLSearchParams({ To: to, Body: body })
  if (config.messagingServiceSid) {
    params.set("MessagingServiceSid", config.messagingServiceSid)
  } else if (config.fromNumber) {
    params.set("From", config.fromNumber)
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      },
    )

    const result = (await response.json().catch(() => null)) as
      | { sid?: string; message?: string; code?: number }
      | null

    if (!response.ok) {
      console.error("SMS delivery failed.", { provider: "twilio", statusCode: response.status, code: result?.code })
      return {
        status: "failed",
        detail: result?.message
          ? `Twilio rejected the SMS: ${result.message}`
          : `SMS notification failed with status ${response.status}.`,
      }
    }

    return { status: "sent", messageId: result?.sid, detail: "SMS notification sent using Twilio." }
  } catch (error) {
    console.error("SMS delivery failed.", { provider: "twilio", errorName: error instanceof Error ? error.name : "UnknownError" })
    return { status: "failed", detail: error instanceof Error ? error.message : "SMS notification failed." }
  }
}
