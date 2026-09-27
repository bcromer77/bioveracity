import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import React from 'react'
import { act, create } from 'react-test-renderer'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const directory = await mkdtemp(path.join(process.cwd(), '.wild-null-plan-'))
after(() => rm(directory, { recursive: true, force: true }))
const outfile = path.join(directory, 'components.mjs')
await build({
  stdin: {
    contents:
      "export { PublishedHub } from './components/wild/published-hub'; export * from './components/admin/wild-review-queue'; export { generatePlan } from './lib/wild-hubs/domain'; export { nullPlanSnapshot } from './tests/fixtures/wild-null-plan-snapshot'",
    resolveDir: process.cwd(),
    loader: 'tsx',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  outfile,
  plugins: [{
    name: 'framework-link',
    setup(b) {
      b.onResolve({ filter: /^react(?:\/|$)/ }, ({ path }) => ({ path, external: true }))
      b.onResolve({ filter: /^next\/link$/ }, ({ path }) => ({ path, namespace: 'link' }))
      b.onLoad({ filter: /.*/, namespace: 'link' }, () => ({ loader: 'js', contents: 'import React from "react"; export default p=>React.createElement("a",p,p.children);' }))
      b.onResolve({ filter: /^next-auth\/react$/ }, ({ path }) => ({ path, namespace: 'session' }))
      b.onLoad({ filter: /.*/, namespace: 'session' }, () => ({ loader: 'js', contents: 'export const useSession=()=>({data:null,status:"unauthenticated"}); export const signIn=()=>{}; export const signOut=()=>{}; export const SessionProvider=p=>p.children;' }))
      b.onResolve({ filter: /^next\/navigation$/ }, ({ path }) => ({ path, namespace: 'nav' }))
      b.onLoad({ filter: /.*/, namespace: 'nav' }, () => ({ loader: 'js', contents: 'export const usePathname=()=>"/wild/hub/fixture"; export const useRouter=()=>({push(){},replace(){},refresh(){}}); export const useSearchParams=()=>new URLSearchParams(); export const redirect=()=>{}; export const notFound=()=>{};' }))
    },
  }],
})
const { PublishedHub, WildReviewQueue, ReviewPlanDetails, generatePlan, nullPlanSnapshot } = await import(pathToFileURL(outfile).href)
const text = (r) => JSON.stringify(r.toJSON())
const photos = nullPlanSnapshot.photoIds.map((id) => ({ id, caption: 'Fixture caption', credit: 'Fixture credit' }))

async function withFetch(fn) {
  const original = globalThis.fetch
  globalThis.fetch = async () => Response.json({ status: 'unsupported', records: [], note: 'Fixture only' })
  try { return await fn() } finally { globalThis.fetch = original }
}

test('PublishedHub renders the exact legacy plan:null snapshot without the seasonal section', () => withFetch(async () => {
  const snapshot = structuredClone(nullPlanSnapshot)
  let r
  await act(async () => { r = create(React.createElement(PublishedHub, { id: 'hub-null', snapshot, photos })) })
  const out = text(r)
  assert.match(out, /Null Plan Fixture Hotel/)
  assert.match(out, /A fictional legacy venue story/)
  assert.match(out, /Venue-approved edition/)
  assert.doesNotMatch(out, /Seasonal inspiration/)
  assert.deepEqual(snapshot, nullPlanSnapshot, 'rendering must not mutate the snapshot')
  await act(() => r.unmount())
}))

test('PublishedHub still shows the seasonal section when a current plan exists', () => withFetch(async () => {
  const [, month, year] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Dublin', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date()).split('/').map(Number)
  const plan = generatePlan(nullPlanSnapshot.profile, year, null)
  const snapshot = { ...structuredClone(nullPlanSnapshot), plan }
  let r
  await act(async () => { r = create(React.createElement(PublishedHub, { id: 'hub-plan', snapshot, photos })) })
  assert.ok(plan.campaigns.some((c) => c.month === month))
  assert.match(text(r), new RegExp(`"${year}"," · Seasonal inspiration"`))
  await act(() => r.unmount())
}))

test('admin Wild review queue lists a plan:null submission without crashing', async () => {
  const original = globalThis.fetch
  const review = { id: 'review-null', hubId: 'hub-null', revision: 8, snapshot: structuredClone(nullPlanSnapshot), photos }
  globalThis.fetch = async () => Response.json({ reviews: [review], storage: { count: 2, bytes: '2' } })
  let r
  try {
    await act(async () => { r = create(React.createElement(WildReviewQueue)) })
    const out = text(r)
    assert.doesNotMatch(out, /"role":"alert"/)
    assert.match(out, /Null Plan Fixture Hotel/)
    assert.match(out, /No seasonal plan submitted/)
    assert.match(out, /Approve and publish reviewed version/)
  } finally {
    if (r) await act(() => r.unmount())
    globalThis.fetch = original
  }
})

test('admin review details render a null plan as "No seasonal plan submitted"', async () => {
  let r
  await act(() => { r = create(React.createElement(ReviewPlanDetails, { interests: nullPlanSnapshot.profile.interests, plan: null })) })
  assert.match(text(r), /No seasonal plan submitted/)
  assert.doesNotMatch(text(r), /Plan year/)
  await act(() => r.unmount())
  const plan = generatePlan(nullPlanSnapshot.profile, 2026, null)
  await act(() => { r = create(React.createElement(ReviewPlanDetails, { interests: ['nature'], plan })) })
  assert.match(text(r), /Plan year/)
  assert.match(text(r), /2026/)
  await act(() => r.unmount())
})
