import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { RegionalSearch } from '../components/wild/regional-search'

// Next Link's idle-callback fallback needs the browser global in this renderer.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, self: globalThis })
test('regional UI searches real place accounts and exposes coverage instead of claiming a populated occurrence feed', async () => {
  let ui!: ReactTestRenderer
  await act(async () => { ui = create(<RegionalSearch snapshot={null} status="Occurrence import not configured" />) })
  assert.equal(ui.root.findAllByType('article').length, 13)
  const button = (name: string) => ui.root.findAllByType('button').find(b => b.props.children === name)!
  await act(async () => { button('badgers').props.onClick() })
  assert.equal(ui.root.findAllByType('article').length, 1)
  assert.ok(JSON.stringify(ui.toJSON()).includes('Overhall Grove'))
  assert.ok(JSON.stringify(ui.toJSON()).includes('not a dated field observation'))
  await act(async () => { button('snowdrops').props.onClick() })
  assert.equal(ui.root.findAllByType('article').length, 1)
  assert.ok(JSON.stringify(ui.toJSON()).includes('Cultivated display'))
  assert.ok(ui.root.findAllByType('a').some(a => a.props.href === '/wild/cambridgeshire#anglesey-abbey'))
  const area = ui.root.findAllByType('select').find(s => s.props.value === '')!
  await act(async () => { area.props.onChange({ target: { value: 'E06000031' } }) })
  assert.equal(ui.root.findAllByType('article').length, 0)
  assert.ok(JSON.stringify(ui.toJSON()).includes('No matching evidence'))
  assert.ok(JSON.stringify(ui.toJSON()).includes('not imported'))
  assert.ok(JSON.stringify(ui.toJSON()).includes('not measured'))
  assert.equal(button('Download study results').props.disabled, true)
  await act(async () => ui.unmount())
})
