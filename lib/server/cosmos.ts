import "server-only"

import { DefaultAzureCredential } from "@azure/identity"
import { CosmosClient, type Container, type Database } from "@azure/cosmos"

declare global {
  var __rentsimpleCosmosClient: CosmosClient | undefined
  var __rentsimpleCosmosDatabase: Promise<Database> | undefined
  var __rentsimpleCosmosContainers: Map<string, Promise<Container>> | undefined
}

const endpoint = process.env.COSMOSDB_ENDPOINT?.trim() ?? ""
const key = process.env.COSMOSDB_KEY?.trim() ?? ""
const databaseId = process.env.COSMOSDB_DATABASE?.trim() || "rentsimple"
const usersContainerId = process.env.COSMOSDB_USERS_CONTAINER?.trim() || "users"
const propertiesContainerId = process.env.COSMOSDB_PROPERTIES_CONTAINER?.trim() || "properties"
const applicationsContainerId = process.env.COSMOSDB_APPLICATIONS_CONTAINER?.trim() || "applications"

function createCosmosClient() {
  if (!endpoint) {
    throw new Error("COSMOSDB_ENDPOINT is not configured.")
  }

  if (key) {
    return new CosmosClient({ endpoint, key })
  }

  return new CosmosClient({
    endpoint,
    aadCredentials: new DefaultAzureCredential(),
  })
}

function getCosmosClient() {
  if (!globalThis.__rentsimpleCosmosClient) {
    globalThis.__rentsimpleCosmosClient = createCosmosClient()
  }

  return globalThis.__rentsimpleCosmosClient
}

async function getDatabase() {
  if (!globalThis.__rentsimpleCosmosDatabase) {
    globalThis.__rentsimpleCosmosDatabase = (async () => {
      const client = getCosmosClient()
      const { database } = await client.databases.createIfNotExists({ id: databaseId })
      return database
    })()
  }

  return globalThis.__rentsimpleCosmosDatabase
}

function isAlreadyExistsError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 409
}

async function createContainerIfNeeded(definition: {
  id: string
  partitionKeyPath: string
}) {
  if (!globalThis.__rentsimpleCosmosContainers) {
    globalThis.__rentsimpleCosmosContainers = new Map<string, Promise<Container>>()
  }

  const cacheKey = `${definition.id}:${definition.partitionKeyPath}`
  const cachedContainer = globalThis.__rentsimpleCosmosContainers.get(cacheKey)

  if (cachedContainer) {
    return cachedContainer
  }

  const containerPromise = (async () => {
    const database = await getDatabase()

    try {
      const { container } = await database.containers.createIfNotExists({
        id: definition.id,
        partitionKey: { paths: [definition.partitionKeyPath] },
      })

      return container
    } catch (error) {
      if (!isAlreadyExistsError(error)) {
        throw error
      }

      const container = database.container(definition.id)
      await container.read()
      return container
    }
  })()

  globalThis.__rentsimpleCosmosContainers.set(cacheKey, containerPromise)

  try {
    return await containerPromise
  } catch (error) {
    globalThis.__rentsimpleCosmosContainers.delete(cacheKey)
    throw error
  }
}

export async function getUsersContainer(): Promise<Container> {
  return createContainerIfNeeded({
    id: usersContainerId,
    partitionKeyPath: "/id",
  })
}

export async function getPropertiesContainer(): Promise<Container> {
  return createContainerIfNeeded({
    id: propertiesContainerId,
    partitionKeyPath: "/ownerId",
  })
}

export async function getApplicationsContainer(): Promise<Container> {
  return createContainerIfNeeded({
    id: applicationsContainerId,
    partitionKeyPath: "/applicantId",
  })
}