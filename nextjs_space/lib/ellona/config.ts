// Ellona Environmental Opportunity Watch — central configuration.
// ADDITIVE feature: everything here is namespaced and gated behind
// ELLONA_WATCH_ENABLED. No existing behaviour changes when the flag is off.

export const ELLONA = {
  orgName: 'Ellona',
  workspaceName: 'Ellona Environmental Opportunity Watch',
  contactName: 'Natalia Telliez',
  contactEmail: 'natalia.telliez@ellona.io',
  partnerRole: 'partner_member',
  originatorName: 'Bazil Cromer',
  originatorOrg: 'RippleXn',
  deliveryProduct: 'BioVeracity',
  territories: 'United Kingdom and Republic of Ireland',
  priorityGeography: 'Cambridge\u2013Peterborough',
  trialDays: 14,
  persona: 'ecology',
} as const

// The exact representation line that MUST appear on every opportunity page,
// email and PDF (brief §3 / §11 / §12).
export const REPRESENTATION_LINE =
  'Opportunity scouting originated by Bazil Cromer / RippleXn and delivered through BioVeracity.'

// Two distinct authenticated sender purposes (brief §3). These are the intended
// production identities; real sending is gated on DNS/provider verification and
// Bazil's explicit approval. In sandbox we only render, never send.
export const SENDERS = {
  alerts: {
    identity: 'Bazil Cromer | BioVeracity Opportunity Watch <alerts@bioveracity.com>',
    address: 'alerts@bioveracity.com',
  },
  accounts: {
    identity: 'BioVeracity Accounts <accounts@bioveracity.com>',
    address: 'accounts@bioveracity.com',
  },
} as const

export function ellonaEnabled(): boolean {
  return process.env.ELLONA_WATCH_ENABLED === 'true'
}

// Status labels (brief §6). No arbitrary reliability scores.
export const STATUS_LABELS = [
  'NEW',
  'UNDER REVIEW',
  'QUALIFIED',
  'FOLLOWING',
  'ACTION REQUIRED',
  'CLOSED',
  'SUPERSEDED',
  'NOT RELEVANT',
] as const

// Opportunity classifications (brief §8).
export const CLASSIFICATIONS = [
  'OPEN TENDER',
  'PRE-MARKET ENGAGEMENT',
  'FUNDED PROJECT',
  'PERMIT OR PLANNING OPPORTUNITY',
  'MONITORING NEED',
  'PARTNER OPPORTUNITY',
  'EARLY SIGNAL \u2014 REQUIRES QUALIFICATION',
  'CORRECTION OR DEADLINE CHANGE',
] as const

// Decision types for a customer-created Opportunity Assessment (latest brief).
export const DECISION_TYPES = ['BID', 'PARTNER', 'MONITOR', 'PASS', 'UNSURE'] as const
export type DecisionType = (typeof DECISION_TYPES)[number]

export const DECISION_LABELS: Record<DecisionType, string> = {
  BID: 'Bid',
  PARTNER: 'Partner',
  MONITOR: 'Monitor',
  PASS: 'Pass',
  UNSURE: 'Not sure yet',
}
