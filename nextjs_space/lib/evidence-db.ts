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
// the application database, and the shared client is reused. This keeps local and
// test environments working without a second database, and lets the isolated
// production evidence database be introduced by configuration alone.

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

/** The client that owns the evidence schema. Dedicated when configured, else shared. */
export function evidenceDb(): PrismaClient {
  const url = process.env.EVIDENCE_DATABASE_URL?.trim()
  if (url) return dedicatedClient(url)
  return prisma
}

/** True when evidence lives in its own isolated database. */
export function evidenceDbIsolated(): boolean {
  return Boolean(process.env.EVIDENCE_DATABASE_URL?.trim())
}
