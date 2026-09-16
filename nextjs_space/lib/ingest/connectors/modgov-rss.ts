/**
 * Modern.Gov (Mod.gov) committee RSS connector (zero-token early-signal ingestion).
 *
 * Councils running Modern.Gov publish committee-meeting RSS feeds (e.g.
 * https://<council>.moderngov.co.uk/mgReports.aspx?...&RSS=1 or mgFeed.aspx).
 * This connector parses such a feed dependency-free, keeps only items whose
 * title or summary mentions a statutory environmental keyword, and emits a
 * retained evidence record for each match so early-stage planning/environmental
 * signals enter the canonical ingestion pipeline (never auto-published).
 *
 * Only real feed values are transformed — nothing is invented. The caller
 * supplies the specific council feed URL; the connector performs no discovery
 * crawling and fetches a single bounded feed per call.
 */
import { record } from '../connectors-scotland'
import type { ConnectorResult, EvidenceInput, Options } from '../connectors-scotland'

const MAX_BYTES = 2 * 1024 * 1024
const MAX_ITEMS = 60

// Statutory environmental keywords that make a committee item worth routing.
export const STATUTORY_ENV_KEYWORDS = [
  'environmental impact', 'environmental statement', 'biodiversity', 'biodiversity net gain',
  'habitat', 'sssi', 'special area of conservation', 'special protection area', 'ramsar',
  'nature reserve', 'ecolog', 'protected species', 'tree preservation', 'conservation area',
  'flood risk', 'flood alleviation', 'water quality', 'pollution', 'air quality',
  'contaminated land', 'climate', 'wildlife', 'green belt', 'planning application',
]

export type ModGovOptions = Options & {
  /** Override the keyword set used to select items. */
  keywords?: string[]
}

/** Bounded text fetch (size-capped, timed out, no redirects) for XML feeds. */
async function fetchText(url: string, options: Options): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30000)
  try {
    const res = await (options.fetcher ?? fetch)(url, {
      headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    })
    if (res.status === 403 || res.status === 429) throw new Error('Upstream rate limit; honour Retry-After before retrying')
    if (!res.ok) throw new Error(`Upstream HTTP ${res.status}`)
    const reader = res.body?.getReader()
    if (!reader) throw new Error('Empty source response')
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error('Source response too large') }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let at = 0
    for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length }
    return new TextDecoder().decode(bytes)
  } finally {
    clearTimeout(timer)
  }
}

function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tag(block: string, name: string): string | null {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
  if (!match) return null
  const text = decodeEntities(match[1]).slice(0, 500)
  return text || null
}

export async function fetchModGovCommitteeSignals(feedUrl: string, options: ModGovOptions = {}): Promise<ConnectorResult> {
  const source = 'modgov-committee-rss'
  const coverage = 'Single Modern.Gov committee RSS feed, filtered to statutory environmental keywords. Early-stage signals only — not verified opportunities and not auto-published.'
  try {
    if (typeof feedUrl !== 'string' || !/^https:\/\//i.test(feedUrl)) throw new Error('A single https feed URL is required')
    const keywords = (options.keywords && options.keywords.length ? options.keywords : STATUTORY_ENV_KEYWORDS).map((k) => k.toLowerCase())
    const xml = await fetchText(feedUrl, options)
    const now = (options.now?.() ?? new Date()).toISOString()
    const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || []
    const records: EvidenceInput[] = []
    let rejected = 0
    let seen = 0
    for (const block of blocks.slice(0, MAX_ITEMS)) {
      seen++
      try {
        const title = tag(block, 'title')
        const link = tag(block, 'link') || tag(block, 'guid')
        const description = tag(block, 'description') || ''
        const pubDate = tag(block, 'pubDate')
        if (!title || !link || !/^https:\/\//i.test(link)) throw new Error('item')
        const haystack = `${title} ${description}`.toLowerCase()
        const matched = keywords.filter((k) => haystack.includes(k))
        if (!matched.length) continue
        const parsed = pubDate ? new Date(pubDate) : null
        const day = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : null
        const selected = { title, link, description: description.slice(0, 1500), pubDate, matchedKeywords: matched.slice(0, 10) }
        const r = record(link, `Committee signal: ${title}`.slice(0, 200), 'Local authority committee (Modern.Gov)', 'uk:modgov-committee', `modgov:${link}`, selected, now, day)
        r.jurisdiction = 'United Kingdom'
        records.push(r)
      } catch {
        rejected++
      }
    }
    return {
      source,
      coverage,
      status: rejected ? 'partial' : 'ok',
      records,
      rejected,
      // A committee RSS feed is a single bounded document, not an offset chain.
      nextOffset: null,
    }
  } catch (error) {
    return { source, coverage, status: 'error', records: [], rejected: 0, nextOffset: null, error: error instanceof Error ? error.message : 'error' }
  }
}
