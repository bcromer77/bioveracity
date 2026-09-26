// ==========================================================================
// Developer Platform V1 — HTTP wiring (Prisma-backed).
//
// Adapts Prisma to the shared { Database } abstraction, constructs the service,
// and provides uniform response/error helpers. The route handlers stay thin.
// ==========================================================================

import { prisma } from '@/lib/prisma'
import type { Database, Sql } from '@/lib/workspaces/service'
import { PlatformError, internalError } from './errors'
import { platformService } from './service'
import { redactSecrets } from './keys'

// SQL strings are fixed in service.ts; all user values remain bound parameters.
export const adapter = (client: Pick<typeof prisma, '$queryRawUnsafe'>): Sql => ({
  query: <T>(sql: string, values: unknown[]) => client.$queryRawUnsafe<T[]>(sql, ...values),
})

export const platformDb: Database = {
  ...adapter(prisma),
  transaction: (operation) => prisma.$transaction((tx) => operation(adapter(tx)), { isolationLevel: 'Serializable' }),
}

export function getService() {
  return platformService(platformDb)
}

// The platform is gated so it can be merged and reviewed before exposure. It is
// off by default; nothing new becomes reachable in production without an
// explicit environment opt-in.
export function v1Enabled(): boolean {
  return process.env.DEVELOPER_PLATFORM_V1_ENABLED === 'true'
}

export const v1Headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}

export function jsonResponse(body: unknown, status: number, requestId: string): Response {
  return Response.json(body, { status, headers: { ...v1Headers, 'BioVeracity-Request-Id': requestId } })
}

// Convert any thrown value into the stable error envelope. Unknown errors are
// never leaked verbatim; only a redacted, generic message crosses the boundary.
export function toPlatformError(err: unknown): PlatformError {
  if (err instanceof PlatformError) return err
  return internalError()
}

export function errorResponse(err: unknown, requestId: string): Response {
  const platformErr = toPlatformError(err)
  return jsonResponse(platformErr.body(requestId), platformErr.status, requestId)
}

// Redacting logger — request-scoped, never emits credentials or raw secrets.
export function logRequestLine(requestId: string, message: string): void {
  // eslint-disable-next-line no-console
  console.log(`[v1] request_id=${requestId} ${redactSecrets(message)}`)
}
