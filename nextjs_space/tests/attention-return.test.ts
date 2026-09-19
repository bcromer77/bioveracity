import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decideAttention } from '../lib/attention/service'

const pref = {
  actionEmail: true,
  importantChangeEmail: true,
  weeklyDigest: true,
  routineEmail: false,
  quietHoursStart: null,
  quietHoursEnd: null,
  timezone: null,
}

const base = {
  userId: 'u1',
  scopeKey: 'case:waterbeach',
  workspaceId: 'w1',
  caseId: 'c1',
  category: 'EVIDENCE_ARRIVED' as const,
  significance: 'ROUTINE' as const,
  requiresAction: false,
  title: 'Waterbeach changed',
  summary: 'New evidence is available.',
  actionPath: '/workspace/w1?case=c1',
  dedupeKey: 'event-1',
  occurredAt: new Date('2026-09-19T09:00:00Z'),
  metadata: {},
}

test('routine activity is quiet by default', () => {
  const d = decideAttention(base, pref, null)
  assert.equal(d.kind, 'DIGEST')
  if (d.kind === 'DIGEST') assert.match(d.reason, /weekly/)
})

test('important change can earn one interruption', () => {
  const d = decideAttention({ ...base, significance: 'IMPORTANT' }, pref, null)
  assert.equal(d.kind, 'EMAIL')
})

test('a second non-critical interruption inside 24 hours is bundled', () => {
  const previous = new Date('2026-09-19T08:00:00Z')
  const d = decideAttention({ ...base, significance: 'IMPORTANT' }, pref, previous)
  assert.equal(d.kind, 'DIGEST')
  if (d.kind === 'DIGEST') assert.ok(d.earliestAt.getTime() >= previous.getTime() + 24 * 60 * 60 * 1000)
})

test('action required respects user email preference', () => {
  const d = decideAttention({ ...base, significance: 'ACTION', requiresAction: true }, { ...pref, actionEmail: false }, null)
  assert.equal(d.kind, 'IN_PRODUCT')
})

test('critical security event bypasses the normal interruption budget', () => {
  const previous = new Date('2026-09-19T08:59:00Z')
  const d = decideAttention({ ...base, category: 'SECURITY', significance: 'CRITICAL' }, pref, previous)
  assert.equal(d.kind, 'EMAIL')
})

test('routine email preference never turns routine activity into an immediate blast', () => {
  const d = decideAttention(base, { ...pref, routineEmail: true }, null)
  assert.equal(d.kind, 'DIGEST')
})

test('external action URLs fail closed', () => {
  assert.throws(() => decideAttention({ ...base, actionPath: 'https://evil.example' }, pref, null))
})
