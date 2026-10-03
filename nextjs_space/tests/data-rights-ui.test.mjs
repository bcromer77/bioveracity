import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import React from 'react'
import { act, create } from 'react-test-renderer'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const directory = await mkdtemp(path.join(process.cwd(), '.rights-ui-'))
after(() => rm(directory, { recursive: true, force: true }))
const outfile = path.join(directory, 'components.mjs')
await build({
  stdin: {
    contents: "export { DataRights } from './components/account/data-rights'; export { SignupForm } from './app/signup/signup-form';",
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
        b.onResolve({filter:/^next-auth\/react$/},()=>({path:'auth',namespace:'stub'}))
        b.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'stub'}))
        b.onLoad({filter:/.*/,namespace:'stub'},({path})=>({loader:'js',contents:path==='auth'?'export const signIn=async()=>({});':'export const useRouter=()=>({replace(){},refresh(){}}); export const useSearchParams=()=>new URLSearchParams();'}))
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

const {DataRights,SignupForm}=await import(pathToFileURL(outfile).href)
const text=r=>JSON.stringify(r.toJSON())
test('signup starts unticked and submits explicit versioned acceptance without optional marketing',async()=>{
 const old=globalThis.fetch;let r,payload
 globalThis.fetch=async(_url,options)=>{payload=JSON.parse(options.body);return Response.json({id:'new'})}
 try{
 await act(()=>{r=create(React.createElement(SignupForm,{googleEnabled:true,termsEnabled:true}))})
 assert.equal(r.root.findByProps({type:'submit'}).props.disabled,true)
 assert.doesNotMatch(text(r),/Sign up with Google/)
 const checkbox=r.root.findByProps({type:'checkbox'});assert.equal(checkbox.props.checked,false)
 await act(()=>checkbox.props.onChange({target:{checked:true}}))
 await act(()=>r.root.findByType('form').props.onSubmit({preventDefault(){}}))
 assert.equal(payload.acceptTerms,true);assert.equal(payload.termsVersion,'2026-09-22.1');assert.equal(payload.privacyVersion,'2026-09-22.1')
 assert.equal('marketingConsent' in payload,false)
 }finally{if(r)await act(()=>r.unmount());globalThis.fetch=old}
})
test('data panel shows limited download and allows rights requests without accepting updated terms',async()=>{
 const old=globalThis.fetch;let r;const writes=[]
 globalThis.fetch=async(_url,options={})=>{if(options.method==='POST')writes.push(JSON.parse(options.body));return Response.json({acceptances:[],requests:[],venues:[],galleryReleases:[]})}
 try{
 await act(async()=>{r=create(React.createElement(DataRights))})
 assert.equal(writes.length,0)
 assert.match(text(r),/Download account data/)
 assert.match(text(r),/not you accept updated terms/)
 await act(()=>r.root.findByType('form').props.onSubmit({preventDefault(){}}))
 assert.equal(writes[0].kind,'ACCESS');assert.equal(writes[0].details,'')
 await act(()=>r.root.findByType('select').props.onChange({target:{value:'ERASURE'}}))
 const submit=r.root.findAllByType('button').find(b=>b.children.join('')==='Submit request')
 assert.equal(submit.props.disabled,true)
 assert.equal(r.root.findByProps({pattern:'DELETE MY DATA'}).props.value,'')
 }finally{if(r)await act(()=>r.unmount());globalThis.fetch=old}
})
