import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Evidence data can live in a dedicated database that is fully isolated from the
// primary application database (for example a pgvector-capable Neon instance).
//
// When EVIDENCE_DATABASE_URL is set, every evidence read/write goes to that
// database through a separate client. The primary application database is never
// pointed at the evidence schema, and the evidence migrations are never applied
// to the application database.
//
// When EVIDENCE_DATABASE_URL is unset the evidence tables are expected to live in
// the application database, and the shared client is reused. This shared mode is
// deliberately restricted to non-production (local dev + tests) so it can never
// happen silently in a deployed environment. In production a missing
// EVIDENCE_DATABASE_URL is a configuration error: the evidence database is
// reported unavailable rather than quietly falling back to the application
// database. The isolated production evidence database is introduced by
// configuration alone.

const globalForEvidence = globalThis as unknown as { evidencePrisma?: PrismaClient }

function dedicatedClient(url: string): PrismaClient {
  if (!globalForEvidence.evidencePrisma) {
    globalForEvidence.evidencePrisma = new PrismaClient({
      datasources: { db: { url } },
      log: ['error'],
    })
  }
  return globalForEvidence.evidencePrisma
}

/**
 * The client that owns the evidence schema.
 *  - EVIDENCE_DATABASE_URL set        → dedicated isolated evidence client.
 *  - unset and NOT production         → shared application client (explicit
 *                                       dev/test mode only).
 *  - unset and production             → throws; the evidence database is
 *                                       unavailable and must never fall back to
 *                                       the application database.
 */
export function evidenceDb(): PrismaClient {
  const url = process.env.EVIDENCE_DATABASE_URL?.trim()
  if (url) return dedicatedClient(url)
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Evidence database unavailable: EVIDENCE_DATABASE_URL is not configured. ' +
      'Refusing to fall back to the application database in production.',
    )
  }
  return prisma
}

/** True when evidence lives in its own isolated database. */
export function evidenceDbIsolated(): boolean {
  return Boolean(process.env.EVIDENCE_DATABASE_URL?.trim())
}

/**
 * Disconnect the dedicated evidence client if one was created. Safe to call in a
 * script's finally block: it never touches the shared application client (that is
 * owned by the application), and is a no-op in shared dev/test mode.
 */
export async function disconnectEvidenceDb(): Promise<void> {
  if (globalForEvidence.evidencePrisma) {
    await globalForEvidence.evidencePrisma.$disconnect()
    globalForEvidence.evidencePrisma = undefined
  }
}
