import { describe, expect, it } from "vitest"
import { adjacentDiaryDate, appointmentFields, diaryRange, isDiaryDate, londonInstant, validateAppointment } from "./diary"

describe("UK diary date and appointment validation", () => {
  it("converts UK summer/winter times without depending on the server time zone", () => {
    expect(londonInstant("2026-07-01", "10:00")).toBe("2026-07-01T09:00:00.000Z")
    expect(londonInstant("2026-12-01", "10:00")).toBe("2026-12-01T10:00:00.000Z")
    expect(appointmentFields("2026-07-01T23:30:00.000Z")).toEqual({ date: "2026-07-02", time: "00:30" })
    expect(appointmentFields("2026-12-01T00:00:00.000Z")).toEqual({ date: "2026-12-01", time: "00:00" })
  })
  it("rejects nonexistent and ambiguous UK clock-change times", () => {
    expect(londonInstant("2026-03-29", "01:30")).toBeNull()
    expect(londonInstant("2026-10-25", "01:30")).toBeNull()
    expect(londonInstant("2026-03-29", "02:30")).toBe("2026-03-29T01:30:00.000Z")
    expect(londonInstant("2026-10-25", "02:30")).toBe("2026-10-25T02:30:00.000Z")
  })
  it("normalizes appointments and excludes caller-supplied UTC/zone fields", () => {
    expect(validateAppointment({ date: "2026-10-12", startTime: "10:00", endTime: "10:30", location: " Office ", timeZone: "UTC", startAt: "forged" })).toEqual({
      startAt: "2026-10-12T09:00:00.000Z", endAt: "2026-10-12T09:30:00.000Z", timeZone: "Europe/London", location: "Office",
    })
  })
  it.each([
    null, [], {}, { date: "2026-02-30", startTime: "10:00", endTime: "11:00" },
    { date: "2026-10-12", startTime: "24:00", endTime: "11:00" },
    { date: "2026-10-12", startTime: "11:00", endTime: "10:00" },
    { date: "2026-10-12", startTime: "10:00", endTime: "10:00" },
    { date: "2026-10-12", startTime: "10:00", endTime: "11:00", location: 123 },
    { date: "2026-10-12", startTime: "10:00", endTime: "11:00", location: "a".repeat(501) },
  ])("rejects malformed or incomplete appointments (%j)", (value) => {
    expect(validateAppointment(value)).toBeNull()
  })
  it("constructs Monday-first weeks and half-open UK date ranges", () => {
    expect(diaryRange("2026-10-11", "week")).toEqual({
      first: "2026-10-05", last: "2026-10-12", startAt: "2026-10-04T23:00:00.000Z", endAt: "2026-10-11T23:00:00.000Z",
    })
    expect(diaryRange("2026-10-25", "day")).toMatchObject({ startAt: "2026-10-24T23:00:00.000Z", endAt: "2026-10-26T00:00:00.000Z" })
    expect(diaryRange("2026-10-11", "month")).toMatchObject({ first: "2026-10-01", last: "2026-11-01" })
    expect(diaryRange("2099-12-31", "month").endAt).toBe("2100-01-01T00:00:00.000Z")
  })
  it("handles month/year boundaries and leap years", () => {
    expect(adjacentDiaryDate("2026-01-31", "month", 1)).toBe("2026-02-01")
    expect(adjacentDiaryDate("2026-01-01", "month", -1)).toBe("2025-12-01")
    expect(isDiaryDate("2028-02-29")).toBe(true)
    expect(isDiaryDate("2026-02-29")).toBe(false)
    expect(isDiaryDate("bad")).toBe(false)
  })
})
