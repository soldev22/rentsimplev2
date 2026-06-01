import "server-only"

import { DefaultAzureCredential } from "@azure/identity"
import { CosmosClient, type Container, type Database } from "@azure/cosmos"

declare global {
  var __rentsimpleCosmosClient: CosmosClient | undefined
  var __rentsimpleCosmosDatabase: Promise<Database> | undefined
}

const endpoint = process.env.COSMOSDB_ENDPOINT?.trim() ?? ""
const key = process.env.COSMOSDB_KEY?.trim() ?? ""
const databaseId = process.env.COSMOSDB_DATABASE?.trim() || "rentsimple"
const usersContainerId = process.env.COSMOSDB_USERS_CONTAINER?.trim() || "users"
const propertiesContainerId = process.env.COSMOSDB_PROPERTIES_CONTAINER?.trim() || "properties"

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

async function createContainerIfNeeded(definition: {
  id: string
  partitionKeyPath: string
}) {
  const database = await getDatabase()
  const { container } = await database.containers.createIfNotExists({
    id: definition.id,
    partitionKey: { paths: [definition.partitionKeyPath] },
  })

  return container
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