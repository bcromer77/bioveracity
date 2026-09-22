import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {build} from 'esbuild'
import React from 'react'
import {act,create} from 'react-test-renderer'
globalThis.IS_REACT_ACT_ENVIRONMENT=true
const dir=await mkdtemp(path.join(process.cwd(),'.club-ui-')),originalFetch=globalThis.fetch
after(async()=>{await rm(dir,{recursive:true,force:true});globalThis.fetch=originalFetch;delete globalThis.window;delete globalThis.__signout})
await build({stdin:{contents:"export {ClubPanel} from './components/wild/club-panel'; export {SignOutButton} from './components/ellona/sign-out-button'",resolveDir:process.cwd(),loader:'tsx'},outfile:path.join(dir,'ui.mjs'),bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'framework',setup(b){b.onResolve({filter:/^react(?:\/|$)/},a=>({path:a.path,external:true}));b.onResolve({filter:/^next\/link$|^next-auth\/react$/},a=>({path:a.path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({loader:'js',contents:a.path==='next/link'?"import React from 'react';export default p=>React.createElement('a',p,p.children)":"export const signOut=async options=>globalThis.__signout(options)"}))}}]})
const {ClubPanel,SignOutButton}=await import(pathToFileURL(path.join(dir,'ui.mjs')))
const text=t=>JSON.stringify(t.toJSON())
test('club checkout requires an unticked recurring-payment confirmation and preserves the selected club route',async()=>{
 let submitted,navigated
 globalThis.window={location:{search:'',assign:u=>{navigated=u}}}
 globalThis.fetch=async(url,init={})=>{if(init.method==='POST'){submitted={url,body:JSON.parse(init.body)};return Response.json({url:'https://sandbox-checkout.revolut.com/payment-link/synthetic'})}return Response.json({watch:{watch:{enabled:true,config:{scopeLabel:'Synthetic QA area'}},records:[],runs:[]},billing:null,payment:{available:true,mode:'sandbox',taxLabel:'Synthetic tax wording'}})}
 let t;try{await act(async()=>{t=create(React.createElement(ClubPanel,{hubId:'synthetic-club',name:'Fictional club'}))})
 assert.match(text(t),/€80 each month/);assert.match(text(t),/Test payments only/)
 const button=t.root.findAllByType('button').find(b=>b.children.includes('Subscribe through Revolut'))
 assert.equal(button.props.disabled,true);await act(async()=>t.root.findByProps({type:'checkbox'}).props.onChange({target:{checked:true}}))
 await act(async()=>button.props.onClick());assert.equal(submitted.url,'/api/wild/hubs/synthetic-club/club');assert.deepEqual(submitted.body,{action:'checkout',confirmed:true});assert.ok(navigated.startsWith('https://sandbox-checkout.revolut.com/'))
 }finally{if(t)await act(()=>t.unmount())}
})
test('sign out ignores a stale provider redirect and reports network failure instead of pretending to sign out',async()=>{
 let destination,options;globalThis.window={location:{assign:u=>{destination=u}}};globalThis.__signout=async o=>{options=o;return {url:'https://retired-preview.example.test'}}
 let t;try{await act(()=>{t=create(React.createElement(SignOutButton))});await act(async()=>t.root.findByType('button').props.onClick({preventDefault(){}}));assert.deepEqual(options,{redirect:false});assert.equal(destination,'/')
 destination=undefined;globalThis.__signout=async()=>{throw Error('network')};await act(async()=>t.root.findByType('button').props.onClick({preventDefault(){}}));assert.equal(destination,undefined);assert.match(text(t),/could not be confirmed/)
 }finally{if(t)await act(()=>t.unmount())}
})
