import "server-only"

import type { Container, SqlQuerySpec } from "@azure/cosmos"

export type PageOptions = {
  page?: number
  pageSize?: number
}

export type PaginatedResult<T> = {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

export type ContinuationPageResult<T> = {
  items: T[]
  continuationToken?: string
  maxItemCount: number
}

export function normalizePageOptions(options?: PageOptions, defaults?: { defaultPageSize?: number; maxPageSize?: number }) {
  const maxPageSize = defaults?.maxPageSize ?? 100
  const defaultPageSize = defaults?.defaultPageSize ?? 25
  const page = Number.isFinite(options?.page) ? Math.max(1, Math.floor(options!.page as number)) : 1
  const pageSize = Number.isFinite(options?.pageSize)
    ? Math.max(1, Math.min(maxPageSize, Math.floor(options!.pageSize as number)))
    : defaultPageSize

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  }
}

export function buildPaginatedResult<T>(items: T[], totalCount: number, page: number, pageSize: number): PaginatedResult<T> {
  const safeTotalCount = Math.max(0, totalCount)
  const totalPages = Math.max(1, Math.ceil(safeTotalCount / pageSize))

  return {
    items,
    page,
    pageSize,
    totalCount: safeTotalCount,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  }
}

export async function fetchQueryPageWithContinuation<T>(
  container: Container,
  querySpec: SqlQuerySpec,
  options?: {
    continuationToken?: string
    maxItemCount?: number
  },
): Promise<ContinuationPageResult<T>> {
  const maxItemCount = Math.max(1, Math.min(options?.maxItemCount ?? 50, 200))
  const iterator = container.items.query<T>(querySpec, {
    maxItemCount,
    continuationToken: options?.continuationToken,
  })
  const { resources, continuationToken } = await iterator.fetchNext()

  return {
    items: resources,
    continuationToken: continuationToken ?? undefined,
    maxItemCount,
  }
}

export async function fetchAllQueryInBatches<T>(
  container: Container,
  querySpec: SqlQuerySpec,
  options?: {
    maxItemCount?: number
  },
): Promise<T[]> {
  const maxItemCount = Math.max(1, Math.min(options?.maxItemCount ?? 200, 500))
  const items: T[] = []
  let continuationToken: string | undefined

  do {
    const iterator = container.items.query<T>(querySpec, {
      maxItemCount,
      continuationToken,
    })
    const { resources, continuationToken: nextContinuationToken } = await iterator.fetchNext()
    items.push(...resources)
    continuationToken = nextContinuationToken ?? undefined
  } while (continuationToken)

  return items
}
