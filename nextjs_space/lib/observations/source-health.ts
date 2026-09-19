export type SourceHealthState = 'HEALTHY' | 'PARTIAL' | 'FAILED' | 'NOT_RUN' | 'DISABLED'

export type SourceTrainId =
  | 'wild-field-journal'
  | 'cambridgeshire-gbif'
  | 'natural-england-sssi'
  | 'environment-agency-rainfall'

export interface SourceTrainDefinition {
  id: SourceTrainId
  label: string
  mode: 'event-driven' | 'snapshot' | 'on-demand'
  purpose: string
  authoritativeFor: string
  notAuthoritativeFor: string
}

export interface SourceHealthReceipt {
  sourceId: SourceTrainId
  state: SourceHealthState
  lastAttemptedAt: string | null
  lastSuccessfulAt: string | null
  inspected: number | null
  accepted: number | null
  coverageNote: string
  failureReason: string | null
  sourceVersion: string | null
  nextScheduledAt: string | null
}

export const SOURCE_TRAINS: Record<SourceTrainId, SourceTrainDefinition> = {
  'wild-field-journal': {
    id: 'wild-field-journal',
    label: 'Wild Field Journal',
    mode: 'event-driven',
    purpose: 'Capture visitor/community observations at a place.',
    authoritativeFor: 'What a contributor submitted and when BioVeracity received it.',
    notAuthoritativeFor: 'Species verification, abundance, ecological absence or causation.',
  },
  'cambridgeshire-gbif': {
    id: 'cambridgeshire-gbif',
    label: 'Cambridgeshire biological occurrences',
    mode: 'snapshot',
    purpose: 'Acquire licensed occurrence records for defined Cambridgeshire queries.',
    authoritativeFor: 'The upstream occurrence representation retained from the selected dataset.',
    notAuthoritativeFor: 'Complete local biodiversity, independent confirmation or population size.',
  },
  'natural-england-sssi': {
    id: 'natural-england-sssi',
    label: 'Natural England SSSI boundaries',
    mode: 'snapshot',
    purpose: 'Provide official protected-site spatial context.',
    authoritativeFor: 'Published SSSI identity and boundary representation for the queried source version.',
    notAuthoritativeFor: 'Site condition, ownership, hydrological connectivity or causation.',
  },
  'environment-agency-rainfall': {
    id: 'environment-agency-rainfall',
    label: 'Environment Agency rainfall',
    mode: 'on-demand',
    purpose: 'Provide named-station rainfall measurements with provider quality metadata.',
    authoritativeFor: 'The returned station measurement and provider metadata.',
    notAuthoritativeFor: 'A site or catchment rainfall estimate unless a documented spatial relationship is established.',
  },
}

export function healthReceipt(input: SourceHealthReceipt): SourceHealthReceipt {
  if (!input.coverageNote.trim()) throw new Error('coverageNote is required')
  if (input.state === 'HEALTHY' && !input.lastSuccessfulAt) throw new Error('Healthy source needs a successful run time')
  if (input.state === 'FAILED' && !input.failureReason) throw new Error('Failed source needs a failure reason')
  for (const value of [input.inspected, input.accepted]) {
    if (value != null && (!Number.isInteger(value) || value < 0)) throw new Error('Source counts must be non-negative integers')
  }
  if (input.inspected != null && input.accepted != null && input.accepted > input.inspected) {
    throw new Error('accepted cannot exceed inspected')
  }
  return input
}
