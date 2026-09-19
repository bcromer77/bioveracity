import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import React from 'react'
import { act, create } from 'react-test-renderer'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const directory = await mkdtemp(path.join(process.cwd(), '.wild-ui-'))
after(() => rm(directory, { recursive: true, force: true }))
const outfile = path.join(directory, 'components.mjs')
await build({
  stdin: {
    contents:
      "export { SeasonalLanding } from './components/wild/seasonal-landing'; export { HubStudio } from './components/wild/hub-studio'; export { VenueJoin } from './components/wild/venue-join'; export { generatePlan } from './lib/wild-hubs/domain'; export { authReturnPath } from './lib/auth-return-path'",
    resolveDir: process.cwd(),
    loader: 'tsx',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  outfile,
  plugins: [
    {
      name: 'framework-link',
      setup(b) {
        b.onResolve({ filter: /^react(?:\/|$)/ }, ({ path }) => ({
          path,
          external: true,
        }))
        b.onResolve({ filter: /^next\/link$/ }, ({ path }) => ({
          path,
          namespace: 'link',
        }))
        b.onLoad({ filter: /.*/, namespace: 'link' }, () => ({
          loader: 'js',
          contents:
            'import React from "react"; export default p=>React.createElement("a",p,p.children);',
        }))
      },
    },
  ],
})
const { SeasonalLanding, HubStudio, VenueJoin, generatePlan, authReturnPath } =
  await import(pathToFileURL(outfile).href)
const text = (r) => JSON.stringify(r.toJSON())
const button = (r, label) =>
  r.root.findAllByType('button').find((n) => n.children.join('') === label)

test('season control changes the guest campaign and hub preview together', async () => {
  let r
  await act(() => {
    r = create(React.createElement(SeasonalLanding))
  })
  assert.match(text(r), /Give guests a reason/)
  assert.doesNotMatch(text(r), /Enniscorthy|Your woodland venue/)
  await act(() => button(r, 'Winter').props.onClick())
  assert.equal(button(r, 'Winter').props['aria-pressed'], true)
  assert.match(text(r), /DECEMBER/)
  assert.match(text(r), /Keep the curiosity going/)
  assert.equal(
    r.root.findAllByType('a').filter((a) => a.props.href === '/wild/studio')
      .length,
    0,
  )
  assert.equal(
    r.root
      .findAllByType('a')
      .filter((a) => a.props.href === '/wild/partners#enquire').length,
    2,
  )
  await act(() => r.unmount())
})

test('sign-in returns only to local routes, including the ecology studio', () => {
  assert.equal(authReturnPath('/wild/studio'), '/wild/studio')
  for (const value of [
    '//evil.example',
    'https://evil.example',
    'javascript:alert(1)',
    '/\\evil.example',
    '/\nevil',
    null,
  ])
    assert.equal(authReturnPath(value), '/start')
})

test('self-service retry preserves creation identity; saved draft, edits and approval remain separate', async (t) => {
  const originalFetch = globalThis.fetch,
    originalWindow = globalThis.window
  globalThis.window = {
    location: { search: '' },
    addEventListener() {},
    removeEventListener() {},
    confirm() {
      return true
    },
  }
  let r,
    hub = null,
    attempts = 0,
    requests = []
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).startsWith('/api/wild/nature/')) return Response.json({status:'unsupported',records:[],county:'Down',checkedAt:'2026-09-14T00:00:00Z',inspected:0,excluded:0,note:'Fixture only'})
    if (init.method === 'POST') {
      const data = JSON.parse(init.body)
      requests.push(data)
      attempts++
      if (attempts === 1)
        return Response.json(
          { error: 'Temporary storage failure' },
          { status: 503 },
        )
      hub = {
        id: data.requestId,
        profile: {
          name: data.name,
          county: data.county,
          kind: data.kind,
          story: data.story,
          website: data.website,
          interests: data.interests,
        },
        revision: 1,
        photos: [],
        published: null,
        plan: null,
        trend: null,
      }
      return Response.json({ hub })
    }
    if (init.method === 'PATCH') {
      const data = JSON.parse(init.body)
      assert.equal(data.revision, hub.revision)
      if (data.action === 'generate')
        hub = {
          ...hub,
          plan: generatePlan(hub.profile, data.year, null),
          revision: hub.revision + 1,
        }
      if (data.action === 'edit-plan')
        hub = {
          ...hub,
          plan: { ...hub.plan, campaigns: data.campaigns },
          revision: hub.revision + 1,
        }
      if (data.action === 'submit') {
        assert.equal(data.approved, true)
        assert.equal(data.authorised, true)
        hub = {
          ...hub,
          revision: hub.revision + 1,
          review: {id:'test-review',status:'PENDING',reason:'',photoIds:[]},
        }
      }
      return Response.json({ hub })
    }
    return Response.json({
      hubs: hub ? [{ id: hub.id, profile: hub.profile }] : [],
    })
  }
  t.after(async () => {
    if (r) await act(() => r.unmount())
    globalThis.fetch = originalFetch
    globalThis.window = originalWindow
  })
  await act(() => {
    r = create(React.createElement(HubStudio))
  })
  const change = async (id, value) =>
    act(() => r.root.findByProps({ id }).props.onChange({ target: { value } }))
  await change('hub-name', 'Test City Hotel')
  await change('hub-story', 'A fictional city hotel.')
  const submit = () =>
    act(() =>
      r.root.findAllByType('form')[0].props.onSubmit({ preventDefault() {} }),
    )
  await submit()
  assert.match(text(r), /Temporary storage failure/)
  assert.equal(
    r.root.findByProps({ id: 'hub-name' }).props.value,
    'Test City Hotel',
  )
  await submit()
  assert.equal(requests[0].requestId, requests[1].requestId)
  await act(() => button(r, 'Generate seasonal plan').props.onClick())
  assert.equal(button(r, 'Submit for editorial review').props.disabled, true)
  await change('campaign-title', 'An edited autumn invitation')
  assert.equal(
    r.root.findByProps({ id: 'hub-name' }).parent.props.disabled,
    true,
    'profile editing is locked while plan edits are unsaved',
  )
  assert.equal(button(r, 'Submit for editorial review').props.disabled, true)
  await act(() => button(r, 'Save plan edits').props.onClick())
  assert.equal(
    r.root.findByProps({ id: 'hub-name' }).parent.props.disabled,
    false,
  )
  const approvals = r.root
    .findAllByType('input')
    .filter((n) => n.props.type === 'checkbox')
    .slice(-2)
  await act(() => {
    approvals[0].props.onChange({ target: { checked: true } })
    approvals[1].props.onChange({ target: { checked: true } })
  })
  assert.equal(button(r, 'Submit for editorial review').props.disabled, false)
  await act(() => button(r, 'Submit for editorial review').props.onClick())
  assert.equal(hub.published, null)
  assert.match(text(r), /PENDING/)
  assert.doesNotMatch(text(r), /Open public ecology hub/)
  assert.equal(
    button(r, 'Submit for editorial review').props.disabled,
    true,
    'approval resets after publishing',
  )
})

test('studio opens the named place and automatically opens a sole owned place', async () => {
  const oldFetch = globalThis.fetch, oldWindow = globalThis.window
  try {
    const profile = { name: 'Prepared fixture', county: 'down', kind: 'food', story: 'A fictional place.', website: '', interests: ['nature'] }
    const hub = { id: 'prepared', profile, revision: 1, photos: [], published: null, plan: null, trend: null }
    for (const search of ['', '?hub=prepared']) {
      const requests = []
      globalThis.window = { location: { search }, addEventListener() {}, removeEventListener() {} }
      globalThis.fetch = async url => {
        requests.push(url)
        if (url === '/api/wild/hubs') return Response.json({ hubs: [hub] })
        if (url === '/api/wild/hubs/prepared') return Response.json({ hub })
        return Response.json({ status: 'unsupported', records: [], note: 'Fixture' })
      }
      let r
      await act(async () => { r = create(React.createElement(HubStudio)) })
      assert.equal(r.root.findByProps({ id: 'hub-name' }).props.value, 'Prepared fixture')
      assert.ok(requests.includes('/api/wild/hubs/prepared'))
      await act(() => r.unmount())
    }
  } finally { globalThis.fetch = oldFetch; globalThis.window = oldWindow }
})

test('studio refuses a requested place outside the owned list without fetching it', async () => {
  const oldFetch = globalThis.fetch, oldWindow = globalThis.window
  try {
    const requests = []
    globalThis.window = { location: { search: '?hub=someone-elses-place' }, addEventListener() {}, removeEventListener() {} }
    globalThis.fetch = async url => { requests.push(url); return Response.json({ hubs: [] }) }
    let r
    await act(async () => { r = create(React.createElement(HubStudio)) })
    assert.match(text(r), /not available to your account/)
    assert.deepEqual(requests, ['/api/wild/hubs'])
    await act(() => r.unmount())
  } finally { globalThis.fetch = oldFetch; globalThis.window = oldWindow }
})

test('venue setup token survives login in this tab and is claimed only after confirmation', async () => {
  const oldFetch = globalThis.fetch, oldWindow = globalThis.window, oldStorage = globalThis.sessionStorage
  try {
    const values = new Map(), token = 'a'.repeat(43), destination = '/wild/studio?hub=11111111-1111-4111-8111-111111111111'
    const requests = []; let navigated = ''
    globalThis.sessionStorage = { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) }
    globalThis.window = { location: { hash: `#token=${token}`, assign: value => { navigated = value } }, history: { replaceState: () => { globalThis.window.location.hash = '' } } }
    globalThis.fetch = async (url, init) => { requests.push({ url, body: JSON.parse(init.body) }); return Response.json({ destination }) }
    let r
    await act(async () => { r = create(React.createElement(VenueJoin, { signedIn: false })) })
    assert.equal(requests.length, 0)
    assert.equal(globalThis.window.location.hash, '')
    assert.ok(r.root.findAllByType('a').every(a => !a.props.href.includes(token)))
    await act(() => r.unmount())
    await act(async () => { r = create(React.createElement(VenueJoin, { signedIn: true })) })
    assert.equal(button(r, 'Open my prepared place').props.disabled, true)
    await act(() => r.root.findByType('input').props.onChange({ target: { checked: true } }))
    await act(() => button(r, 'Open my prepared place').props.onClick())
    assert.deepEqual(requests, [{ url: '/api/wild/join', body: { token, confirmed: true } }])
    assert.equal(navigated, destination)
    assert.equal(values.size, 0)
    await act(() => r.unmount())
  } finally { globalThis.fetch = oldFetch; globalThis.window = oldWindow; globalThis.sessionStorage = oldStorage }
})
