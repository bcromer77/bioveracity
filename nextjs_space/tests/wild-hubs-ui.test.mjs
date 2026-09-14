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
      "export { SeasonalLanding } from './components/wild/seasonal-landing'; export { HubStudio } from './components/wild/hub-studio'; export { generatePlan } from './lib/wild-hubs/domain'; export { authReturnPath } from './lib/auth-return-path'",
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
const { SeasonalLanding, HubStudio, generatePlan, authReturnPath } =
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
    assert.equal(authReturnPath(value), '/workspace')
})

test('self-service retry preserves creation identity; saved draft, edits and approval remain separate', async (t) => {
  const originalFetch = globalThis.fetch,
    originalWindow = globalThis.window
  globalThis.window = {
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
      if (data.action === 'publish') {
        assert.equal(data.approved, true)
        assert.equal(data.authorised, true)
        hub = {
          ...hub,
          revision: hub.revision + 1,
          published: {
            profile: hub.profile,
            plan: hub.plan,
            photoIds: [],
            version: hub.revision + 1,
            approvedAt: new Date().toISOString(),
          },
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
  assert.equal(button(r, 'Approve and publish').props.disabled, true)
  await change('campaign-title', 'An edited autumn invitation')
  assert.equal(
    r.root.findByProps({ id: 'hub-name' }).parent.props.disabled,
    true,
    'profile editing is locked while plan edits are unsaved',
  )
  assert.equal(button(r, 'Approve and publish').props.disabled, true)
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
  assert.equal(button(r, 'Approve and publish').props.disabled, false)
  await act(() => button(r, 'Approve and publish').props.onClick())
  assert.ok(hub.published)
  assert.match(text(r), /Open public ecology hub/)
  assert.equal(
    button(r, 'Approve and publish').props.disabled,
    true,
    'approval resets after publishing',
  )
})
