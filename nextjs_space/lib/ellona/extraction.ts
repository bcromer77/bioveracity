// Schema-validated LLM extraction for the "Analyse your own opportunity" flow.
//
// The parser produces passages that each carry a precise, human-checkable
// locator. This module asks the model to populate a FIXED set of qualification
// fields, and then validates the model output so that:
//   * every field is one of the fixed keys (no invented fields),
//   * every SOURCE FACT carries a locator that actually exists in the parsed
//     passages (the model cannot invent a page/paragraph reference),
//   * anything not supported by the document is returned as an honest blank
//     (category UNKNOWN), never fabricated.
//
// Categories (brief): SOURCE FACT (verbatim/derived from the document),
// BIOVERACITY ANALYSIS (our interpretation), ELLONA INPUT (to be supplied by
// Natalia), UNKNOWN (not located in the document).

export const EXTRACTION_VERSION = 'ellona-extraction/1'

export type FieldCategory = 'SOURCE FACT' | 'BIOVERACITY ANALYSIS' | 'ELLONA INPUT' | 'UNKNOWN'

export type ExtractedField = {
  key: string
  label: string
  value: string
  category: FieldCategory
  locator: string | null
}

export type ExtractionResult = {
  version: string
  model: string
  fields: ExtractedField[]
  warnings: string[]
  passageCount: number
}

// The fixed qualification schema (order is the display order).
export const FIELD_SCHEMA: { key: string; label: string; hint: string }[] = [
  { key: 'buyer', label: 'Buyer / commissioning organisation', hint: 'Who is issuing or commissioning the work.' },
  { key: 'project_location', label: 'Project and location', hint: 'What the project is and where it is happening.' },
  { key: 'opportunity_type', label: 'Opportunity type', hint: 'Tender, funded project, permit, consultation, monitoring need, etc.' },
  { key: 'publication_date', label: 'Publication date', hint: 'When the document/opportunity was published.' },
  { key: 'deadlines', label: 'Clarification and submission deadlines', hint: 'Any stated dates/times for questions and submission.' },
  { key: 'value', label: 'Published contract value or budget', hint: 'Only if explicitly stated; note if it is a whole-contract value.' },
  { key: 'measurement_need', label: 'Environmental problem or measurement need', hint: 'The environmental uncertainty or monitoring requirement.' },
  { key: 'mandatory_requirements', label: 'Mandatory requirements', hint: 'Accreditations, standards, certifications, eligibility criteria.' },
  { key: 'deliverables', label: 'Expected deliverables', hint: 'What the supplier must deliver.' },
  { key: 'ellona_capabilities', label: 'Relevant Ellona capabilities', hint: 'BIOVERACITY ANALYSIS only — capabilities that may be relevant.' },
  { key: 'capability_evidence', label: 'Capability evidence available', hint: 'ELLONA INPUT — evidence Natalia can supply. Blank unless in document.' },
  { key: 'gaps', label: 'Eligibility / accreditation / experience gaps', hint: 'Gaps that could disqualify or require a partner.' },
  { key: 'partner_needs', label: 'Likely prime or specialist-partner needs', hint: 'Whether a prime or specialist partner is likely required.' },
  { key: 'clarification_questions', label: 'Questions requiring clarification', hint: 'Questions to ask the buyer before any deadline.' },
  { key: 'next_action', label: 'Recommended next action', hint: 'BIOVERACITY ANALYSIS — the single most useful next step.' },
]

const CATEGORIES: FieldCategory[] = ['SOURCE FACT', 'BIOVERACITY ANALYSIS', 'ELLONA INPUT', 'UNKNOWN']

const SYSTEM_PROMPT = `You are a careful qualification analyst for BioVeracity. You read a single public opportunity document that has been split into passages. Each passage has a LOCATOR (e.g. "Page 3", "Heading \u201cScope\u201d \u203a paragraph 2", "Table 1, row 4, cell 2", "row 12, column \u201cDeadline\u201d", "Lines 40\u201360").

You must return STRICT JSON only, no prose, matching:
{ "fields": [ { "key": <one of the provided keys>, "value": <string>, "category": <"SOURCE FACT"|"BIOVERACITY ANALYSIS"|"ELLONA INPUT"|"UNKNOWN">, "locator": <string copied EXACTLY from a passage locator, or null> } ] }

Rules:
- Return exactly one object per provided key, in the given order. Do not invent keys.
- SOURCE FACT: the value is stated in or directly derived from the document. You MUST set locator to the EXACT locator string of the passage the fact came from. Never guess a locator.
- BIOVERACITY ANALYSIS: your interpretation/assessment. locator may be null.
- ELLONA INPUT: something only Ellona (Natalia) can confirm/provide. Set value to a short instruction of what she should supply, category ELLONA INPUT, locator null — unless the document itself states it.
- UNKNOWN: not present in the document. value should say "Not located in the document." and locator null.
- Never fabricate a value, a number, a date, an accreditation or a relationship. If unsure, use UNKNOWN.
- Do not claim Ellona holds any accreditation or has any relationship with the buyer. Capability statements are BIOVERACITY ANALYSIS or ELLONA INPUT, never SOURCE FACT.
- If a published value appears, note in the value whether it is a whole-contract value.
Output JSON only.`

function buildUserPrompt(passages: { locator: string; text: string }[]): string {
  const keyList = FIELD_SCHEMA.map((f) => `- ${f.key}: ${f.label} — ${f.hint}`).join('\n')
  const body = passages
    .map((p, i) => `[[${i + 1}]] LOCATOR: ${p.locator}\n${p.text}`)
    .join('\n\n')
  return `KEYS (return one object per key, in this order):\n${keyList}\n\nDOCUMENT PASSAGES:\n${body}`
}

function stripCodeFence(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
}

type RawField = { key?: unknown; value?: unknown; category?: unknown; locator?: unknown }

/**
 * Validate the model output against the fixed schema and the set of real
 * locators. Any locator the model returns that is not a real passage locator is
 * dropped and the field is demoted to BIOVERACITY ANALYSIS with a warning, so a
 * fabricated reference can never reach the customer.
 */
export function validateExtraction(
  raw: unknown,
  passages: { locator: string; text: string }[],
): { fields: ExtractedField[]; warnings: string[] } {
  const warnings: string[] = []
  const realLocators = new Set(passages.map((p) => p.locator))
  const byKey = new Map<string, RawField>()
  const arr = (raw as { fields?: unknown })?.fields
  if (Array.isArray(arr)) {
    for (const item of arr as RawField[]) {
      if (item && typeof item.key === 'string') byKey.set(item.key, item)
    }
  }

  const fields: ExtractedField[] = FIELD_SCHEMA.map((schema) => {
    const item = byKey.get(schema.key)
    let value = typeof item?.value === 'string' ? item.value.trim() : ''
    let category: FieldCategory =
      CATEGORIES.includes(item?.category as FieldCategory) ? (item!.category as FieldCategory) : 'UNKNOWN'
    let locator = typeof item?.locator === 'string' && item.locator.trim() ? item.locator.trim() : null

    if (!value) {
      value = 'Not located in the document.'
      category = 'UNKNOWN'
      locator = null
    }

    // A SOURCE FACT must reference a real passage locator.
    if (category === 'SOURCE FACT') {
      if (!locator || !realLocators.has(locator)) {
        warnings.push(`Field "${schema.key}": source-fact locator could not be verified against the document; demoted to analysis.`)
        category = 'BIOVERACITY ANALYSIS'
        locator = null
      }
    } else if (locator && !realLocators.has(locator)) {
      // Non-source categories should not carry unverifiable locators.
      locator = null
    }

    return { key: schema.key, label: schema.label, value, category, locator }
  })

  return { fields, warnings }
}

async function callModel(
  passages: { locator: string; text: string }[],
  fetchFn: typeof fetch,
): Promise<{ raw: unknown; model: string }> {
  const model = 'claude-sonnet-4-6'
  const apiKey = process.env.ABACUSAI_API_KEY
  if (!apiKey) throw new Error('EXTRACTION_UNAVAILABLE: missing API key')
  const res = await fetchFn('https://apps.abacus.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 4000,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(passages) },
      ],
    }),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`EXTRACTION_UNAVAILABLE: model error ${res.status} ${txt.slice(0, 200)}`)
  }
  const json: any = await res.json()
  const content: string = json?.choices?.[0]?.message?.content ?? ''
  let parsed: unknown = {}
  try {
    parsed = JSON.parse(stripCodeFence(content))
  } catch {
    throw new Error('EXTRACTION_UNAVAILABLE: model did not return valid JSON')
  }
  return { raw: parsed, model }
}

/**
 * Run extraction over parsed passages. If there are no passages (e.g. a scanned
 * PDF), returns an all-UNKNOWN result with a warning instead of calling the
 * model, so the customer sees honest blanks rather than fabricated content.
 */
export async function extractAssessment(
  passages: { locator: string; text: string }[],
  opts: { fetchFn?: typeof fetch } = {},
): Promise<ExtractionResult> {
  const fetchFn = opts.fetchFn ?? fetch
  if (!passages.length) {
    return {
      version: EXTRACTION_VERSION,
      model: 'none',
      fields: FIELD_SCHEMA.map((s) => ({
        key: s.key,
        label: s.label,
        value: 'Not located in the document.',
        category: 'UNKNOWN' as FieldCategory,
        locator: null,
      })),
      warnings: ['No extractable text was found in the document. Review the original manually.'],
      passageCount: 0,
    }
  }
  const { raw, model } = await callModel(passages, fetchFn)
  const { fields, warnings } = validateExtraction(raw, passages)
  return { version: EXTRACTION_VERSION, model, fields, warnings, passageCount: passages.length }
}
