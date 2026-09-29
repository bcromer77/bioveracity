import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PGlite } from '@electric-sql/pglite'
import type { Sql } from '../lib/workspaces/service'
import { DESIGNATION_FEATURE_NOTE, PUBLIC_ITEM_GATE } from '../lib/place/public-read'
import { isPlaceExperienceEnabled, loadPlaceShell } from '../lib/place/shell-loader'
import type { PlaceShellView } from '../lib/place/shell-view'
import { PlaceShell } from '../components/place/place-shell'
import { BioVeracityPlaceMark, PLACE_MARK_PETAL_PATH, PLACE_MARK_TONES } from '../components/place/place-mark'
import { placePresentation } from '../lib/place-memory/place-presentation'
import { PLACE_ARRIVE_CSS } from '../components/place/place-arrive-styles'

// Synthetic, Place-neutral fixtures for the universal Place shell (PR D).
// Every non-public row carries SENTINEL markers a leak would surface.
const root = process.cwd()
const MIGRATIONS = [
  '0000_init', '20260909_private_workspace_foundation', '20260920_observation_revisions',
  '20261001_developer_platform_v1', '20261003_kerry_place_memory_v1', '20261004_place_slug_history',
]
const ALPHA = 'bv_place_synthetic_alpha'
const BETA = 'bv_place_synthetic_beta'
const HIDDEN = 'bv_place_synthetic_private_only'
const j = (v: unknown) => JSON.stringify(v)
const CLEARED = { licence: 'Open Licence 1.0', rights_class: 'CLEARED_FOR_INGEST', attribution: 'Synthetic Publisher', internal_locator: 'SENTINEL_PROVENANCE' }

type Row = { id: string; place: string; statement: string; kind?: string; cls?: string; relation?: string; visibility?: string; rights?: string; disclosure?: string; label?: string; common?: string; uncertainty?: unknown; start?: string }
const ROWS: Row[] = [
  { id: 'mem_a_designation', place: ALPHA, statement: 'Synthetic protected area designation', kind: 'DESIGNATION', cls: 'AUTHORITATIVE_STATUTORY', relation: 'QUALIFYING_INTEREST', label: 'Ardea cinerea', common: 'Grey heron',
    uncertainty: { designation_not_observation: true, current_presence_not_established: true, observation_time_unknown: true } },
  { id: 'mem_a_hidden_loc', place: ALPHA, statement: 'Wader roost record with withheld location', cls: 'PROFESSIONAL_OBSERVATION', disclosure: 'HIDDEN', label: 'Calidris alpina', common: 'Dunlin' },
  { id: 'mem_x_restricted', place: ALPHA, statement: 'SENTINEL_RESTRICTED heron', visibility: 'RESTRICTED', rights: 'PERMISSION_REQUIRED', label: 'SENTINEL_TAXON' },
  { id: 'mem_x_private', place: ALPHA, statement: 'SENTINEL_PRIVATE note', visibility: 'WORKSPACE_PRIVATE', rights: 'NOT_CLEARED', label: 'SENTINEL_TAXON_2' },
  { id: 'mem_b_obs', place: BETA, statement: 'Otter spraint recorded on the riverbank', cls: 'STRUCTURED_CITIZEN_OBSERVATION', disclosure: 'GENERALISED', label: 'Lutra lutra', common: 'Otter', start: '2025-06-14T00:00:00Z' },
  { id: 'mem_x_hidden_place', place: HIDDEN, statement: 'SENTINEL_HIDDEN_PLACE', visibility: 'RESTRICTED', rights: 'NOT_CLEARED' },
]

async function harness() {
  const pg = new PGlite()
  for (const m of MIGRATIONS) await pg.exec(readFileSync(join(root, 'prisma/migrations', m, 'migration.sql'), 'utf8'))
  const log: string[] = []
  const db: Sql = { query: async <T>(text: string, values: unknown[]) => { log.push(text); return (await pg.query<T>(text, values)).rows } }
  const q = (text: string, values: unknown[] = []) => pg.query(text, values)
  for (const [id, name] of [[ALPHA, 'Alpha Marsh'], [BETA, 'Beta Fen'], [HIDDEN, 'SENTINEL_PLACE_NAME']]) {
    await q(`INSERT INTO "Asset" (id,slug,name,type,region,"regionSlug",status,"updatedAt") VALUES ($1,$2,$3,'living_place','r','r','active',now())`, [id, id.replace(/_/g, '-'), name])
  }
  await q(`INSERT INTO "PlaceSlug" (slug,"placeId","retiredAt") VALUES ('alpha-old',$1,now())`, [ALPHA])
  await q(`INSERT INTO "PlaceSlug" (slug,"placeId") VALUES ('alpha-marsh',$1)`, [ALPHA])
  await q(`INSERT INTO "PlaceSlug" (slug,"placeId") VALUES ('beta-fen',$1)`, [BETA])
  await q(`INSERT INTO "PlaceSlug" (slug,"placeId") VALUES ('hidden-place',$1)`, [HIDDEN])
  await q(`INSERT INTO "PrivateWorkspace" (id,name) VALUES ('ws_sentinel','SENTINEL_WORKSPACE')`)
  await q(`INSERT INTO "PlatformApiKey" (id,name,mode,"lookupId","secretHash") VALUES ('ak_sentinel','k','live','SENTINEL_LOOKUP','SENTINEL_HASH')`)
  for (const [index, r] of ROWS.entries()) {
    await q(`INSERT INTO "PlatformRawEvidence" (id,"apiKeyId",mode,"payloadFingerprint","rawBody","requestId") VALUES ($1,'ak_sentinel','live',$2,$3::jsonb,$4)`,
      [`raw_${r.id}`, `SENTINEL_FP_${r.id}`, j({ body: 'SENTINEL_RAW_BODY' }), `req_${r.id}`])
    await q(`INSERT INTO "PlatformEvidence" (id,"apiKeyId",mode,"rawEvidenceId",provider,"sourceExternalId","evidenceType",publisher,"sourceUrl","retrievalTime","sourceData",provenance,"processingStatus","requestId","idempotencyKey")
      VALUES ($1,'ak_sentinel','live',$2,'synthetic',$3,'t','Synthetic Publisher','https://example.org/source','2026-01-02T03:04:05Z',$4::jsonb,$5::jsonb,'PROCESSED',$6,'SENTINEL_IDEM_' || $1)`,
      [`ev_${r.id}`, `raw_${r.id}`, `SRC-${String(index).padStart(3, '0')}`, j({ secret: 'SENTINEL_SOURCE_DATA' }), j(CLEARED), `req_${r.id}`])
    const visibility = r.visibility ?? 'PUBLIC'
    await q(`INSERT INTO "PlaceMemoryItem" (id,"itemKey","placeId","platformEvidenceId","workspaceId",kind,"evidenceClass",visibility,"rightsState","originalStatement","sourceIndependenceKey","geographyPrecision","locationDisclosure",uncertainty,status,"eventStart")
      VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8,$9,'SENTINEL_INDEPENDENCE','named site',$10,$11::jsonb,'ACTIVE',$12)`,
      [r.id, r.place, `ev_${r.id}`, visibility === 'WORKSPACE_PRIVATE' ? 'ws_sentinel' : null, r.kind ?? 'OBSERVATION', r.cls ?? 'PROFESSIONAL_OBSERVATION', visibility,
        r.rights ?? 'CLEARED_FOR_INGEST', r.statement, r.disclosure ?? 'NAMED_ONLY', j(r.uncertainty ?? {}), r.start ?? null])
    await q(`INSERT INTO "PlaceMemorySourceLink" ("itemId","platformEvidenceId",relationship,"sourceIndependenceKey") VALUES ($1,$2,'PRIMARY','SENTINEL_INDEPENDENCE')`, [r.id, `ev_${r.id}`])
    if (r.label) {
      await q(`INSERT INTO "PlaceMemoryEntity" (id,kind,"canonicalLabel",authority,"externalId",metadata) VALUES ($1,'TAXON',$2,'SYNTH',$3,$4::jsonb)`,
        [`ent_${r.id}`, r.label, `T-${String(index).padStart(3, '0')}`, j({ private: 'SENTINEL_ENTITY_METADATA' })])
      if (r.common) await q(`INSERT INTO "PlaceMemoryTerm" (id,"entityId",term,normalized,language,"termType",status) VALUES ($1,$2,$3,lower($3),'en','COMMON_NAME','CURATED')`, [`term_${r.id}`, `ent_${r.id}`, r.common])
      await q(`INSERT INTO "PlaceMemoryTerm" (id,"entityId",term,normalized,language,"termType",status) VALUES ($1,$2,'SENTINEL_MACHINE_TERM','x','en','COMMON_NAME','MACHINE_INTERPRETATION')`, [`termm_${r.id}`, `ent_${r.id}`])
      await q(`INSERT INTO "PlaceMemoryItemEntity" ("itemId","entityId","relationType","assertionState","sourceAssertion",uncertainty) VALUES ($1,$2,$3,'SOURCE_ASSERTION',$4::jsonb,'{}'::jsonb)`,
        [r.id, `ent_${r.id}`, r.relation ?? 'SUBJECT', j({ raw: 'SENTINEL_ASSERTION' })])
    }
  }
  return { pg, db, log }
}

const render = (view: PlaceShellView) => renderToStaticMarkup(createElement(PlaceShell, { view }))
async function okView(db: Sql, slug: string) {
  const r = await loadPlaceShell(db, slug, placePresentation)
  assert.equal(r.outcome, 'ok')
  return (r as { view: PlaceShellView }).view
}
const visibleText = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ')

function assertNoLeak(label: string, html: string) {
  assert.ok(!html.includes('SENTINEL'), `${label}: sentinel leaked`)
  const idLeak = html.match(/bv_place_|\b(mem|ev|raw|req|ent|term|ws|ak)_[a-z0-9_]+/)
  assert.ok(!idLeak, `${label}: internal identifier leaked: ${idLeak?.[0]} @ ${html.slice(Math.max(0,(idLeak?.index??0)-80),(idLeak?.index??0)+40)}`)
  assert.ok(!/coordinates|geometry|EPSG|"Point"|rawBody|payloadFingerprint|secretHash|lookupId|idempotency/i.test(html), `${label}: private field leaked`)
}

function files(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : [p] })
}
const SHELL_SOURCES = ['lib/place/shell-view.ts', 'lib/place/shell-loader.ts', ...files(join(root, 'components/place')).map((p) => relative(root, p)), 'app/place/[slug]/page.tsx']
const src = (p: string) => readFileSync(join(root, p), 'utf8')

test('1. public-contract-only: shell code reaches data solely through PR B slugs + PR C public read, and every item query is gated', async () => {
  for (const p of SHELL_SOURCES) {
    const s = src(p)
    assert.ok(!/"PlaceMemory|"PlatformEvidence|"PlatformRawEvidence|\$queryRaw(?!Unsafe<T\[\]>\(text, \.\.\.values\))|\.query\(/.test(s) || p === 'app/place/[slug]/page.tsx', `${p} must not query tables directly`)
    assert.ok(!/place-memory\/(retrieval|projector|registry|production-registry|provenance)|lib\/v1\//.test(s), `${p} imports a non-public data path`)
  }
  const loader = src('lib/place/shell-loader.ts')
  assert.deepEqual([...loader.matchAll(/from '([^']+)'/g)].map((m) => m[1]).sort(), ['./public-read', './shell-view', './slugs', '@/lib/workspaces/service'])
  const page = src('app/place/[slug]/page.tsx')
  assert.ok(!/\$queryRaw`|prisma\.[a-z]+\.(find|create|update|delete)/i.test(page), 'route must not use Prisma models')
  const h = await harness()
  try {
    h.log.length = 0
    await okView(h.db, 'alpha-marsh')
    const touching = h.log.filter((t) => /"PlaceMemoryItem"/.test(t))
    assert.ok(touching.length >= 2)
    for (const t of touching) assert.ok(t.includes(PUBLIC_ITEM_GATE), 'every Place Memory query carries the PR C gate')
  } finally { await h.pg.close() }
})

test('2. no leakage: rendered shell carries no sentinel, internal ID, geometry, raw body, or private-only Place', async () => {
  const h = await harness()
  try {
    for (const slug of ['alpha-marsh', 'beta-fen']) {
      const view = await okView(h.db, slug)
      assertNoLeak(`${slug} view`, JSON.stringify(view))
      assertNoLeak(`${slug} html`, render(view))
    }
    assert.deepEqual(await loadPlaceShell(h.db, 'hidden-place'), { outcome: 'not_found' })
    const html = render(await okView(h.db, 'alpha-marsh'))
    assert.ok(html.includes('Wader roost record with withheld location'))
    assert.ok(html.includes('data-place-state="RESTRICTED"'), 'withheld location is shown as RESTRICTED, not placed')
  } finally { await h.pg.close() }
})

test('3. unknown preservation: unknown dates, absent observations and absent contributions render as explicit states', async () => {
  const h = await harness()
  try {
    const view = await okView(h.db, 'alpha-marsh')
    const design = view.cards.find((c) => c.designation)!
    assert.deepEqual(design.facts.map((f) => [f.label, f.state]), [['When', 'UNKNOWN'], ['Location', 'NOT LOCATED'], ['Observed', 'NOT RECORDED'], ['Published', 'UNKNOWN'], ['Retrieved', null]])
    assert.equal(view.prompts.find((p) => p.id === 'what-people-know')!.state, 'NOT YET INGESTED')
    assert.equal(view.prompts.find((p) => p.id === 'what-has-changed')!.state, 'NOT RECORDED')
    const html = render(view)
    for (const s of ['UNKNOWN', 'NOT RECORDED', 'NOT LOCATED', 'NOT YET INGESTED', 'RESTRICTED']) assert.ok(html.includes(`data-place-state="${s}"`), s)
    assert.ok(visibleText(html).includes('No evidence is not evidence of absence.'))
    assert.ok(!/\b(19|20)\d\d-\d\d-\d\d\b/.test(visibleText(html).split('2026-01-02').join('')), 'no invented dates beyond the retrieval date')
    const beta = await okView(h.db, 'beta-fen')
    assert.equal(beta.cards[0].facts[0].value, '2025-06-14')
    assert.equal(beta.prompts.find((p) => p.id === 'what-has-changed')!.state, 'NOT RECORDED', 'one dated record is never a trend')
  } finally { await h.pg.close() }
})

test('4. presence trap: designation features never read as current presence, abundance, trend or condition', async () => {
  const h = await harness()
  try {
    const view = await okView(h.db, 'alpha-marsh')
    const heron = view.species.find((s) => s.label === 'Ardea cinerea')!
    assert.equal(heron.framing, 'designation_feature')
    assert.ok(view.species.every((s) => s.presenceNow === 'UNKNOWN'))
    assert.equal(view.designationNote, DESIGNATION_FEATURE_NOTE)
    const text = visibleText(render(view)).replace(/What lives here\?/g, '')
    assert.ok(text.includes(DESIGNATION_FEATURE_NOTE))
    assert.ok(text.includes('not what is here now') || text.includes('That does not show what lives here now.'))
    // The contract's own negated caution is asserted above, then removed before scanning for claims.
    const claim = text.split(DESIGNATION_FEATURE_NOTE).join(' ').match(/\b(is present|are present|currently present|lives here(?! now)|thriv\w+|abundant|plentiful|increasing|declining|recovering|healthy population|good condition|you will see|easy to spot)\b/i)
    assert.ok(!claim, `no presence/abundance/trend/condition claim: ${claim?.[0]}`)
  } finally { await h.pg.close() }
})

test('5. slug handling: canonical renders, retired slug is a 308 to the canonical path, unknown is not_found', async () => {
  const h = await harness()
  try {
    assert.equal((await loadPlaceShell(h.db, 'alpha-marsh')).outcome, 'ok')
    assert.deepEqual(await loadPlaceShell(h.db, 'alpha-old'), { outcome: 'redirect', status: 308, location: '/place/alpha-marsh' })
    assert.deepEqual(await loadPlaceShell(h.db, 'no-such-place'), { outcome: 'not_found' })
    const page = src('app/place/[slug]/page.tsx')
    assert.ok(/permanentRedirect\(result\.location\)/.test(page), 'route maps redirect to permanentRedirect (308)')
  } finally { await h.pg.close() }
})

test('6. malformed or unknown input and the disabled flag all collapse to one uniform not_found', async () => {
  const h = await harness()
  try {
    const bad: unknown[] = ['Alpha-Marsh', 'alpha_marsh', 'alpha-marsh ', ' alpha-marsh', '../etc/passwd', '%2e%2e', '', 'a'.repeat(81), '-alpha', 'alpha--marsh',
      ALPHA, 'pmi_0123456789abcdef01234567', "x' OR 1=1 --", null, undefined, 42, {}, ['alpha-marsh'], 'hidden-place', 'no-such-place']
    const results = await Promise.all(bad.map((b) => loadPlaceShell(h.db, b)))
    for (const r of results) assert.deepEqual(r, { outcome: 'not_found' })
    assert.equal(new Set(results.map((r) => JSON.stringify(r))).size, 1)
  } finally { await h.pg.close() }
  for (const v of [undefined, '', '1', 'TRUE', 'True', 'yes', 'on', ' true']) assert.equal(isPlaceExperienceEnabled({ PLACE_EXPERIENCE_ENABLED: v }), false, String(v))
  assert.equal(isPlaceExperienceEnabled({ PLACE_EXPERIENCE_ENABLED: 'true' }), true)
  const page = src('app/place/[slug]/page.tsx')
  assert.ok(page.indexOf('if (!isPlaceExperienceEnabled()) notFound()') < page.indexOf('await params'), 'flag is checked before any input is read')
  assert.ok(/robots: \{ index: false, follow: false \}/.test(page))
  assert.ok(!/NEXT_PUBLIC_PLACE/.test(page) && !/NEXT_PUBLIC_PLACE/.test(src('lib/place/shell-loader.ts')), 'flag is server-only')
})

test('7. keyboard-accessible mobile navigation: Home | Explore | + | Species | Menu, native links, landmarks, 44px targets', async () => {
  const h = await harness()
  try {
    const html = render(await okView(h.db, 'alpha-marsh'))
    const nav = html.match(/<nav aria-label="Place navigation"[\s\S]*?<\/nav>/)![0]
    const labels = [...nav.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => visibleText(m[1]).trim())
    assert.deepEqual(labels, ['Home', 'Explore', '+ Add to this place Not open yet', 'Species', 'Menu'])
    const links = [...nav.matchAll(/<a\b[^>]*>/g)].map((m) => [m[0], m[0].match(/href="([^"]+)"/)![1], m[0].match(/class="([^"]+)"/)![1]])
    assert.deepEqual(links.map((l) => l[1]), ['/', '#explore', '#species', '#place-menu'])
    for (const [, , cls] of links) { assert.ok(/min-h-\[56px\]/.test(cls) && /min-w-\[44px\]/.test(cls)); assert.ok(/focus-visible:outline/.test(cls)) }
    for (const id of ['explore', 'species', 'place-menu', 'place-main']) assert.ok(html.includes(`id="${id}"`), id)
    assert.ok(!/tabindex="[1-9]/i.test(html), 'no positive tabindex')
    assert.ok(html.indexOf('Skip to place content') < html.indexOf('<nav'), 'skip link precedes navigation')
    assert.equal((html.match(/<main\b/g) ?? []).length, 1)
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1)
    assert.ok(/<header\b/.test(html) && /<footer\b/.test(html))
    const headings = [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]))
    for (let i = 1; i < headings.length; i++) assert.ok(headings[i] - headings[i - 1] <= 1, 'no skipped heading level')
  } finally { await h.pg.close() }
})

test('8. inert contribution: the + is disabled, outside any form, with no handler, and no client code can post', async () => {
  const h = await harness()
  try {
    const html = render(await okView(h.db, 'alpha-marsh'))
    // X1: the only form is the Menu site search, a GET to /search. Nothing can POST.
    const forms = [...html.matchAll(/<form\b[^>]*>/g)].map((m) => m[0])
    assert.equal(forms.length, 1)
    assert.ok(/action="\/search"/.test(forms[0]) && /method="get"/.test(forms[0]) && /role="search"/.test(forms[0]))
    assert.equal((html.match(/\baction=/g) ?? []).length, 1)
    assert.ok(!/formaction|method="post"/i.test(html))
    const form = html.match(/<form\b[\s\S]*?<\/form>/)![0]
    assert.ok(/<input\b[^>]*name="q"/.test(form) && !/type="hidden"/.test(form), 'search carries only the visible query')
    const all = [...html.matchAll(/<button\b[^>]*>/g)].map((m) => m[0])
    // Only other buttons allowed: the shared EvidenceLink attribution toggles (local disclosure, no request)
    // and the GET search submit.
    const attribution = all.filter((b) => /aria-expanded="false"/.test(b))
    assert.ok(attribution.every((b) => /type="button"/.test(b)))
    const search = all.filter((b) => /data-place-search="get"/.test(b))
    assert.equal(search.length, 1)
    assert.ok(/type="submit"/.test(search[0]) && form.includes(search[0]))
    // The in-flow consent notice is server-rendered (reserved space, no CLS): two local choice buttons, no request.
    const consent = all.filter((b) => /data-consent-choice="(necessary|accepted)"/.test(b))
    assert.equal(consent.length, 2)
    assert.ok(consent.every((b) => /type="button"/.test(b) && /min-h-\[44px\]/.test(b)))
    const buttons = all.filter((b) => !attribution.includes(b) && !search.includes(b) && !consent.includes(b))
    assert.equal(buttons.length, 1)
    assert.ok(/type="button"/.test(buttons[0]) && /\bdisabled=""/.test(buttons[0]) && /aria-disabled="true"/.test(buttons[0]) && /data-place-contribute="inert"/.test(buttons[0]))
    assert.ok(visibleText(html).includes('Not open yet'))
    assert.ok(!form.includes('data-place-contribute'), 'the + is outside the search form')
  } finally { await h.pg.close() }
  for (const p of SHELL_SOURCES) {
    const s = src(p)
    assert.ok(!/^['"]use client['"]/m.test(s), `${p} must stay a server component`)
    assert.ok(!/\bon(Click|Submit|Change)\b|fetch\(|XMLHttpRequest|sendBeacon|<form|'use server'|"use server"/.test(s), `${p} must not carry a handler or submission path`)
  }
  // X1 client helpers: hash navigation and focus only; the search is a handler-free GET form.
  for (const p of files(join(root, 'components/place-client')).map((x) => relative(root, x))) {
    const s = src(p)
    assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|'use server'|"use server"|method="post"|formAction|router\.(push|replace)/i.test(s), `${p} must not request or post`)
  }
  const search = src('components/place-client/place-search.tsx')
  assert.ok(!/^['"]use client['"]/m.test(search) && !/\bon(Click|Submit|Change)\b/.test(search) && /method="get"/.test(search))
})

test('9. mark reuse: one geometry source, every rendered mark uses it, tone never changes geometry', async () => {
  const scan = ['app', 'components', 'lib'].flatMap((d) => files(join(root, d))).filter((p) => /\.(tsx?|jsx?|css|svg)$/.test(p))
  const holders = scan.filter((p) => readFileSync(p, 'utf8').includes(PLACE_MARK_PETAL_PATH)).map((p) => relative(root, p))
  assert.deepEqual(holders, ['components/place/place-mark.tsx'])
  for (const p of SHELL_SOURCES.filter((x) => x !== 'components/place/place-mark.tsx')) assert.ok(!/<svg[^>]*viewBox="0 0 100 100"/.test(src(p)), `${p} draws its own mark`)
  const shapes = (html: string) => [...html.matchAll(/<svg[^>]*data-bv-place-mark[^>]*>[\s\S]*?<\/svg>/g)].map((m) => [...m[0].matchAll(/<path d="([^"]+)"(?: transform="([^"]+)")?/g)].map((p) => `${p[1]}|${p[2] ?? ''}`).join(';'))
  const tones = Object.keys(PLACE_MARK_TONES) as Array<keyof typeof PLACE_MARK_TONES>
  const geometry = tones.map((tone) => shapes(renderToStaticMarkup(createElement(BioVeracityPlaceMark, { tone })))[0])
  assert.equal(new Set(geometry).size, 1)
  assert.equal(geometry[0].split(';').length, 6)
  const h = await harness()
  try {
    const html = render(await okView(h.db, 'alpha-marsh'))
    const all = shapes(html)
    assert.ok(all.length >= 3)
    assert.ok(all.every((g) => g === geometry[0]))
    const toneList = [...html.matchAll(/data-tone="(\w+)"/g)].map((m) => m[1])
    assert.deepEqual([...new Set(toneList)].sort(), ['fuchsia', 'white'])
    assert.equal(toneList.filter((t) => t === 'white').length, 2, 'white only on dark surfaces (header over the hero, footer), for contrast')
  } finally { await h.pg.close() }
  assert.equal(PLACE_MARK_TONES.fuchsia.toUpperCase(), '#B0246A', 'canonical tone is fuchsia')
})

test('10. mark genericity: Place-neutral props, no Place literals, accessible naming either way', () => {
  const s = src('components/place/place-mark.tsx')
  assert.ok(!/tralee|kerry|004188|bv_place_/i.test(s))
  const props = s.match(/export type BioVeracityPlaceMarkProps = \{([\s\S]*?)\n\}/)![1]
  assert.deepEqual([...props.matchAll(/^\s+(\w+)\?:/gm)].map((m) => m[1]), ['tone', 'size', 'title', 'className'])
  const decorative = renderToStaticMarkup(createElement(BioVeracityPlaceMark, {}))
  assert.ok(/aria-hidden="true"/.test(decorative) && !/role="img"/.test(decorative))
  const named = renderToStaticMarkup(createElement(BioVeracityPlaceMark, { title: 'BioVeracity', size: 64 }))
  assert.ok(/role="img"/.test(named) && /aria-label="BioVeracity"/.test(named) && /<title>BioVeracity<\/title>/.test(named) && /width="64"/.test(named))
})

test('X1 ARRIVE: dated records only on the time strip, no relation without a backing record, reduced motion and 44px source targets', async () => {
  const h = await harness()
  try {
    const alpha = await okView(h.db, 'alpha-marsh')
    assert.equal(alpha.relation, null, 'no relationRecord configured, so no relation is claimed')
    assert.deepEqual(alpha.timeline, [], 'the undated designation and undated observation stay off the strip')
    const alphaHtml = render(alpha)
    assert.ok(alphaHtml.includes('data-time-strip="empty"') && visibleText(alphaHtml).includes('No dated public records yet'))
    assert.ok(!alphaHtml.includes('data-place-relation'))
    const beta = await okView(h.db, 'beta-fen')
    assert.deepEqual(beta.timeline.map((r) => r.date), ['2025-06-14'])
    const betaHtml = render(beta)
    assert.ok(betaHtml.includes('data-time-strip="dated"') && !visibleText(betaHtml).includes('No dated public records yet'))
    assert.equal(beta.categories.find((c) => c.id === 'designations')!.status, 'empty')
    for (const v of [alpha, beta]) assert.deepEqual(v.categories.find((c) => c.id === 'water'), {
      id: 'water', label: 'Water', count: 0, status: 'unverified', state: 'NOT YET INGESTED', href: null,
      summary: 'Water-quality data is not shown: its source has not been verified for this place.' })
    assert.ok(/<h1 id="place-title"/.test(alphaHtml) && /aria-label="Illustration of Alpha Marsh/.test(alphaHtml) && alphaHtml.includes('data-illustrative-badge=""'))
  } finally { await h.pg.close() }
  const css = PLACE_ARRIVE_CSS.replace(/\s+/g, '')
  assert.ok(css.includes('.pa-srca,.pa-srcbutton{min-height:44px'), 'source links are 44px targets')
  assert.ok(css.includes('.pa-theme>summary{min-height:44px'), 'How we know rules are 44px targets')
  const reduced = css.match(/@media\(prefers-reduced-motion:reduce\)\{([\s\S]*)\}$/)![1]
  assert.ok(reduced.includes('animation-duration:0s!important') && reduced.includes('transition-duration:0s!important'))
  const arrive = src('components/place/place-arrive.tsx')
  assert.ok(!/animate-|transition(?!-colors)/.test(arrive.replace(/motion-safe:transition-colors/g, '')), 'motion is limited to the reducible CSS set')
})

test('replication: a synthetic second Place renders through the same shell with its own data-backed title', async () => {
  const h = await harness()
  try {
    const beta = await okView(h.db, 'beta-fen')
    assert.equal(beta.title, 'Beta Fen')
    assert.equal(beta.context, null)
    assert.equal(placePresentation(BETA), null)
    const html = render(beta)
    assert.ok(html.includes('data-place-shell="v1"') && html.includes('>Beta Fen</h1>'))
    assert.ok(html.includes('Otter') && html.includes('Named in public observation records'))
    assert.ok(!html.includes('Alpha Marsh') && !html.includes('Grey heron'), 'no cross-Place bleed')
    const alpha = render(await okView(h.db, 'alpha-marsh'))
    const skeleton = (x: string) => [...x.matchAll(/<(nav|main|header|footer|section)\b[^>]*?(?:id="([^"]+)")?/g)].map((m) => `${m[1]}#${m[2] ?? ''}`).join(',')
    assert.equal(skeleton(html), skeleton(alpha))
  } finally { await h.pg.close() }
})
