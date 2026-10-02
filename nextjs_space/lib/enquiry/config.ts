// Public, client-safe enquiry vocabulary. Contains NO recipient or provider details:
// the browser only ever knows "submit to BioVeracity" via /api/enquiry.

export const ENQUIRY_SOURCES = {
  home: {
    label: 'Homepage',
    eyebrow: 'Tell us about your place',
    heading: 'Tell us about your place.',
    intro: 'Tell us which place you are responsible for and what you would like to notice or understand about it. We will reply to arrange a conversation.',
    defaultType: 'place',
  },
  evidence: {
    label: 'Professional evidence',
    eyebrow: 'Discuss an evidence question',
    heading: 'Discuss an evidence question.',
    intro: 'Describe the question, the place it concerns and the evidence you already have. A short note is enough to start.',
    defaultType: 'evidence',
  },
  bng: {
    label: 'BNG',
    eyebrow: 'Show us one BNG site',
    heading: 'Show us one BNG site.',
    intro: 'Give us a baseline, HMMP or monitoring report. See what the site’s long-term evidence record could look like.',
    defaultType: 'land',
  },
  'uk-srs': {
    label: 'UK SRS',
    eyebrow: 'Show us one disclosure',
    heading: 'Show us one disclosure.',
    intro: 'Send us one sustainability disclosure or target. See what its evidence record could look like.',
    defaultType: 'reporting',
  },
  csrd: {
    label: 'CSRD / ESRS',
    eyebrow: 'Map one reported matter',
    heading: 'Map one reported matter.',
    intro: 'Tell us about one reported matter. See how its evidence chain — target, metric, site and source — could be traced.',
    defaultType: 'reporting',
  },
} as const

export type EnquirySource = keyof typeof ENQUIRY_SOURCES

export const ENQUIRY_TYPES = {
  place: 'A place I run or care for',
  land: 'Land, development or BNG',
  evidence: 'Environmental evidence or an investigation',
  reporting: 'Sustainability reporting (UK SRS, CSRD / ESRS)',
  other: 'Something else',
} as const

export type EnquiryType = keyof typeof ENQUIRY_TYPES

// Every CTA that leads to the enquiry form. The id travels with the enquiry so
// the reply can start from the exact question the visitor raised their hand on.
export const ENQUIRY_CTAS = {
  'home-tell-us': { source: 'home', label: 'Tell us about your place' },
  'evidence-question': { source: 'evidence', label: 'Discuss an evidence question' },
  'evidence-record': { source: 'evidence', label: 'See what your evidence record could look like' },
  'bng-hero': { source: 'bng', label: 'Show us one BNG site (hero)' },
  'bng-chronology': { source: 'bng', label: 'Show us one BNG site (after chronology)' },
  'bng-end': { source: 'bng', label: 'Show us one BNG site (page end)' },
  'srs-hero': { source: 'uk-srs', label: 'Show us one disclosure (hero)' },
  'srs-chain': { source: 'uk-srs', label: 'Show us one disclosure (after evidence chain)' },
  'srs-end': { source: 'uk-srs', label: 'Show us one disclosure (page end)' },
  'csrd-hero': { source: 'csrd', label: 'Map one reported matter (hero)' },
  'csrd-end': { source: 'csrd', label: 'Map one reported matter (page end)' },
} as const satisfies Record<string, { source: EnquirySource; label: string }>

export type EnquiryCta = keyof typeof ENQUIRY_CTAS

export function isEnquirySource(v: unknown): v is EnquirySource {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(ENQUIRY_SOURCES, v)
}

export function isEnquiryCta(v: unknown): v is EnquiryCta {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(ENQUIRY_CTAS, v)
}

// Normalise untrusted query/body context. Unknown values fall back to the homepage
// context; a CTA is kept only when it belongs to the resolved source.
export function resolveEnquiryContext(source: unknown, cta: unknown): { source: EnquirySource; cta: EnquiryCta | null } {
  const s: EnquirySource = isEnquirySource(source) ? source : isEnquiryCta(cta) ? ENQUIRY_CTAS[cta].source : 'home'
  const c = isEnquiryCta(cta) && ENQUIRY_CTAS[cta].source === s ? cta : null
  return { source: s, cta: c }
}

export function enquiryHref(cta: EnquiryCta): string {
  return `/enquire?source=${ENQUIRY_CTAS[cta].source}&cta=${cta}`
}

export const ENQUIRY_LIMITS = { name: 120, email: 254, organisation: 160, message: 2000, body: 8000 } as const
