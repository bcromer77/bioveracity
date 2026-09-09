import assert from 'node:assert/strict'
import test from 'node:test'
import { prisma } from '../lib/prisma'
import { receiveEvidence } from '../lib/evidence-store'

test('identical-content retry preserves version ordering and applies a new access warning', async () => {
  const original = prisma.$transaction
  const updates: any[] = []
  prisma.$transaction = (async (fn: any) => fn({
    $executeRaw: async () => 1,
    evidenceDocument: {
      findUnique: async () => ({ id: 'old', status: 'VERIFIED', observedAt: new Date('2025-01-01') }),
      update: async (args: any) => { updates.push(args); return args.data },
    },
  })) as any
  const input = {
    url: 'https://example.org/fixture', title: 'Synthetic fixture', publisher: 'Fixture',
    authority_id: 'fixture', jurisdiction: 'Fixture', content_kind: 'source_excerpt',
    retrieved_at: '2026-01-01T00:00:00Z', sections: [{ locator: 'p1', text: 'Synthetic text.' }],
  }
  try {
    await receiveEvidence(input)
    assert.equal(updates.length, 0, 'a retry cannot make old content the newest version')
    await receiveEvidence({ ...input, sensitivity: 'restricted' })
    assert.deepEqual(updates[0].data, { incomingSensitivity: 'restricted', sensitivity: 'RESTRICTED', reusePermission: 'PROHIBITED' })
  } finally { prisma.$transaction = original }
})
