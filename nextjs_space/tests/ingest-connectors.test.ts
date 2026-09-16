import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchContractsFinderOcds, CONTRACTS_FINDER_SEARCH, CONTRACTS_FINDER_RELEASE } from '../lib/ingest/connectors/contracts-finder'
import { fetchModGovCommitteeSignals, STATUTORY_ENV_KEYWORDS } from '../lib/ingest/connectors/modgov-rss'

const mock = (data: unknown) => (async () => Response.json(data)) as typeof fetch
const mockText = (body: string, init?: ResponseInit) => (async () => new Response(body, init)) as typeof fetch
const now = () => new Date('2026-09-16T12:00:00Z')

// ---- Contracts Finder OCDS ----

// A realistic OCDS award release: buyer, tender value, an award with a named supplier and value, and postcodes.
const awardRelease = {
  ocid: 'ocds-b5fd17-0001',
  date: '2026-08-01T09:00:00Z',
  tag: ['award'],
  buyer: { name: 'Test County Council' },
  tender: {
    title: 'Habitat restoration and biodiversity monitoring',
    value: { amount: 250000, currency: 'GBP' },
    items: [{ deliveryAddresses: [{ postalCode: 'ab1 2cd' }] }],
  },
  parties: [{ address: { postalCode: 'EX4 4AA' } }],
  awards: [{
    date: '2026-08-15T00:00:00Z',
    suppliers: [{ id: 'GB-COH-12345678', name: 'Green Habitats Ltd' }],
    value: { amount: 240000, currency: 'GBP' },
  }],
}

test('Contracts Finder extracts award notice, buyer, value and postcodes from real OCDS fields only', async () => {
  const r = await fetchContractsFinderOcds({ now, fetcher: mock({ results: [{ releases: [awardRelease] }] }) })
  assert.equal(r.status, 'ok')
  assert.equal(r.records.length, 1)
  const rec = r.records[0]
  assert.equal(rec.jurisdiction, 'United Kingdom')
  assert.equal(rec.acquisition_permitted, true)
  assert.match(rec.source_licence || '', /open-government-licence/)
  assert.equal(rec.event_date, '2026-08-15')
  assert.equal(rec.url, `${CONTRACTS_FINDER_RELEASE}/${encodeURIComponent('ocds-b5fd17-0001')}.json`)
  const text = rec.sections[0].text
  assert.match(text, /"awardedSupplierName":"Green Habitats Ltd"/)
  assert.match(text, /"awardedSupplierId":"GB-COH-12345678"/)
  assert.match(text, /"awardedValue":240000/)
  assert.match(text, /"buyerName":"Test County Council"/)
  assert.match(text, /"tenderValueAmount":250000/)
  // Postcodes deduped and upper-cased from both parties and delivery addresses.
  assert.match(text, /"AB1 2CD"/)
  assert.match(text, /"EX4 4AA"/)
})

test('Contracts Finder accepts a directly-embedded release shape and never invents an award', async () => {
  const tenderOnly = {
    ocid: 'ocds-b5fd17-0002',
    date: '2026-07-01',
    tag: ['tender'],
    buyer: { name: 'Another Authority' },
    tender: { title: 'Ecology survey framework', value: { amount: 50000, currency: 'GBP' } },
  }
  const r = await fetchContractsFinderOcds({ now, fetcher: mock({ results: [tenderOnly] }) })
  assert.equal(r.records.length, 1)
  const text = r.records[0].sections[0].text
  // No awards present -> award fields remain null, not fabricated.
  assert.match(text, /"awardedSupplierName":null/)
  assert.match(text, /"awardedValue":null/)
  assert.equal(r.records[0].event_date, '2026-07-01')
})

test('Contracts Finder request carries stage, limit and window parameters', async () => {
  const capture = { url: '' }
  const capturing = (data: unknown) => (((async (u: unknown) => { capture.url = String(u); return Response.json(data) }) as unknown) as typeof fetch)
  await fetchContractsFinderOcds({ now, limit: 10, stages: ['award'], publishedFrom: '2026-01-01', publishedTo: '2026-09-01', fetcher: capturing({ results: [] }) })
  assert.ok(capture.url.startsWith(CONTRACTS_FINDER_SEARCH))
  const decoded = decodeURIComponent(capture.url)
  assert.match(decoded, /stages=award/)
  assert.match(decoded, /limit=10/)
  assert.match(decoded, /publishedFrom=2026-01-01/)
  assert.match(decoded, /publishedTo=2026-09-01/)
})

test('Contracts Finder surfaces cursor pagination and upstream errors honestly', async () => {
  const more = await fetchContractsFinderOcds({ now, limit: 20, offset: 0, fetcher: mock({ results: [awardRelease], links: { next: 'https://example/next-cursor' } }) })
  assert.equal(more.nextOffset, 20)
  const done = await fetchContractsFinderOcds({ now, fetcher: mock({ results: [awardRelease] }) })
  assert.equal(done.nextOffset, null)
  // A non-OK upstream response yields an error result, never a fabricated record.
  const errored = await fetchContractsFinderOcds({ now, fetcher: mockText('nope', { status: 500 }) })
  assert.equal(errored.status, 'error')
  assert.equal(errored.records.length, 0)
})

test('Contracts Finder counts malformed release entries as rejected without aborting the page', async () => {
  const r = await fetchContractsFinderOcds({ now, fetcher: mock({ results: [awardRelease, 42, 'bad'] }) })
  assert.equal(r.records.length, 1)
  assert.equal(r.rejected, 2)
  assert.equal(r.status, 'partial')
})

// ---- Modern.Gov committee RSS ----

const rssFeed = `<?xml version="1.0"?><rss version="2.0"><channel>
  <item><title>Planning Committee: biodiversity net gain report</title>
    <link>https://council.moderngov.co.uk/item/1</link>
    <description><![CDATA[Consideration of a habitat and environmental impact assessment.]]></description>
    <pubDate>Tue, 01 Sep 2026 10:00:00 GMT</pubDate></item>
  <item><title>Finance and Resources Committee</title>
    <link>https://council.moderngov.co.uk/item/2</link>
    <description>Quarterly budget monitoring.</description>
    <pubDate>Wed, 02 Sep 2026 10:00:00 GMT</pubDate></item>
  <item><title>Highways works update</title>
    <link>http://insecure.example/item/3</link>
    <description>Includes a flood risk note.</description></item>
</channel></rss>`

test('Modern.Gov keeps only statutory-environmental items and retains matched keywords', async () => {
  const r = await fetchModGovCommitteeSignals('https://council.moderngov.co.uk/mgFeed.aspx?RSS=1', { now, fetcher: mockText(rssFeed) })
  // Item 1 matches (biodiversity/habitat/environmental impact); item 2 has no keyword and is skipped;
  // item 3 matches a keyword but its link is not https, so it is rejected rather than emitted.
  assert.equal(r.records.length, 1)
  assert.equal(r.rejected, 1)
  assert.equal(r.status, 'partial')
  const rec = r.records[0]
  assert.equal(rec.jurisdiction, 'United Kingdom')
  assert.equal(rec.acquisition_permitted, false)
  assert.equal(rec.url, 'https://council.moderngov.co.uk/item/1')
  assert.equal(rec.event_date, '2026-09-01')
  const text = rec.sections[0].text
  assert.match(text, /"matchedKeywords":\[/)
  assert.match(text, /biodiversity/)
})

test('Modern.Gov requires an https feed URL and never fetches otherwise', async () => {
  let called = false
  const spy = (async () => { called = true; return Response.json({}) }) as typeof fetch
  const r = await fetchModGovCommitteeSignals('http://council.example/feed', { now, fetcher: spy })
  assert.equal(r.status, 'error')
  assert.equal(r.records.length, 0)
  assert.equal(called, false)
})

test('Modern.Gov keyword set is a non-empty statutory allowlist', () => {
  assert.ok(STATUTORY_ENV_KEYWORDS.length > 10)
  assert.ok(STATUTORY_ENV_KEYWORDS.includes('biodiversity'))
  assert.ok(STATUTORY_ENV_KEYWORDS.includes('flood risk'))
})
