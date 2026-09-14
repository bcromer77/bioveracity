// Per-process pacing, not a distributed quota. No query text or coordinates stored.
const active = new Set<string>()
const recent = new Map<string, number>()
export class HoneycombBusy extends Error {}
export async function withHoneycombSlot<T>(caseId: string, operation: () => Promise<T>): Promise<T> {
  const now = Date.now()
  for (const [id, time] of recent) if (now - time > 5000) recent.delete(id)
  if (active.has(caseId) || active.size >= 8 || recent.has(caseId))
    throw new HoneycombBusy('Please wait a few seconds before searching again.')
  active.add(caseId)
  recent.set(caseId, now)
  try {
    return await operation()
  } finally {
    active.delete(caseId)
  }
}
