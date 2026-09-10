import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import React from 'react'
import { act, create } from 'react-test-renderer'

globalThis.IS_REACT_ACT_ENVIRONMENT=true
const directory=await mkdtemp(path.join(process.cwd(),'.intelligence-ui-'))
after(()=>rm(directory,{recursive:true,force:true}))
await build({entryPoints:['components/workspace/document-intelligence.tsx'],outfile:path.join(directory,'ui.mjs'),bundle:true,format:'esm',platform:'node',packages:'external',plugins:[{name:'button',setup(b){b.onResolve({filter:/^@\/components\/ui\/button$/},()=>({path:'button',namespace:'stub'}));b.onResolve({filter:/^react(?:\/|$)/},({path})=>({path,external:true}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'import React from "react"; export const Button=p=>React.createElement("button",p,p.children);',loader:'js'}))}}]})
const {DocumentIntelligence}=await import(pathToFileURL(path.join(directory,'ui.mjs')).href)
const props={endpoint:'/api/workspaces/w/cases/c/evidence',documents:[{id:'a',name:'Synthetic report'},{id:'b',name:'Second report'}],revision:0}
const answer={status:'COMPLETED_TEXT_CHECKS',scope:{documents:[],passagesChecked:1},coverage:[],comparisons:[],comparisonsTruncated:false,limitations:[],snapshot:'test'}
async function setup(t,post){
  let renderer
  const original=globalThis.fetch
  globalThis.fetch=async(url,init)=>init.method==='POST'?post(JSON.parse(init.body),init.signal):Response.json({checks:[{id:'bats',question:'Does it mention bats?'}]})
  t.after(async()=>{if(renderer)await act(()=>renderer.unmount());globalThis.fetch=original})
  await act(async()=>{renderer=create(React.createElement(DocumentIntelligence,props))})
  await act(()=>renderer.root.findByType('select').props.onChange({target:{value:'a'}}))
  await act(()=>renderer.root.findByType('input').props.onChange({target:{checked:true}}))
  return renderer
}
test('UI sends selected report/checks and shows bounded results',async t=>{
  const renderer=await setup(t,input=>{assert.deepEqual(input,{action:'analyse',documentId:'a',checkIds:['bats']});return Response.json(answer)})
  await act(()=>renderer.root.findByType('button').props.onClick())
  assert.match(JSON.stringify(renderer.toJSON()),/Selected text checks completed/)
  assert.match(JSON.stringify(renderer.toJSON()),/does not establish that the report is consistent or complete/)
})
test('failed analysis remains an error, never a clean report',async t=>{
  const renderer=await setup(t,()=>Response.json({error:'Analysis unavailable'},{status:503}))
  await act(()=>renderer.root.findByType('button').props.onClick())
  assert.match(JSON.stringify(renderer.toJSON()),/Analysis unavailable/)
  assert.doesNotMatch(JSON.stringify(renderer.toJSON()),/Selected text checks completed/)
})
test('switching report discards a late response even when transport ignores abort',async t=>{
  let finish
  const renderer=await setup(t,()=>new Promise(resolve=>{finish=()=>resolve(Response.json(answer))}))
  let pending
  await act(async()=>{pending=renderer.root.findByType('button').props.onClick()})
  await act(()=>renderer.root.findByType('select').props.onChange({target:{value:'b'}}))
  await act(async()=>{finish();await pending})
  assert.doesNotMatch(JSON.stringify(renderer.toJSON()),/Selected text checks completed/)
})
