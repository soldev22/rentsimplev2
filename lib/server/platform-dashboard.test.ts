import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getUsersContainer: vi.fn(),
  getPropertiesContainer: vi.fn(),
  getApplicationsContainer: vi.fn(),
  getMaintenanceContainer: vi.fn(),
  getCasesContainer: vi.fn(),
  queries: [] as string[],
}))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/server/cosmos", () => ({
  getUsersContainer: mocks.getUsersContainer,
  getPropertiesContainer: mocks.getPropertiesContainer,
  getApplicationsContainer: mocks.getApplicationsContainer,
  getMaintenanceContainer: mocks.getMaintenanceContainer,
  getCasesContainer: mocks.getCasesContainer,
}))

import { getPlatformDashboardSummary } from "@/lib/server/platform-dashboard"

function createContainer(total: number, fields: Record<string, Array<string | undefined>>) {
  return {
    items: {
      query: ({ query }: { query: string }) => {
        mocks.queries.push(query)
        const fieldsInQuery = query.match(/^SELECT (.+) FROM c$/)?.[1]
        if (!fieldsInQuery) {
          throw new Error(`Unexpected platform dashboard query: ${query}`)
        }
        const selectedFields = fieldsInQuery.split(", ").map((selection) => {
          const field = selection.match(/^c\.(\w+)$/)?.[1]
          if (!field) throw new Error(`Unexpected platform dashboard projection: ${selection}`)
          return field
        })

        return {
          fetchAll: async () => ({
            resources: Array.from({ length: total }, (_, index) =>
              Object.fromEntries(selectedFields
                .map((field) => [field, fields[field]?.[index]])
                .filter(([, value]) => value !== undefined)),
            ),
          }),
        }
      },
    },
  }
}

describe("platform dashboard summary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.queries.length = 0
    mocks.getUsersContainer.mockResolvedValue(createContainer(4, {
      role: ["admin", "landlord", "applicant", undefined],
      approval_status: ["approved", "approved", "pending_approval", undefined],
    }))
    mocks.getPropertiesContainer.mockResolvedValue(createContainer(3, {
      status: ["Available", "Occupied", undefined],
    }))
    mocks.getApplicationsContainer.mockResolvedValue(createContainer(2, {
      status: ["submitted", "approved"],
    }))
    mocks.getMaintenanceContainer.mockResolvedValue(createContainer(2, {
      status: ["reported", "in_progress"],
    }))
    mocks.getCasesContainer.mockResolvedValue(createContainer(2, {
      status: ["open", "archived"],
    }))
  })

  it("counts records by projected status fields without GROUP BY queries", async () => {
    const summary = await getPlatformDashboardSummary()

    expect(summary.accounts).toEqual({
      total: 4,
      roles: [
        { label: "admin", count: 1 },
        { label: "applicant", count: 1 },
        { label: "landlord", count: 1 },
        { label: "Not set", count: 1 },
      ],
      approvalStatuses: [
        { label: "approved", count: 2 },
        { label: "Not set", count: 1 },
        { label: "pending_approval", count: 1 },
      ],
    })
    expect(summary.properties.statuses).toEqual([
      { label: "Available", count: 1 },
      { label: "Not set", count: 1 },
      { label: "Occupied", count: 1 },
    ])
    expect(summary.applications.statuses).toEqual([
      { label: "approved", count: 1 },
      { label: "submitted", count: 1 },
    ])
    expect(summary.maintenanceIssues.statuses).toEqual([
      { label: "in_progress", count: 1 },
      { label: "reported", count: 1 },
    ])
    expect(summary.cases.statuses).toEqual([
      { label: "archived", count: 1 },
      { label: "open", count: 1 },
    ])
    expect(mocks.queries.every((query) => !query.includes("GROUP BY"))).toBe(true)
  })
})
