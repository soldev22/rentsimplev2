import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { normalizePropertyInput } = await import("./properties")

describe("normalizePropertyInput", () => {
  it("normalizes property metadata fields for parking, heating, council tax, and broadband", () => {
    const normalized = normalizePropertyInput({
      addressLine1: "1 Test Lane",
      city: "London",
      postcode: "SW1A 1AA",
      type: "Detached house",
      status: "Available",
      parking: "On Street",
      heating: "HeatPump",
      councilTaxBand: "C",
      broadbandAvailable: "yes",
    } as any)

    expect(normalized.parking).toBe("On Street")
    expect(normalized.heating).toBe("HeatPump")
    expect(normalized.councilTaxBand).toBe("C")
    expect(normalized.broadbandAvailable).toBe(true)
  })

  it("preserves the property nickname as a trimmed string", () => {
    const normalized = normalizePropertyInput({
      addressLine1: "1 Test Lane",
      city: "London",
      postcode: "SW1A 1AA",
      type: "Detached house",
      status: "Available",
      nickname: "  Riverside Flat  ",
    } as any)

    expect(normalized.nickname).toBe("Riverside Flat")
  })
})
