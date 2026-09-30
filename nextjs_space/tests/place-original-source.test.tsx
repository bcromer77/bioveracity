// EVIDENCE -> ORIGINAL SOURCE: the cleared NPWS reference is a real, safe outbound link;
// anything not exactly allowlisted keeps the on-site disclosure.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { OriginalSourceLink, originalSourceHref, ORIGINAL_SOURCE_ORIGINS } from '../components/original-source-link'

const NPWS = 'https://www.npws.ie/protected-sites/spa/004188'
const render = (href: string) => renderToStaticMarkup(createElement(OriginalSourceLink, { href, className: 'x', children: 'National Parks and Wildlife Service' }))

test('OS1. the cleared NPWS source renders as one safe external anchor to the exact URL', () => {
  assert.deepEqual(ORIGINAL_SOURCE_ORIGINS, ['https://www.npws.ie'])
  const html = render(NPWS)
  const anchors = [...html.matchAll(/<a\b[^>]*>/g)].map((m) => m[0])
  assert.equal(anchors.length, 1)
  assert.ok(anchors[0].includes(`href="${NPWS}"`), 'exact destination')
  assert.ok(/rel="external noopener noreferrer"/.test(anchors[0]) && /referrerPolicy="no-referrer"/i.test(anchors[0]))
  assert.ok(!/target=/.test(anchors[0]), 'same tab, no window.opener surface')
  assert.match(html, />National Parks and Wildlife Service<span class="sr-only"> \(original source, external site npws\.ie\)<\/span><\/a>/, 'accessible name names the publisher and the external destination')
  assert.ok(!/<button\b/.test(html))
})

test('OS2. anything not exactly allowlisted stays an on-site disclosure (no navigation)', () => {
  for (const bad of [
    'http://www.npws.ie/protected-sites/spa/004188', 'https://npws.ie.evil.example/x', 'https://evil.example/?u=https://www.npws.ie/',
    'https://user:pw@www.npws.ie/x', 'https://www.npws.ie:8443/x', 'https://www.npws.ie/x#frag', 'javascript:alert(1)',
    'https://www.npws.ie/a b', 'https://WWW.NPWS.IE/x', 'https://example.com/private', '//www.npws.ie/x', '',
  ]) {
    assert.equal(originalSourceHref(bad), null, bad)
    if (bad) {
      const html = render(bad)
      assert.ok(!/<a\b/.test(html), `no anchor for ${bad}`)
      assert.ok(/<button type="button"[^>]*aria-expanded="false"/.test(html), `disclosure for ${bad}`)
    }
  }
  assert.equal(originalSourceHref(NPWS), NPWS)
})

test('OS3. only the Evidence -> Original Source line uses the outbound link; other sources keep the disclosure', async () => {
  const arrive = await readFile('components/place/place-arrive.tsx', 'utf8')
  assert.equal((arrive.match(/<OriginalSourceLink\b/g) ?? []).length, 1)
  assert.match(arrive, /Open the original source: <OriginalSourceLink href=\{k\.source\.url\}/)
  const component = await readFile('components/original-source-link.tsx', 'utf8')
  assert.ok(!/'use client'/.test(component), 'server component: no client JS added')
  assert.ok(!/fetch\(|window\.|location\.|target="_blank"/.test(component))
})
