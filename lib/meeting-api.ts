import { isRecord } from "@/lib/meeting-requests"

export class MeetingResponseError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = "MeetingResponseError"
  }
}

export async function readMeetingResponse(response: Response): Promise<Record<string, unknown>> {
  if (response.redirected || response.status === 401) {
    throw new MeetingResponseError("Your session has expired. Sign in again, then refresh this panel.", response.status)
  }
  if (!response.headers.get("content-type")?.includes("application/json")) {
    const message = response.status === 404 || response.status === 405
      ? "The meeting API is unavailable. Restart the development server or deploy the latest build, then refresh this panel."
      : `The server returned an unexpected response (HTTP ${response.status}). Refresh to check the request before trying again.`
    throw new MeetingResponseError(message, response.status)
  }
  const payload: unknown = await response.json()
  if (!isRecord(payload)) {
    throw new MeetingResponseError("The server returned an invalid response. Refresh to check the request before trying again.", response.status)
  }
  return payload
}
