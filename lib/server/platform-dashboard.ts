import "server-only"

import type { Container } from "@azure/cosmos"

import {
  getApplicationsContainer,
  getCasesContainer,
  getMaintenanceContainer,
  getPropertiesContainer,
  getUsersContainer,
} from "@/lib/server/cosmos"

export type PlatformCount = {
  label: string
  count: number
}

export type PlatformEntitySummary = {
  total: number
  statuses: PlatformCount[]
}

export type PlatformDashboardSummary = {
  accounts: {
    total: number
    roles: PlatformCount[]
    approvalStatuses: PlatformCount[]
  }
  properties: PlatformEntitySummary
  applications: PlatformEntitySummary
  maintenanceIssues: PlatformEntitySummary
  cases: PlatformEntitySummary
}

type GroupedCount = {
  [field: string]: string | undefined
}

type FieldName = "role" | "approval_status" | "status"

function normalizeCounts(rows: GroupedCount[], field: FieldName, total: number): PlatformCount[] {
  const counts = new Map<string, number>()

  for (const row of rows) {
    const label = row[field]?.trim() || "Not set"
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }

  const projectedTotal = [...counts.values()].reduce((sum, count) => sum + count, 0)
  if (total > projectedTotal) {
    counts.set("Not set", (counts.get("Not set") ?? 0) + total - projectedTotal)
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
}

async function getEntitySummary(container: Container, field: FieldName): Promise<PlatformEntitySummary> {
  const { resources } = await container.items.query<GroupedCount>({
    query: `SELECT c.${field} FROM c`,
  }).fetchAll()

  return {
    total: resources.length,
    statuses: normalizeCounts(resources, field, resources.length),
  }
}

export async function getPlatformDashboardSummary(): Promise<PlatformDashboardSummary> {
  const [users, properties, applications, maintenance, cases] = await Promise.all([
    getUsersContainer(),
    getPropertiesContainer(),
    getApplicationsContainer(),
    getMaintenanceContainer(),
    getCasesContainer(),
  ])

  const [accounts, propertySummary, applicationSummary, maintenanceSummary, caseSummary] =
    await Promise.all([
      users.items.query<GroupedCount>({
        query: "SELECT c.role, c.approval_status FROM c",
      }).fetchAll(),
      getEntitySummary(properties, "status"),
      getEntitySummary(applications, "status"),
      getEntitySummary(maintenance, "status"),
      getEntitySummary(cases, "status"),
    ])
  const accountTotal = accounts.resources.length

  return {
    accounts: {
      total: accountTotal,
      roles: normalizeCounts(accounts.resources, "role", accountTotal),
      approvalStatuses: normalizeCounts(accounts.resources, "approval_status", accountTotal),
    },
    properties: propertySummary,
    applications: applicationSummary,
    maintenanceIssues: maintenanceSummary,
    cases: caseSummary,
  }
}
