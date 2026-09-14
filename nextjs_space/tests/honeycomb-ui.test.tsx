import { after, before, test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

// Real panel state/effects; only Next dynamic (Leaflet) and button styling mocked.
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let directory: string
let Panel: React.ComponentType<{ workspaceId: string; caseId: string; lat: number; lng: number }>
before(async () => {
  directory = await mkdtemp(path.join(process.cwd(), '.honeycomb-ui-'))
  const outfile = path.join(directory, 'panel.mjs')
  await build({
    entryPoints: ['components/workspace/honeycomb-panel.tsx'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    outfile,
    jsx: 'automatic',
    plugins: [
      {
        name: 'visual-stubs',
        setup(builder) {
          builder.onResolve({ filter: /^react(?:\/|$)/ }, ({ path }) => ({ path, external: true }))
          builder.onResolve({ filter: /^(next\/dynamic|@\/components\/ui\/button)$/ }, ({ path }) => ({
            path,
            namespace: 'visual'
          }))
          builder.onLoad({ filter: /.*/, namespace: 'visual' }, ({ path }) => ({
            loader: 'js',
            contents:
              path === 'next/dynamic'
                ? 'import React from "react"; export default ()=>props=>React.createElement("mock-map",props);'
                : 'import React from "react"; export const Button=props=>React.createElement("button",props,props.children);'
          }))
          builder.onResolve({ filter: /honeycomb-map-inner$/ }, () => ({ path: 'map', namespace: 'map' }))
          builder.onLoad({ filter: /.*/, namespace: 'map' }, () => ({
            contents: 'export default ()=>null',
            loader: 'js'
          }))
        }
      }
    ]
  })
  Panel = (await import(pathToFileURL(outfile).href)).HoneycombPanel
})
after(async () => {
  if (directory) await rm(directory, { recursive: true, force: true })
})
const props = { workspaceId: 'w', caseId: 'c', lat: 52.65, lng: -7.25 }
const empty = () => ({ results: [], sources: [], retrievedAt: '2026-09-14T12:00:00Z' })
const text = (renderer: ReactTestRenderer) => JSON.stringify(renderer.toJSON())
async function mount(t: TestContext, fetcher: typeof fetch) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = fetcher
  let renderer!: ReactTestRenderer
  await act(() => {
    renderer = create(React.createElement(Panel, props))
  })
  t.after(async () => {
    await act(() => renderer.unmount())
    globalThis.fetch = originalFetch
  })
  return renderer
}
const submit = (r: ReactTestRenderer) =>
  r.root.findByType('form').props.onSubmit({ preventDefault() {} }) as Promise<void>
const inputs = (r: ReactTestRenderer) => r.root.findAllByType('input')
const query = (r: ReactTestRenderer) => inputs(r).find((input) => input.props.maxLength === 160)!
const map = (r: ReactTestRenderer) => r.root.findByType('mock-map' as React.ElementType)

test('waits for explicit search and sends selected cells, words and dates with same-origin credentials', async (t) => {
  const calls: Array<{ url: unknown; init?: RequestInit }> = []
  const r = await mount(t, async (url, init) => {
    calls.push({ url, init })
    return Response.json(empty())
  })
  assert.equal(calls.length, 0)
  await act(() => query(r).props.onChange({ target: { value: ' River Nore ' } }))
  const dates = inputs(r).filter((input) => input.props.type === 'date')
  await act(() => dates[0].props.onChange({ target: { value: '2024-01-01' } }))
  await act(() => dates[1].props.onChange({ target: { value: '2025-01-01' } }))
  assert.equal(calls.length, 0)
  await act(() => submit(r))
  assert.equal(calls[0].url, '/api/workspaces/w/cases/c/honeycomb')
  assert.equal(calls[0].init!.credentials, 'same-origin')
  const body = JSON.parse(calls[0].init!.body as string)
  assert.equal(body.q, 'River Nore')
  assert.equal(body.from, '2024-01-01')
  assert.equal(body.to, '2025-01-01')
  assert.equal(body.cells.length, 1)
})

test('map selection cannot exceed seven cells and checkboxes remain usable to deselect', async (t) => {
  const r = await mount(t, async () => Response.json(empty()))
  for (let i = 0; i < 8; i++) {
    const state = map(r).props
    const next = state.cells.find((cell: { id: string }) => !state.selected.includes(cell.id))
    await act(() => state.onToggle(next.id))
  }
  assert.equal(map(r).props.selected.length, 7)
  assert.match(text(r), /at most seven/)
  const selected = inputs(r).find((input) => input.props.type === 'checkbox' && input.props.checked)!
  assert.equal(selected.props.disabled, false)
  await act(() => selected.props.onChange())
  assert.equal(map(r).props.selected.length, 6)
})

test('query changes abort pending fetch and late responses cannot overwrite newer results', async (t) => {
  const pending: Array<{ init?: RequestInit; resolve: (r: Response) => void }> = []
  const r = await mount(
    t,
    async (_url, init) => new Promise<Response>((resolve) => pending.push({ init, resolve }))
  )
  let first!: Promise<void>, second!: Promise<void>
  await act(async () => {
    first = submit(r)
    await Promise.resolve()
  })
  await act(() => query(r).props.onChange({ target: { value: 'new query' } }))
  assert.equal(pending[0].init!.signal!.aborted, true)
  await act(async () => {
    second = submit(r)
    await Promise.resolve()
  })
  await act(async () => {
    pending[1].resolve(
      Response.json({
        ...empty(),
        sources: [{ id: 'new', label: 'NEW RESPONSE', status: 'ok', returned: 0, note: 'Checked' }]
      })
    )
    await second
  })
  await act(async () => {
    pending[0].resolve(
      Response.json({
        ...empty(),
        sources: [{ id: 'old', label: 'STALE RESPONSE', status: 'ok', returned: 0, note: 'Checked' }]
      })
    )
    await first
  })
  assert.match(text(r), /NEW RESPONSE/)
  assert.doesNotMatch(text(r), /STALE RESPONSE/)
})

test('source failure is visibly distinct from no matching records', async (t) => {
  const r = await mount(t, async () =>
    Response.json({
      ...empty(),
      sources: [
        {
          id: 'npws',
          label: 'NPWS',
          status: 'error',
          returned: 0,
          note: 'Provider timed out; source not checked.'
        }
      ]
    })
  )
  await act(() => submit(r))
  assert.match(text(r), /Unavailable/)
  assert.match(text(r), /Provider timed out/)
  assert.match(text(r), /does not establish that no relevant records exist/)
})

test('size and place changes abort pending work and reset query, selection and results', async (t) => {
  const pending: Array<{ init?: RequestInit; resolve: (r: Response) => void }> = []
  const r = await mount(
    t,
    async (_url, init) => new Promise<Response>((resolve) => pending.push({ init, resolve }))
  )
  await act(() => query(r).props.onChange({ target: { value: 'old' } }))
  let first!: Promise<void>
  await act(async () => {
    first = submit(r)
    await Promise.resolve()
  })
  await act(() => r.root.findByType('select').props.onChange({ target: { value: '500' } }))
  assert.equal(pending[0].init!.signal!.aborted, true)
  assert.equal(query(r).props.value, '')
  assert.equal(map(r).props.selected.length, 1)
  assert.equal(map(r).props.cells[0].size, 500)
  await act(async () => {
    pending[0].resolve(Response.json(empty()))
    await first
  })
  assert.doesNotMatch(text(r), /Retrieved:/)
  const oldCell = map(r).props.selected[0]
  await act(() => r.update(React.createElement(Panel, { ...props, lat: 52.5, lng: -6.56 })))
  assert.notEqual(map(r).props.selected[0], oldCell)
  assert.equal(map(r).props.selected.length, 1)
})

test('record type filters preserve counts and paginate cards without another source request', async (t) => {
  const results = Array.from({ length: 31 }, (_, index) => ({
    id: `p${index}`,
    kind: 'planning',
    title: `PLANNING_${index}`,
    sourceUrl: 'https://example.org/source',
    publisher: 'Test source',
    licence: 'Test',
    eventDate: null,
    datePrecision: 'unknown',
    matchReason: 'Reported point',
    cellIds: ['test'],
    details: 'Synthetic test record',
    spatialRelation: 'reported-point-in-cell'
  }))
  results.push({ ...results[0], id: 'bat', kind: 'species', title: 'BAT_RECORD' })
  let calls = 0
  const r = await mount(t, async () => {
    calls++
    return Response.json({ ...empty(), results })
  })
  await act(() => submit(r))
  const headings = () => r.root.findAllByType('h3').map((node) => node.children.join(''))
  assert.ok(headings().includes('PLANNING_24'))
  assert.ok(!headings().includes('PLANNING_25'))
  const more = r.root.findAllByType('button').find((button) => button.children.join('').startsWith('Show '))!
  await act(() => more.props.onClick())
  assert.ok(headings().includes('BAT_RECORD'))
  const bats = r.root.findAllByType('button').find((button) => button.children[0] === 'Bats')!
  await act(() => bats.props.onClick())
  assert.ok(headings().includes('BAT_RECORD'))
  assert.ok(!headings().includes('PLANNING_0'))
  assert.equal(map(r).props.hits.length, 1)
  const all = r.root.findAllByType('button').find((button) => button.children[0] === 'All')!
  await act(() => all.props.onClick())
  assert.ok(headings().includes('PLANNING_24'))
  assert.ok(!headings().includes('PLANNING_25'))
  assert.equal(map(r).props.hits.length, 32)
  assert.equal(calls, 1)
})
