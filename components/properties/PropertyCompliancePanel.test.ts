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
    } as unknown as import("@/lib/auth").PropertyRecord)

    expect(rows[0].type).toBe("electrical")
    expect(rows[0].renewalLabel).toBe("Every 5 years")
    expect(rows[1].type).toBe("gas")
    expect(rows[1].done).toBe("2025-07-01")
    expect(rows[1].due).toBe("2026-07-01")
    expect(rows[1].uploadUrl).toBe("https://example.com/gas.pdf")
    expect(rows.find((row) => row.type === "smoke_alarm")?.renewalLabel).toBe("Every 1 year")
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
        } as unknown as import("@/lib/auth").PropertyRecord,
        canManage: true,
        onPropertyUpdate: () => undefined,
      }),
    )

    expect(html).toContain("Upload certificate")
    expect(html).toContain("Smoke and Heat Alarm Testing")
  })

  it("marks not-applicable requirements green and keeps every certificate in the archive", () => {
    const rows = buildComplianceSummaryRows({
      id: "property-1",
      compliance: [{
        id: "comp-1",
        type: "gas",
        lastCheckedDate: "",
        expirationDate: "",
        notApplicable: true,
        documents: [
          { url: "https://example.com/old.pdf", fileName: "old.pdf", uploadedAt: "2025-01-01" },
          { url: "https://example.com/current.pdf", fileName: "current.pdf", uploadedAt: "2026-01-01" },
        ],
      }],
    } as unknown as import("@/lib/auth").PropertyRecord)

    expect(rows[1].status).toBe("not_applicable")
    expect(rows[1].documents).toHaveLength(2)
  })

  it("adds PAT testing only when the property includes electrical items", () => {
    const property = {
      id: "property-1",
      compliance: [],
      includedItems: [{ id: "item-1", name: "Washing machine", isElectrical: true }],
    } as unknown as import("@/lib/auth").PropertyRecord

    expect(buildComplianceSummaryRows(property).some((row) => row.type === "pat_testing")).toBe(true)
    expect(buildComplianceSummaryRows({ ...property, includedItems: [] }).some((row) => row.type === "pat_testing")).toBe(false)
  })

  it("creates a separate PAT testing row for every electrical included item", () => {
    const rows = buildComplianceSummaryRows({
      id: "property-1",
      compliance: [],
      includedItems: [
        { id: "washer", name: "Washing machine", isElectrical: true },
        { id: "lamp", name: "Table lamp", isElectrical: true },
      ],
    } as unknown as import("@/lib/auth").PropertyRecord)

    expect(rows.filter((row) => row.type === "pat_testing").map((row) => row.label)).toEqual([
      "PAT Testing: Washing machine",
      "PAT Testing: Table lamp",
    ])
  })

  it("applies individual due-date color states to PAT testing rows", () => {
    const rows = buildComplianceSummaryRows({
      id: "property-1",
      compliance: [
        { id: "pat-1", type: "pat_testing", patItemId: "washer", lastCheckedDate: "", expirationDate: "2030-01-01" },
        { id: "pat-2", type: "pat_testing", patItemId: "lamp", lastCheckedDate: "", expirationDate: "2020-01-01" },
      ],
      includedItems: [
        { id: "washer", name: "Washing machine", isElectrical: true },
        { id: "lamp", name: "Table lamp", isElectrical: true },
      ],
    } as unknown as import("@/lib/auth").PropertyRecord)

    expect(rows.filter((row) => row.type === "pat_testing").map((row) => row.status)).toEqual(["green", "red"])
  })

  it("uses the same interval states for legionella and PAT testing", () => {
    const rows = buildComplianceSummaryRows({
      id: "property-1",
      compliance: [
        { id: "legionella", type: "legionella", lastCheckedDate: "", expirationDate: "2030-01-01" },
        { id: "pat", type: "pat_testing", patItemId: "washer", lastCheckedDate: "", expirationDate: "2026-09-30" },
      ],
      includedItems: [{ id: "washer", name: "Washing machine", isElectrical: true }],
    } as unknown as import("@/lib/auth").PropertyRecord)

    expect(rows.find((row) => row.type === "legionella")?.status).toBe("green")
    expect(rows.find((row) => row.type === "pat_testing")?.status).toBe("amber")
  })

  it("renders overdue PAT tests as red rather than due within 30 days", () => {
    const html = renderToStaticMarkup(
      React.createElement(PropertyCompliancePanel, {
        property: {
          id: "property-1",
          compliance: [{ id: "pat", type: "pat_testing", patItemId: "washer", lastCheckedDate: "2025-02-20", expirationDate: "2026-02-20" }],
          includedItems: [{ id: "washer", name: "Washing machine", isElectrical: true }],
        } as unknown as import("@/lib/auth").PropertyRecord,
        canManage: false,
        onPropertyUpdate: () => undefined,
      }),
    )

    expect(html).toContain("Overdue")
    expect(html).not.toContain("PAT Testing: Washing machine</div><div class=\"text-xs text-slate-600\">Every 1 year</div><span class=\"mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold bg-red-200 text-red-900\">Due within 30 days")
  })
})
