import { describe, expect, it } from "vitest"
import { readMeetingResponse } from "./meeting-api"

describe("meeting API responses", () => {
  it("preserves JSON success and actionable API errors", async () => {
    const success = { request: { id: "one", updatedAt: "2026-10-11T09:00:00.000Z" } }
    expect(await readMeetingResponse(Response.json(success))).toEqual(success)
    expect(await readMeetingResponse(Response.json({ deleted: true }))).toEqual({ deleted: true })
    expect(await readMeetingResponse(Response.json({ error: "Refresh before saving." }, { status: 409 })))
      .toEqual({ error: "Refresh before saving." })
  })
  it.each([404, 405])("explains missing meeting routes (HTTP %s) instead of parsing HTML", async (status) => {
    await expect(readMeetingResponse(new Response("<html>Not found</html>", {
      status, headers: { "Content-Type": "text/html" },
    }))).rejects.toMatchObject({ name: "MeetingResponseError", status, message: expect.stringContaining("Restart the development server") })
  })
  it("explains expired sessions, including redirects to a login page", async () => {
    await expect(readMeetingResponse(Response.json({ error: "Unauthorized" }, { status: 401 })))
      .rejects.toThrow("Sign in again")
    const response = new Response("<html>Sign in</html>", { headers: { "Content-Type": "text/html" } })
    Object.defineProperty(response, "redirected", { value: true })
    await expect(readMeetingResponse(response)).rejects.toThrow("Sign in again")
  })
  it.each([200, 502])("does not treat non-JSON responses as confirmed writes (HTTP %s)", async (status) => {
    await expect(readMeetingResponse(new Response("Unexpected", { status }))).rejects.toThrow(`HTTP ${status}`)
  })
  it.each([null, [], "ok"])("rejects invalid JSON payload shapes (%j)", async (value) => {
    await expect(readMeetingResponse(Response.json(value))).rejects.toThrow("invalid response")
  })
})
