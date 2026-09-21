import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import React from 'react'
import { act, create } from 'react-test-renderer'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const directory = await mkdtemp(path.join(process.cwd(), '.venue-photo-ui-'))
after(() => rm(directory, { recursive: true, force: true }))
const outfile = path.join(directory, 'components.mjs')
await build({
  stdin: {
    contents: "export { VenuePhotoJournal } from './components/wild/venue-photo-journal'; export { VenuePhotoContribute } from './components/wild/venue-photo-contribute'; export { VenuePhotoWithdraw } from './components/wild/venue-photo-withdraw';",
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
const { VenuePhotoJournal, VenuePhotoContribute, VenuePhotoWithdraw } = await import(pathToFileURL(outfile).href)
const text = r => JSON.stringify(r.toJSON())
const button = (r,label) => r.root.findAllByType('button').find(n=>n.children.join('')===label)

test('owner browses observation years, downloads privately and requests reviewed publication',async()=>{
 const oldFetch=globalThis.fetch,oldWindow=globalThis.window
 const photos=[{id:'one',caption:'Lichen',credit:'A',location:'Wall',observedOn:'2026-09-19',createdAt:'2026-09-20',status:'RECEIVED',revision:1,reason:''},{id:'two',caption:'Branches',credit:'B',location:'Path',observedOn:'2025-12-10',createdAt:'2026-09-20',status:'PUBLISHED',revision:3,reason:''}]
 const writes=[];let r
 globalThis.window={confirm:()=>true}
 globalThis.fetch=async(url,options={})=>{if(options.body)writes.push(JSON.parse(options.body));return Response.json({photos,settings:{weeklyEnabled:true,contributionsEnabled:true}})}
 try{
  await act(async()=>{r=create(React.createElement(VenuePhotoJournal,{hubId:'venue'}))})
  assert.match(text(r),/Lichen/)
  await act(()=>r.root.findByProps({id:'photo-year'}).props.onChange({target:{value:'2025'}}))
  assert.doesNotMatch(text(r),/Lichen/);assert.match(text(r),/Branches/)
  await act(()=>r.root.findByProps({id:'photo-year'}).props.onChange({target:{value:'all'}}))
  await act(()=>r.root.findByProps({'aria-label':'Select photograph: Lichen'}).props.onClick())
  await act(()=>r.root.findByProps({'aria-label':'Select photograph: Branches'}).props.onClick())
  const downloads=r.root.findAllByType('a').filter(a=>a.props.href.includes('download=1'))
  assert.equal(downloads.length,2);assert.ok(downloads.every(a=>a.props.href.includes('mode=owner')))
  await act(()=>button(r,'Publish to public page').props.onClick())
  assert.deepEqual(writes[0],{action:'submit',photoId:'one',revision:1})
  assert.match(text(r),/remains private until approved/)
  globalThis.window.confirm=()=>false
  await act(()=>button(r,'Publish to public page').props.onClick())
  assert.equal(writes.length,1)
  await act(()=>button(r,'Save preferences').props.onClick())
  assert.deepEqual(writes[1],{action:'settings',weeklyEnabled:true,contributionsEnabled:true})
 }finally{if(r)await act(()=>r.unmount());globalThis.fetch=oldFetch;globalThis.window=oldWindow}
})

test('guest contribution carries dates and every consent; receipt retains secret in fragment',async()=>{
 const oldFetch=globalThis.fetch,oldFormData=globalThis.FormData;let r,payload,reset=false
 const values={photo:new File([new Uint8Array([255,216,255])],'fixture.jpg',{type:'image/jpeg'}),caption:'Leaf',credit:'Guest',location:'Path',observedOn:'2024-04-12',adult:'on',rights:'on',permission:'on',scanner:'on'}
 globalThis.FormData=class{get(k){return values[k]}}
 globalThis.fetch=async(url,options)=>{payload=JSON.parse(options.body);return Response.json({id:'photo-id',withdrawalToken:'private-token'})}
 try{
  await act(()=>{r=create(React.createElement(VenuePhotoContribute,{hubId:'venue'}))})
  await act(()=>r.root.findByType('form').props.onSubmit({preventDefault(){},currentTarget:{reset(){reset=true}}}))
  assert.equal(reset,true);assert.equal(payload.observedOn,'2024-04-12')
  for(const k of ['adult','rightsConfirmed','venueUseConsent','scannerConsent'])assert.equal(payload[k],true)
  assert.equal(r.root.findByType('a').props.href,'/wild/photos/withdraw?id=photo-id#private-token')
  assert.match(text(r),/private with the venue/)
 }finally{if(r)await act(()=>r.unmount());globalThis.fetch=oldFetch;globalThis.FormData=oldFormData}
})

test('withdrawal receipt never withdraws on GET or mount; explicit confirmation sends the token',async()=>{
 const oldFetch=globalThis.fetch,oldWindow=globalThis.window;let r,calls=0,payload
 globalThis.window={location:{search:'?id=photo-id',hash:'#secret'},confirm:()=>true}
 globalThis.fetch=async(url,options)=>{calls++;payload=JSON.parse(options.body);assert.equal(options.method,'DELETE');return Response.json({ok:true})}
 try{
  await act(()=>{r=create(React.createElement(VenuePhotoWithdraw))})
  assert.equal(calls,0)
  await act(()=>button(r,'Withdraw my photograph').props.onClick())
  assert.equal(calls,1);assert.deepEqual(payload,{token:'secret'})
  assert.match(text(r),/Photograph withdrawn/)
 }finally{if(r)await act(()=>r.unmount());globalThis.fetch=oldFetch;globalThis.window=oldWindow}
})

test('photo desk filters seasons and publication, retains comparisons across years, and limits selection',async()=>{
 const oldFetch=globalThis.fetch;let r
 const photos=[
  {id:'a',caption:'Winter branches',credit:'Guest',location:'Pond',observedOn:'2025-12-10',createdAt:'2026-09-20',status:'PUBLISHED',revision:1,reason:''},
  {id:'b',caption:'Spring leaves',credit:'Staff',location:'Pond',observedOn:'2026-04-10',createdAt:'2026-09-20',status:'RECEIVED',revision:1,reason:''},
  {id:'c',caption:'Undated detail',credit:'Guest',location:'Wall',observedOn:null,createdAt:'2026-09-20',status:'RECEIVED',revision:1,reason:''},
 ]
 globalThis.fetch=async()=>Response.json({photos,settings:{weeklyEnabled:false,contributionsEnabled:false}})
 const selection=(caption)=>r.root.findByProps({'aria-label':`Select photograph: ${caption}`})
 try{
  await act(()=>{r=create(React.createElement(VenuePhotoJournal,{hubId:'venue'}))})
  await act(()=>r.root.findByProps({id:'photo-season'}).props.onChange({target:{value:'Winter'}}))
  assert.match(text(r),/Winter branches/);assert.doesNotMatch(text(r),/Spring leaves|Undated detail/)
  await act(()=>selection('Winter branches').props.onClick())
  await act(()=>r.root.findByProps({id:'photo-season'}).props.onChange({target:{value:'Spring'}}))
  await act(()=>selection('Spring leaves').props.onClick())
  const inspector=r.root.findByProps({'aria-label':'Selected photographs'})
  assert.equal(inspector.findAllByType('img').length,2)
  assert.match(text(r),/Across time/)
  await act(()=>r.root.findByProps({id:'photo-season'}).props.onChange({target:{value:'all'}}))
  assert.equal(selection('Undated detail').props.disabled,true)
  await act(()=>button(r,'Clear selection').props.onClick())
  await act(()=>r.root.findByProps({id:'photo-status'}).props.onChange({target:{value:'PUBLISHED'}}))
  assert.doesNotMatch(text(r),/Spring leaves|Undated detail/)
  await act(()=>r.root.findByProps({id:'photo-search'}).props.onChange({target:{value:'missing'}}))
  assert.match(text(r),/No photographs match/)
  await act(()=>button(r,'Clear filters').props.onClick())
  await act(()=>r.root.findByProps({id:'photo-year'}).props.onChange({target:{value:'unknown'}}))
  assert.match(text(r),/Undated detail/);assert.doesNotMatch(text(r),/Winter branches|Spring leaves/)
  await act(()=>r.update(React.createElement(VenuePhotoJournal,{hubId:'other-venue'})))
  assert.equal(r.root.findAllByProps({'aria-label':'Selected photographs'}).length,0)
 }finally{if(r)await act(()=>r.unmount());globalThis.fetch=oldFetch}
})
