export type GuestResult = { task: 'guest-discovery'; useful: boolean; previouslyKnown: boolean; placeId: string; elapsedSeconds: number }
export type ProfessionalResult = { task: 'evidence-check'; manualSeconds: number; assistedSeconds: number; manualCorrect: number; assistedCorrect: number; checks: number; order: 'manual-first' | 'assisted-first' }
export type StudyResult = GuestResult | ProfessionalResult
const duration = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 86400
export function validateStudy(value: unknown): StudyResult {
  if (!value || typeof value !== 'object') throw new Error('Complete the study fields.')
  const r = value as StudyResult
  if (r.task === 'guest-discovery') {
    if (typeof r.useful !== 'boolean' || typeof r.previouslyKnown !== 'boolean' || typeof r.placeId !== 'string' || !/^place:[a-z0-9-]{1,80}$/.test(r.placeId) || !duration(r.elapsedSeconds)) throw new Error('Invalid guest study result.')
    return { task: r.task, useful: r.useful, previouslyKnown: r.previouslyKnown, placeId: r.placeId, elapsedSeconds: r.elapsedSeconds }
  }
  if (r.task !== 'evidence-check' || !duration(r.manualSeconds) || !duration(r.assistedSeconds) || !Number.isInteger(r.checks) || r.checks < 1 || r.checks > 100 ||
    ![r.manualCorrect, r.assistedCorrect].every(n => Number.isInteger(n) && n >= 0 && n <= r.checks) || !['manual-first', 'assisted-first'].includes(r.order)) throw new Error('Enter valid times and reviewed accuracy counts.')
  return { task: r.task, manualSeconds: r.manualSeconds, assistedSeconds: r.assistedSeconds, manualCorrect: r.manualCorrect, assistedCorrect: r.assistedCorrect, checks: r.checks, order: r.order }
}
const median = (ns: number[]) => { const a = [...ns].sort((a, b) => a - b); return a.length ? (a[Math.floor((a.length - 1) / 2)] + a[Math.floor(a.length / 2)]) / 2 : null }
export function summariseStudy(values: unknown[]) {
  const valid = values.map(validateStudy)
  const guests = valid.filter((r): r is GuestResult => r.task === 'guest-discovery')
  const professional = valid.filter((r): r is ProfessionalResult => r.task === 'evidence-check')
  const newUseful = guests.filter(r => r.useful && !r.previouslyKnown).length
  const saving = median(professional.map(r => 100 * (r.manualSeconds - r.assistedSeconds) / r.manualSeconds))
  return { guestTasks: guests.length, newUsefulDiscoveries: newUseful, newUsefulRate: guests.length ? newUseful / guests.length : null,
    professionalPairs: professional.length, medianTimeSavingPercent: saving,
    accuracyMaintained: professional.length ? professional.every(r => r.assistedCorrect >= r.manualCorrect) : null,
    initialGateMet: professional.length >= 3 && saving !== null && saving >= 30 && professional.every(r => r.assistedCorrect >= r.manualCorrect),
  }
}
