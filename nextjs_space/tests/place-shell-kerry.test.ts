import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PGlite } from '@electric-sql/pglite'
import type { Database, Sql } from '../lib/workspaces/service'
import { parseEvidenceCreate } from '../lib/v1/contract'
import { parseToken } from '../lib/v1/keys'
import { platformService } from '../lib/v1/service'
import { v1ServiceOptions } from '../lib/v1/processor'
import { KERRY_PLACE_ID } from '../lib/place-memory/kerry-001'
import { DESIGNATION_FEATURE_NOTE } from '../lib/place/public-read'
import { assignCanonicalPlaceSlug } from '../lib/place/slugs'
import { loadPlaceShell } from '../lib/place/shell-loader'
import type { PlaceShellView } from '../lib/place/shell-view'
import { placePresentation } from '../lib/place-memory/place-presentation'
import { PlaceShell } from '../components/place/place-shell'

// First real Place through the universal shell: the reviewed KERRY-001 cargo is
// projected by the real V1 service into isolated PGlite (never a hosted DB). The
// slug used here is a local fixture only; no production slug is seeded.
const body = JSON.parse(readFileSync(join(process.cwd(), 'docs/kerry-001.proposed.json'), 'utf8'))
const LOCAL_SLUG = 'fixture-first-place'

async function projected() {
  const pg = new PGlite()
  for (const m of [
    '0000_init', '20260909_private_workspace_foundation', '20260920_observation_revisions',
    '20261001_developer_platform_v1', '20261003_kerry_place_memory_v1', '20261004_place_slug_history',
  ]) await pg.exec(readFileSync(join(process.cwd(), 'prisma/migrations', m, 'migration.sql'), 'utf8'))
  const sql = (c: Pick<PGlite, 'query'>): Sql => ({ query: async <T>(t: string, v: unknown[]) => (await c.query<T>(t, v)).rows })
  const db: Database = { ...sql(pg), transaction: (op) => pg.transaction((tx) => op(sql(tx))) }
  let n = 0
  const service = platformService(db, { ...v1ServiceOptions(db), genId: (p) => `${p}_${String(++n).padStart(32, '0')}`, now: () => new Date('2026-09-28T12:30:00.000Z') })
  const key = await service.createKey({ name: 'shell-fixture', mode: 'live' })
  const apiKey = await service.findKeyByLookup(parseToken(key.token)!.lookupId)
  assert.ok(apiKey)
  const created = await service.createEvidence({ apiKey, body: parseEvidenceCreate(body), rawBody: body, idempotencyKey: 'shell-fixture', requestId: 'req_shell' })
  assert.equal(created.evidence.processing_status, 'PROCESSED')
  await assignCanonicalPlaceSlug(db, KERRY_PLACE_ID, LOCAL_SLUG)
  return { pg, db, evidenceId: created.evidence.id }
}

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ')

test('first Place: human title from configuration, data-backed context, 23 designation features all UNKNOWN now, no internal IDs', async () => {
  const h = await projected()
  try {
    const r = await loadPlaceShell(h.db, LOCAL_SLUG, placePresentation)
    assert.equal(r.outcome, 'ok')
    const view = (r as { view: PlaceShellView }).view
    assert.equal(view.title, 'Tralee Wetlands')
    assert.equal(view.context, body.metadata.place_memory.place_label)
    assert.equal(view.publicItemCount, 1)
    assert.equal(view.species.length, 23)
    assert.ok(view.species.every((s) => s.framing === 'designation_feature' && s.presenceNow === 'UNKNOWN'))
    assert.equal(view.prompts[0].state, 'NOT RECORDED')
    assert.equal(view.prompts[1].state, 'NOT RECORDED')
    assert.equal(view.prompts[2].state, 'NOT YET INGESTED')
    const [card] = view.cards
    assert.equal(card.statement, 'Tralee Bay Complex SPA')
    assert.equal(card.source.licence, 'CC BY 4.0')
    assert.deepEqual(card.facts.filter((f) => f.state).map((f) => `${f.label}:${f.state}`), ['When:UNKNOWN', 'Location:NOT LOCATED', 'Observed:NOT RECORDED', 'Published:UNKNOWN'])

    const html = renderToStaticMarkup(createElement(PlaceShell, { view }))
    const t = text(html)
    assert.ok(html.includes('>Tralee Wetlands</h1>'))
    const oyc = view.species.find((s) => s.label === 'Haematopus ostralegus')
    assert.ok(oyc && t.includes('Haematopus ostralegus'), JSON.stringify(oyc))
    assert.ok(t.includes('Eurasian oystercatcher'), JSON.stringify(oyc))
    assert.ok(t.includes(DESIGNATION_FEATURE_NOTE))
    assert.ok(!html.includes(KERRY_PLACE_ID) && !html.includes(h.evidenceId))
    assert.ok(!/\b(mem|raw|req|ev|spv|par|geo)_[a-z0-9_]+/.test(html), 'internal identifier leaked')
    assert.ok(!/manifest_sha256|rings|spatialReference|EPSG|coordinates|<img\b|<iframe\b/i.test(html), 'no geometry, map or unverified imagery')
    const retrieved = new Date(body.retrieval_time).toISOString().slice(0, 10)
    assert.deepEqual([...new Set(t.match(/\b(19|20)\d\d-\d\d-\d\d\b/g) ?? [])], [retrieved], 'only the recorded retrieval date appears')
  } finally { await h.pg.close() }
})

test('first Place: the immutable Place ID is untouched and never used as a locator', async () => {
  const h = await projected()
  try {
    assert.deepEqual(await loadPlaceShell(h.db, KERRY_PLACE_ID, placePresentation), { outcome: 'not_found' })
    const [asset] = await h.db.query<{ id: string; name: string }>('SELECT id, name FROM "Asset" WHERE id = $1', [KERRY_PLACE_ID])
    assert.deepEqual(asset, { id: KERRY_PLACE_ID, name: body.metadata.place_memory.place_label }, 'display title never rewrites Asset data')
  } finally { await h.pg.close() }
})


test('first Place X1 ARRIVE: relation, categories, truthful Water, empty time strip, illustrative hero, How we know, Menu', async () => {
  const h = await projected()
  try {
    const r = await loadPlaceShell(h.db, LOCAL_SLUG, placePresentation)
    const view = (r as { view: PlaceShellView }).view
    assert.equal(view.relation, 'Within the Tralee Bay Complex public record')
    assert.deepEqual(view.categories.map((c) => `${c.id}:${c.status}:${c.count}`), ['species:available:22', 'habitats:available:1', 'water:unverified:0', 'designations:available:1', 'people:unwired:0', 'climate:unwired:0', 'planning:unwired:0'])
    assert.deepEqual(view.timeline, [], 'a designation is not a dated record')
    assert.equal(view.timeWindow.years.length, 30)
    assert.ok(view.timeWindow.years.every((y) => y.records === 0) && view.timeWindow.outside === 0, 'no dated records, so no filled years')
    assert.equal(view.known.statement, '22 species and 1 habitat or feature are named in the Tralee Bay Complex SPA designation.')

    const html = renderToStaticMarkup(createElement(PlaceShell, { view }))
    const t = text(html)
    assert.ok(/data-place-relation="">Within the Tralee Bay Complex public record</.test(html))
    // Categories: available ones open a sheet; Water is disabled, unverified, with no count.
    const cat = (id: string) => html.match(new RegExp(`<li data-category="${id}"[\\s\\S]*?</li>`))![0]
    assert.ok(/href="#evidence"/.test(cat('designations')) && /href="#species"/.test(cat('species')) && /href="#species"/.test(cat('habitats')))
    const water = cat('water')
    assert.ok(/data-category-status="unverified"/.test(water) && /aria-disabled="true"/.test(water) && !/href=/.test(water))
    assert.ok(/data-place-state="NOT YET INGESTED"/.test(water) && text(water).includes('source has not been verified') && !/>\s*0\s*</.test(water))
    for (const id of ['people', 'climate', 'planning']) assert.ok(/data-category-status="unwired"/.test(cat(id)) && !/href=/.test(cat(id)), id)
    // Chips: same truthful order; Water opens its empty-state sheet; unwired chips are inert and carry no count.
    const chips = [...html.matchAll(/<li data-chip="(\w+)" data-chip-status="(\w+)">([\s\S]*?)<\/li>/g)]
    assert.deepEqual(chips.slice(0, 7).map((m) => `${m[1]}:${m[2]}`), ['species:available', 'habitats:available', 'water:unverified', 'designations:available', 'people:unwired', 'climate:unwired', 'planning:unwired'])
    assert.ok(/href="#water"/.test(chips[2][3]))
    for (const m of chips.slice(4, 7)) assert.ok(/aria-disabled="true"/.test(m[3]) && !/href=/.test(m[3]) && /NOT YET INGESTED/.test(m[3]), m[1])
    // What we know so far: derived from the designation record, traceable in How we know.
    const knownCard = html.match(/<article[^>]*data-known-so-far=""[\s\S]*?<\/article>/)![0]
    assert.ok(text(knownCard).includes('What we know so far') && text(knownCard).includes(view.known.statement) && /href="#how-we-know"/.test(knownCard))
    // Time strip: 30-year window, no filled year, gaps stated.
    assert.ok(html.includes('data-time-strip="empty"') && t.includes('No dated public records yet'))
    const strip = html.match(/<a[^>]*id="time-strip"[\s\S]*?<\/a>/)![0]
    assert.equal((strip.match(/data-year="/g) ?? []).length, 30)
    assert.ok(!/data-records="[1-9]/.test(strip) && text(strip).includes('Travel 30 years'))
    // Water sheet: truthful empty state, no invented reading.
    const waterSheet = html.match(/<section id="water"[\s\S]*?<\/section>/)![0]
    assert.ok(/role="dialog"/.test(waterSheet) && /data-water-empty=""/.test(waterSheet) && text(waterSheet).includes("Water hasn't been gathered yet") && text(waterSheet).includes('No evidence is not evidence of absence.'))
    // Time sheet: no dated records, no trend claimed.
    const timeSheet = html.match(/<section id="time"[\s\S]*?<\/section>/)![0]
    assert.ok(text(timeSheet).includes('No dated public records yet') && text(timeSheet).includes('No trend is claimed') && !/data-time-records/.test(timeSheet))
    // Hero: deterministic inline illustration, rights pending, always badged, no image file.
    const hero = html.match(/<figure\b[^>]*data-hero="illustration"[\s\S]*?<\/figure>/)![0]
    assert.ok(/data-hero-rights="PENDING"/.test(hero) && /role="img"/.test(hero))
    assert.ok(/aria-label="Illustration of Tralee Wetlands[^"]*"/.test(hero))
    assert.ok(/data-illustrative-badge=""/.test(hero) && text(hero.match(/<span data-illustrative-badge[\s\S]*?<\/span><\/span>/)![0]).includes('Illustration'))
    assert.ok(!/<img\b|<image\b|\.(png|jpe?g|webp|avif)\b/i.test(hero))
    assert.equal(renderToStaticMarkup(createElement(PlaceShell, { view })), html, 'hero illustration is deterministic')
    // How we know modal: dialog sheet with the five interactive rules, sources, and what is not shown.
    const how = html.match(/<section id="how-we-know"[\s\S]*?<\/section>/)![0]
    assert.ok(/role="dialog"/.test(how) && /aria-modal="true"/.test(how) && /aria-labelledby="how-we-know-title"/.test(how) && /tabindex="-1"/.test(how))
    assert.equal((how.match(/<details\b/g) ?? []).length, 5)
    assert.equal((how.match(/<summary\b/g) ?? []).length, 5)
    assert.ok(text(how).includes('An illustration is not evidence') && text(how).includes('Water:') && text(how).includes('Planning:'))
    assert.ok(/data-pa-close=""/.test(how) && /href="#place-main"/.test(how))
    // Menu: fuchsia mark in the heading, GET search.
    const menuTitle = html.match(/<h2 id="place-menu-title"[\s\S]*?<\/h2>/)![0]
    assert.ok(/data-bv-place-mark/.test(menuTitle) && /data-tone="fuchsia"/.test(menuTitle) && text(menuTitle).includes('Menu'))
    const form = html.match(/<form\b[^>]*>/g) ?? []
    assert.equal(form.length, 1)
    assert.ok(/action="\/search"/.test(form[0]) && /method="get"/.test(form[0]) && /role="search"/.test(form[0]) && !/method="post"/i.test(html))
    // Layout: mobile nav hidden at lg, desktop section nav from lg, in-flow consent slot.
    assert.ok(/<nav aria-label="Place navigation" class="[^"]*\blg:hidden\b/.test(html))
    assert.ok(/<nav aria-label="Place sections" class="hidden lg:block"/.test(html))
    const main = html.match(/<main id="place-main"[\s\S]*<\/main>/)![0]
    assert.ok(main.includes('data-place-consent-slot=""') && main.includes('data-consent-placement="inline"'), 'consent is reserved in flow, server-rendered')
    assert.ok(/<script>[^<]*localStorage\.getItem\('bv-cookie-consent'\)[^<]*data-bv-consent/.test(html), 'returning visitors hide the slot before paint')
    for (const b of html.match(/<button[^>]*data-consent-choice[^>]*>/g) ?? []) assert.ok(/min-h-\[44px\]/.test(b) && /type="button"/.test(b))
  } finally { await h.pg.close() }
})
