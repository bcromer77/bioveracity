import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import React from 'react'
import { act, create } from 'react-test-renderer'

// Render the real upload components and effects. Only visual primitives, the map
// and framework navigation are replaced; fetch responses represent the API.
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const directory = await mkdtemp(path.join(process.cwd(), '.upload-feedback-'))
after(() => rm(directory, { recursive: true, force: true }))
const outfile = path.join(directory, 'components.mjs')
await build({
  stdin: { contents: "export { Investigation } from './components/workspace/workspace-canvas'; export { CaseEvidence } from './components/workspace/case-evidence'; export { getPersona } from './components/workspace/personas.mjs'", resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile,
  plugins: [{ name: 'visual-stubs', setup(builder) {
    builder.onResolve({ filter: /^react(?:\/|$)/ }, ({ path }) => ({ path, external: true }))
    builder.onLoad({ filter: /workspace-canvas\.tsx$/ }, async ({ path }) => ({ contents: (await readFile(path, 'utf8')).replace('function Investigation(', 'export function Investigation('), loader: 'tsx' }))
    builder.onResolve({ filter: /^(next\/|next-auth\/|@\/components\/ui\/)|^\.\/investigation-map$/ }, ({ path }) => ({ path, namespace: 'visual' }))
    builder.onLoad({ filter: /.*/, namespace: 'visual' }, ({ path }) => ({ loader: 'js', contents:
      path === 'next/navigation' ? 'export const usePathname=()=>"/workspace/w", useRouter=()=>({replace(){}}), useSearchParams=()=>new URLSearchParams();' :
      path === 'next-auth/react' ? 'export const useSession=()=>({status:"authenticated",data:{user:{id:"owner"}}});' :
      'import React from "react"; const Box=p=>React.createElement("div",p,p.children); export default p=>React.createElement("a",p,p.children); export const Button=p=>React.createElement("button",p,p.children), Slider=Box, Tabs=Box, TabsList=Box, TabsTrigger=Box, TabsContent=Box, InvestigationMap=Box;'
    }))
  } }],
})
const { Investigation, CaseEvidence, getPersona } = await import(pathToFileURL(outfile).href)
const endpoint = '/api/workspaces/w/cases/c/evidence'
const text = renderer => JSON.stringify(renderer.toJSON())
const file = name => ({ name, size: 20, arrayBuffer: async () => new TextEncoder().encode('synthetic evidence').buffer })

async function mount(t, control, post, options = {}) {
  let gets = 0
  let renderer
  const nativeInput = { value: 'chosen.txt' }
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, init = {}) => {
    if (init.method === 'POST') {
      assert.equal(url, endpoint)
      assert.equal(init.credentials, 'same-origin')
      const body = JSON.parse(init.body)
      assert.equal(body.action, 'import')
      assert.equal(Buffer.from(body.bytes, 'base64').toString(), 'synthetic evidence')
      return post(body)
    }
    if (url === endpoint) { gets++; return options.get ? options.get(gets) : Response.json({ documents: [], events: [] }) }
    if (url === `${endpoint}?action=intelligenceChecks`) return Response.json({ checks: [] })
    if (url === '/api/workspaces/w/cases/c') return Response.json({ id: 'c', title: 'Synthetic case', createdAt: '2026-09-10', sites: [] })
    throw new Error(`Unexpected fetch: ${url}`)
  }
  t.after(async () => { if (renderer) await act(() => renderer.unmount()); globalThis.fetch = originalFetch })
  await act(async () => {
    renderer = create(React.createElement(control === 'top' ? Investigation : CaseEvidence, { workspaceId: 'w', caseId: 'c', persona: getPersona('ecology'), reportTitle: 'Synthetic test', onSelectCase() {}, externalRevision: 0 }), { createNodeMock: element => element.type === 'input' && element.props.type === 'file' ? nativeInput : null })
  })
  const upload = async files => {
    if (control === 'top') return renderer.root.findAllByType('input').find(x => x.props.type === 'file' && !x.props.name).props.onChange({ target: { files } })
    nativeInput.files = files
    return renderer.root.findAllByType('form').find(x => x.findAllByType('input').some(y => y.props.name === 'files')).props.onSubmit({ preventDefault() {}, currentTarget: { elements: { namedItem: () => nativeInput }, reset() { nativeInput.value = '' } } })
  }
  return { renderer, nativeInput, upload, gets: () => gets }
}

for (const control of ['top', 'detailed']) {
  test(`${control}: failed import remains visible after automatic refresh and permits same-file retry`, async t => {
    let calls = 0
    const state = await mount(t, control, () => { calls++; return Response.json({ error: 'Security scanner unavailable. Nothing imported.' }, { status: 503 }) })
    const before = state.gets()
    await act(() => state.upload([file('chosen.txt')]))
    assert.match(text(state.renderer), /Security scanner unavailable/)
    assert.doesNotMatch(text(state.renderer), /Scanning and extracting|Processing “|Processing…/)
    assert.ok(state.gets() > before, 'the evidence was actually refreshed')
    assert.equal(state.nativeInput.value, '')
    await act(() => state.upload([file('chosen.txt')]))
    assert.equal(calls, 2)
    assert.match(text(state.renderer), /Security scanner unavailable/)
  })

  test(`${control}: partial batch failure preserves its count and refreshes persisted evidence`, async t => {
    let calls = 0
    const state = await mount(t, control, () => ++calls === 1 ? Response.json({ duplicate: false }) : Response.json({ error: 'Second file rejected.' }, { status: 422 }))
    await act(() => state.upload([file('first.txt'), file('second.txt')]))
    assert.match(text(state.renderer), /Second file rejected/)
    assert.match(text(state.renderer), /1 file\(s\) (?:imported|completed) before this error/)
    assert.doesNotMatch(text(state.renderer), /Scanning and extracting|Processing “|Processing…/)
  })

  test(`${control}: pending upload is not announced as imported; success reloads server evidence`, async t => {
    let finish
    let saved = false
    const state = await mount(t, control, () => new Promise(resolve => { finish = () => { saved = true; resolve(Response.json({ duplicate: false })) } }), {
      get: () => Response.json({ documents: saved ? [{ id: 'd', name: 'persisted.txt', status: 'PARSED', hash: 'synthetic', warnings: [], importedAt: '2026-09-10', parentId: null, supersedesId: null, sourceUrl: null, publicationDate: null }] : [], events: [] }),
    })
    let pending
    await act(async () => { pending = state.upload([file('persisted.txt')]); await Promise.resolve() })
    assert.match(text(state.renderer), /Processing|Scanning and extracting/)
    assert.doesNotMatch(text(state.renderer), /Imported 1 of|1 file\(s\) imported/)
    await act(async () => { finish(); await pending })
    assert.match(text(state.renderer), /Imported 1 of 1|1 file\(s\) imported/)
    assert.match(text(state.renderer), /persisted.txt/)
  })
}
