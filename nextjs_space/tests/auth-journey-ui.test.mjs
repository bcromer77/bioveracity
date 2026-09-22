import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {build} from 'esbuild'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import React from 'react'
import {act,create} from 'react-test-renderer'
globalThis.IS_REACT_ACT_ENVIRONMENT=true
const dir=await mkdtemp(path.join(process.cwd(),'.auth-journey-'));after(()=>rm(dir,{recursive:true,force:true}))
await build({stdin:{contents:"export {SignupForm} from './app/signup/signup-form'; export {LoginForm} from './app/login/login-form'; export {default as VerifyEmail} from './app/verify-email/page'; export {default as ForgotPassword} from './app/forgot-password/page'",resolveDir:process.cwd(),loader:'tsx'},outfile:path.join(dir,'ui.mjs'),bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'framework',setup(b){b.onResolve({filter:/^react(?:\/|$)/},a=>({path:a.path,external:true}));b.onResolve({filter:/^next\/(link|navigation)$|^next-auth\/react$/},a=>({path:a.path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({loader:'js',contents:a.path==='next/link'?`import React from 'react';export default p=>React.createElement('a',p,p.children)`:a.path==='next/navigation'?`export const useRouter=()=>({replace:u=>globalThis.__journey.destination=u});export const useSearchParams=()=>new URLSearchParams(globalThis.__journey.query);`:`export const signIn=async(...a)=>{globalThis.__journey.signin=a;return {ok:true}};`}))}}]})
const {SignupForm,LoginForm,VerifyEmail,ForgotPassword}=await import(pathToFileURL(path.join(dir,'ui.mjs')))
const originalFetch=globalThis.fetch;after(()=>{globalThis.fetch=originalFetch;delete globalThis.__journey;delete globalThis.window})
async function change(tree,id,value){await act(async()=>tree.root.findByProps({id}).props.onChange({target:{value}}))}
test('Google is offered only for enabled login; new signup retains an unticked terms gate',async()=>{
 globalThis.__journey={query:'callbackUrl=%2Fwild%2Fstudio'}
 for(const enabled of [false,true]){
  let t;await act(async()=>{t=create(React.createElement(LoginForm,{googleEnabled:enabled}))})
  const buttons=t.root.findAllByType('button').filter(b=>b.children.filter(c=>typeof c==='string').join('').includes('Sign in with Google'))
  assert.equal(buttons.length,enabled?1:0)
  if(enabled){await act(async()=>buttons[0].props.onClick());assert.deepEqual(globalThis.__journey.signin,['google',{redirectTo:'/wild/studio'}])}
  await act(async()=>t.unmount())
 }
 let t;await act(async()=>{t=create(React.createElement(SignupForm))})
 assert.ok(!JSON.stringify(t.toJSON()).includes('Google'))
 assert.equal(t.root.findByProps({type:'checkbox'}).props.checked,false)
 await act(async()=>t.unmount())
})
test('venue signup keeps its destination through verification and accessible credential fields',async()=>{
 globalThis.__journey={query:'callbackUrl=%2Fwild%2Fstudio'};let body
 globalThis.fetch=async(_,init)=>{body=JSON.parse(init.body);return {ok:true,json:async()=>({verificationRequired:true})}}
 let t;await act(async()=>{t=create(React.createElement(SignupForm))})
 await change(t,'auth-text','Synthetic owner');await change(t,'auth-email','owner@example.test');await change(t,'auth-password','Synthetic1234')
 await act(async()=>t.root.findByProps({type:'checkbox'}).props.onChange({target:{checked:true}}))
 await act(async()=>t.root.findByType('form').props.onSubmit({preventDefault(){}}))
 assert.equal(body.callbackUrl,'/wild/studio');assert.equal(globalThis.__journey.destination,'/verify-email?callbackUrl=%2Fwild%2Fstudio')
 assert.equal(t.root.findByProps({id:'auth-password'}).props.autoComplete,'new-password')
 await act(async()=>t.unmount())
})
test('general signup requires an explicit purpose; a venue choice is not an administrator role',async()=>{
 globalThis.__journey={query:'callbackUrl=%2Fstart'};let body
 globalThis.fetch=async(_,init)=>{body=JSON.parse(init.body);return {ok:true,json:async()=>({verificationRequired:false})}}
 let t;await act(async()=>{t=create(React.createElement(SignupForm))})
 assert.equal(t.root.findByType('select').props.required,true)
 await act(async()=>t.root.findByType('select').props.onChange({target:{value:'venue'}}))
 await act(async()=>t.root.findByProps({type:'checkbox'}).props.onChange({target:{checked:true}}))
 await act(async()=>t.root.findByType('form').props.onSubmit({preventDefault(){}}))
 assert.equal(globalThis.__journey.destination,'/wild/studio');assert.equal(body.role,undefined)
 await act(async()=>t.unmount())
})
test('verification email preserves safe deep links but strips the token from the address and never auto-confirms',async()=>{
 const target='/workspace/private?case=one&doc=two&cite=three';let calls=0,clean=''
 globalThis.window={location:{hash:'#token=synthetic-token&returnTo='+encodeURIComponent(target),search:''},history:{replaceState:(_,__,url)=>{clean=url}}}
 globalThis.fetch=async()=>{calls++;return {ok:true,json:async()=>({ok:true})}}
 let t;await act(async()=>{t=create(React.createElement(VerifyEmail))})
 assert.equal(calls,0);assert.ok(!clean.includes('synthetic-token'))
 assert.equal(t.root.findByType('a').props.href,'/login?callbackUrl='+encodeURIComponent(target))
 await act(async()=>t.root.findAllByType('button')[0].props.onClick())
 assert.equal(calls,1)
 await act(async()=>t.unmount())
 globalThis.window.location.hash='#token=synthetic&returnTo='+encodeURIComponent('https://evil.example')
 await act(async()=>{t=create(React.createElement(VerifyEmail))})
 assert.equal(t.root.findByType('a').props.href,'/login?callbackUrl=%2Fstart');await act(async()=>t.unmount())
})
test('login preserves citation destination and uses current-password autocomplete',async()=>{
 const target='/workspace/private?case=one&cite=two';globalThis.__journey={query:'callbackUrl='+encodeURIComponent(target)}
 let t;await act(async()=>{t=create(React.createElement(LoginForm,{googleEnabled:false}))})
 await act(async()=>t.root.findByType('form').props.onSubmit({preventDefault(){}}))
 assert.equal(globalThis.__journey.destination,target);assert.equal(t.root.findByProps({id:'auth-password'}).props.autoComplete,'current-password');await act(async()=>t.unmount())
})

test('recovery does not claim delivery after an outage or network failure',async()=>{
 for(const fetcher of [async()=>({ok:false,status:503}),async()=>{throw Error('network')}]){
 globalThis.fetch=fetcher;let t;await act(async()=>{t=create(React.createElement(ForgotPassword))})
 await act(async()=>t.root.findByType('form').props.onSubmit({preventDefault(){}}))
 assert.equal(t.root.findAllByType('form').length,1)
 assert.ok(!JSON.stringify(t.toJSON()).includes('a password reset link has been sent'))
 assert.match(JSON.stringify(t.toJSON()),/temporarily unavailable|Unable to connect/)
 await act(async()=>t.unmount())
 }
})

test('legacy venue signup preselects venue purpose and cannot submit without acceptance even when forms are invoked directly',async()=>{
 globalThis.__journey={query:'type=venue'};let calls=0
 globalThis.fetch=async()=>{calls++;return Response.json({id:'synthetic'})}
 let t;await act(async()=>{t=create(React.createElement(SignupForm))})
 assert.equal(t.root.findByType('select').props.value,'venue')
 assert.equal(t.root.findByProps({type:'checkbox'}).props.checked,false)
 await act(async()=>t.root.findByType('form').props.onSubmit({preventDefault(){}}))
 assert.equal(calls,0);assert.match(JSON.stringify(t.toJSON()),/Please read and accept/)
 await act(async()=>t.unmount())
})
