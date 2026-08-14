import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import PropertyCompliancePanel, { buildComplianceSummaryRows } from "./PropertyCompliancePanel"

describe("buildComplianceSummaryRows", () => {
  it("includes the standard renewal rules and keeps matching compliance dates", () => {
    const rows = buildComplianceSummaryRows({
      id: "property-1",
      ownerId: "owner-1",
      address: "123 Test Street",
      addressLine1: "123 Test Street",
      addressLine2: "",
      city: "Leeds",
      postcode: "LS1 1AA",
      type: "Flat",
      status: "Available",
      monthlyRent: 1200,
      bedrooms: 2,
      bathrooms: 1,
      affordabilityMultiple: 2.5,
      shortDescription: "",
      longDescription: "",
      images: [],
      compliance: [
        {
          id: "comp-1",
          type: "gas",
          lastCheckedDate: "2025-07-01",
          expirationDate: "2026-07-01",
          certificateNumber: "GAS-001",
          provider: "Gas Safe",
          documentUrl: "https://example.com/gas.pdf",
          notes: "",
        },
      ],
    } as any)

    expect(rows[0].type).toBe("electrical")
    expect(rows[0].renewalLabel).toBe("Every 5 years")
    expect(rows[1].type).toBe("gas")
    expect(rows[1].done).toBe("2025-07-01")
    expect(rows[1].due).toBe("2026-07-01")
    expect(rows[1].uploadUrl).toBe("https://example.com/gas.pdf")
  })

  it("renders an upload action for compliance evidence", () => {
    const html = renderToStaticMarkup(
      React.createElement(PropertyCompliancePanel, {
        property: {
          id: "property-1",
          ownerId: "owner-1",
          address: "123 Test Street",
          addressLine1: "123 Test Street",
          addressLine2: "",
          city: "Leeds",
          postcode: "LS1 1AA",
          type: "Flat",
          status: "Available",
          monthlyRent: 1200,
          bedrooms: 2,
          bathrooms: 1,
          affordabilityMultiple: 2.5,
          shortDescription: "",
          longDescription: "",
          images: [],
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
          compliance: [],
        } as any,
        canManage: true,
        onPropertyUpdate: () => undefined,
      }),
    )

    expect(html).toContain("Upload certificate")
  })
})
