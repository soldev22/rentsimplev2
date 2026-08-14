import "server-only"

import type { AuthUser, PropertyRecord, TenancyApplicationRecord } from "@/lib/auth"
import { deletePropertyImageAssets } from "@/lib/server/blob"
import {
  getApplicationsContainer,
  getApplicationCommunicationsContainer,
  getAuditEventsContainer,
  getAuthSecurityContainer,
  getCaseMessagesContainer,
  getCasesContainer,
  getMaintenanceContainer,
  getPropertiesContainer,
  getUsersContainer,
} from "@/lib/server/cosmos"
import { fetchAllQueryInBatches } from "@/lib/server/pagination"

function assertAdmin(user: AuthUser) {
  if (user.role !== "admin") {
    throw new Error("Forbidden")
  }
}

async function deleteAllRecords<T extends Record<string, unknown>>(
  container: { item: (id: string, partitionKey: string) => { delete: () => Promise<unknown> } },
  records: T[],
  partitionKeyResolver: (record: T) => string | undefined,
) {
  await Promise.all(
    records.map((record) => {
      const id = typeof record.id === "string" ? record.id : ""
      const partitionKey = partitionKeyResolver(record) ?? id

      if (!id) {
        return Promise.resolve()
      }

      return container.item(id, partitionKey || id).delete()
    }),
  )

  return records.length
}

export async function resetWorkspaceForTesting(adminUser: AuthUser) {
  assertAdmin(adminUser)

  const adminEmail = adminUser.email.trim().toLowerCase()

  const [
    usersContainer,
    propertiesContainer,
    applicationsContainer,
    applicationCommunicationsContainer,
    auditEventsContainer,
    authSecurityContainer,
    maintenanceContainer,
    casesContainer,
    caseMessagesContainer,
  ] = await Promise.all([
    getUsersContainer(),
    getPropertiesContainer(),
    getApplicationsContainer(),
    getApplicationCommunicationsContainer(),
    getAuditEventsContainer(),
    getAuthSecurityContainer(),
    getMaintenanceContainer(),
    getCasesContainer(),
    getCaseMessagesContainer(),
  ])

  const [
    users,
    properties,
    applications,
    applicationCommunications,
    auditEvents,
    authSecurityRecords,
    maintenanceRecords,
    cases,
    caseMessages,
  ] = await Promise.all([
    fetchAllQueryInBatches<{ id: string; email?: string; role?: string }>(usersContainer, { query: "SELECT * FROM c" }),
    fetchAllQueryInBatches<PropertyRecord>(propertiesContainer, { query: "SELECT * FROM c" }),
    fetchAllQueryInBatches<TenancyApplicationRecord>(applicationsContainer, { query: "SELECT * FROM c" }),
    fetchAllQueryInBatches<Record<string, unknown>>(applicationCommunicationsContainer, { query: "SELECT * FROM c" }),
    fetchAllQueryInBatches<Record<string, unknown>>(auditEventsContainer, { query: "SELECT * FROM c" }),
    fetchAllQueryInBatches<Record<string, unknown>>(authSecurityContainer, { query: "SELECT * FROM c" }),
    fetchAllQueryInBatches<Record<string, unknown>>(maintenanceContainer, { query: "SELECT * FROM c" }),
    fetchAllQueryInBatches<Record<string, unknown>>(casesContainer, { query: "SELECT * FROM c" }),
    fetchAllQueryInBatches<Record<string, unknown>>(caseMessagesContainer, { query: "SELECT * FROM c" }),
  ])

  await Promise.all(
    properties.flatMap((property) => property.images.map((image) => deletePropertyImageAssets(image))),
  )

  const deletedUsers = await deleteAllRecords(
    usersContainer,
    users.filter((user) => !user.email || user.email.trim().toLowerCase() !== adminEmail),
    (user) => user.id || user.email,
  )

  const [
    deletedApplications,
    deletedApplicationCommunications,
    deletedAuditEvents,
    deletedAuthSecurityRecords,
    deletedMaintenanceRecords,
    deletedCases,
    deletedCaseMessages,
    deletedProperties,
  ] = await Promise.all([
    deleteAllRecords(applicationsContainer, applications, (application) => application.applicantId),
    deleteAllRecords(
      applicationCommunicationsContainer,
      applicationCommunications,
      (record) => String(record.applicationId ?? record.id ?? ""),
    ),
    deleteAllRecords(auditEventsContainer, auditEvents, (record) => String(record.entityKey ?? record.id ?? "")),
    deleteAllRecords(authSecurityContainer, authSecurityRecords, (record) => String(record.id ?? "")),
    deleteAllRecords(maintenanceContainer, maintenanceRecords, (record) => String(record.propertyId ?? record.id ?? "")),
    deleteAllRecords(casesContainer, cases, (record) => String(record.propertyId ?? record.id ?? "")),
    deleteAllRecords(caseMessagesContainer, caseMessages, (record) => String(record.caseId ?? record.id ?? "")),
    deleteAllRecords(propertiesContainer, properties, (property) => property.ownerId),
  ])

  return {
    deletedApplications,
    deletedProperties,
    deletedUsers,
    deletedApplicationCommunications,
    deletedAuditEvents,
    deletedAuthSecurityRecords,
    deletedMaintenanceRecords,
    deletedCases,
    deletedCaseMessages,
    preservedAdminUser: adminEmail,
  }
}