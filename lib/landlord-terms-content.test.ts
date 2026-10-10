import { describe, expect, it } from "vitest"

import { buildLandlordTerms, type LandlordTermsContext, type LandlordTermsSection } from "./landlord-terms-content"

const landlord: LandlordTermsContext["landlord"] = {
  first_name: "Jane",
  last_name: "Smith",
  email: "jane@example.com",
  mobile: "07700 900123",
  landlordProfile: {
    addressLine1: "1 High Street",
    city: "Edinburgh",
    postcode: "EH1 1AA",
    registrationNumber: "123456/230/12345",
  } as LandlordTermsContext["landlord"]["landlordProfile"],
}

function allText(sections: LandlordTermsSection[]) {
  return sections
    .flatMap((section) =>
      section.blocks.flatMap((block) =>
        block.type === "paragraph" ? [block.text] : block.type === "list" ? block.items : [...block.headers, ...block.rows.flat()],
      ),
    )
    .join("\n")
}

function scheduleOneRows(sections: LandlordTermsSection[]) {
  const block = sections.find((section) => section.id === "schedule-1")?.blocks[0]
  if (block?.type !== "table") throw new Error("Schedule 1 table missing")
  return block.rows
}

describe("buildLandlordTerms", () => {
  it("substitutes captured Landlord details", () => {
    const text = allText(buildLandlordTerms({ landlord, properties: [] }))

    expect(text).toContain(
      "**You, the Landlord:** Jane Smith, of 1 High Street, Edinburgh, EH1 1AA. Email: jane@example.com. Telephone: 07700 900123. Scottish Landlord Registration Number: 123456/230/12345.",
    )
    expect(text).not.toMatch(/\{\{\w+\}\}/)
  })

  it("falls back to bracketed placeholders when details are missing", () => {
    const text = allText(
      buildLandlordTerms({ landlord: { first_name: "", last_name: "", email: "x@example.com" } as LandlordTermsContext["landlord"] }),
    )

    expect(text).toContain("[full name of every owner], of [address]")
    expect(text).toContain("Telephone: [telephone]")
    expect(text).toContain("Registration Number: [number]")
  })

  it("builds one Schedule 1 row per property with formatted rent", () => {
    const rows = scheduleOneRows(
      buildLandlordTerms({
        landlord,
        properties: [
          { address: "", addressLine1: "2 Low Road", city: "Glasgow", postcode: "G1 1AA", monthlyRent: 950 },
          { address: "3 Side Lane, Perth", monthlyRent: undefined },
        ] as NonNullable<LandlordTermsContext["properties"]>,
      }),
    )

    expect(rows).toEqual([
      ["2 Low Road, Glasgow, G1 1AA", "[level]", "[date]", "£950.00 a month"],
      ["3 Side Lane, Perth", "[level]", "[date]", "[£] a month"],
    ])
  })

  it("shows a placeholder Schedule 1 row when there are no properties", () => {
    expect(scheduleOneRows(buildLandlordTerms({ landlord }))).toEqual([["[address]", "[level]", "[date]", "[£] a month"]])
  })
})