// BioVeracity 5-state evidence taxonomy (v2)
//   ● Verified Record          (R, P)  — regulator / statutory / planning record
//   ◐ Official / Operator      (G, O)  — government or operator statement
//   ○ Public / Community       (C, M)  — community or media report
//   △ BioVeracity Analysis     (A)     — analytical inference
//   □ Evidence Gap             (U)     — the record is silent / unknown

export type EvidenceClass = 'R' | 'P' | 'G' | 'O' | 'C' | 'M' | 'A' | 'U'

export type EvidenceState =
  | 'verified'
  | 'official'
  | 'public'
  | 'analysis'
  | 'gap'

export interface EvidenceMeta {
  symbol: string
  label: string
  state: EvidenceState
  description: string
  cssClass: string
}

export const EVIDENCE_TAXONOMY: Record<EvidenceClass, EvidenceMeta> = {
  R: {
    symbol: '●',
    label: 'Verified Record',
    state: 'verified',
    description: 'Confirmed regulator or statutory monitoring evidence',
    cssClass: 'evidence-verified',
  },
  P: {
    symbol: '●',
    label: 'Verified Record',
    state: 'verified',
    description: 'Confirmed planning or consent record',
    cssClass: 'evidence-verified',
  },
  G: {
    symbol: '◐',
    label: 'Official Statement',
    state: 'official',
    description: 'Government policy, programme or official record',
    cssClass: 'evidence-corroborated',
  },
  O: {
    symbol: '◐',
    label: 'Operator Statement',
    state: 'official',
    description: 'Operator assertion or operational disclosure',
    cssClass: 'evidence-corroborated',
  },
  C: {
    symbol: '○',
    label: 'Community Report',
    state: 'public',
    description: 'Community, stakeholder or allegation record — evidence of concern, not proof',
    cssClass: 'evidence-unverified',
  },
  M: {
    symbol: '○',
    label: 'Media Report',
    state: 'public',
    description: 'Media-reported information',
    cssClass: 'evidence-unverified',
  },
  A: {
    symbol: '△',
    label: 'BioVeracity Analysis',
    state: 'analysis',
    description: 'Analytical inference drawn across the record',
    cssClass: 'evidence-inference',
  },
  U: {
    symbol: '□',
    label: 'Evidence Gap',
    state: 'gap',
    description: 'The record is silent — this is a known unknown, not an answer',
    cssClass: 'evidence-gap',
  },
}

// Ordered list for legends / filters
export const EVIDENCE_STATES: EvidenceClass[] = ['R', 'G', 'C', 'A', 'U']

export function getEvidenceDisplay(classCode: string): EvidenceMeta {
  const code = classCode?.split('/')?.[0]?.trim()?.toUpperCase() as EvidenceClass
  return EVIDENCE_TAXONOMY[code] ?? EVIDENCE_TAXONOMY['A']
}
