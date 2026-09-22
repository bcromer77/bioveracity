'use client'
import { useEffect, useState } from 'react'
import { workspaceRequest } from './workspace-client.mjs'
type Access={members:{userId:string;email:string;name:string|null;role:string;canExport:boolean}[];invitations:{id:string;email:string;role:string;expiresAt:string}[]}
export function CaseCollaboration({workspaceId,caseId}:{workspaceId:string;caseId:string}) {
 const endpoint=`/api/workspaces/${encodeURIComponent(workspaceId)}/cases/${encodeURIComponent(caseId)}/members`
 const inviteEndpoint=`/api/workspaces/${encodeURIComponent(workspaceId)}/invitations`
 const [data,setData]=useState<Access|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[email,setEmail]=useState(''),[role,setRole]=useState('VIEWER'),[canExport,setCanExport]=useState(false),[link,setLink]=useState(''),[removing,setRemoving]=useState(''),[confirm,setConfirm]=useState('')
 async function load(){setData(await workspaceRequest(endpoint))}
 useEffect(()=>{let active=true;workspaceRequest(endpoint).then(d=>{if(active)setData(d)}).catch(()=>{if(active)setError('Case owners manage invitations and access here. If you own this case, refresh to try again.')});return()=>{active=false}},[endpoint])
 async function act(url:string,method:string,payload?:unknown){setBusy(true);setError('');try{const result=await workspaceRequest(url,{method,body:payload?JSON.stringify(payload):undefined});await load();return result}catch(e){setError(e instanceof Error?e.message:'Request failed. Refresh before retrying.')}finally{setBusy(false)}}
 return <details className="rounded-lg border p-5"><summary className="cursor-pointer font-semibold">People and access for this case</summary><p className="my-3 text-sm">Invitations grant access only to this case. Removing online access cannot recall files already downloaded.</p>{error&&<p role="alert">{error}</p>}{!data&&!error&&<p role="status">Loading access…</p>}{data&&<>
 <form className="grid gap-3" onSubmit={async e=>{e.preventDefault();setLink('');const r=await act(inviteEndpoint,'POST',{caseId,email,role,canExport});if(r?.invitation?.url){setLink(window.location.origin+r.invitation.url);setEmail('')}}}>
 <label>Colleague's email<input className="block w-full rounded border p-3" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
 <label>Access<select className="block w-full rounded border p-3" value={role} onChange={e=>setRole(e.target.value)}><option value="VIEWER">View evidence</option><option value="REVIEWER">View and review evidence</option><option value="CONTRIBUTOR">View and add evidence</option></select></label>
 <label><input type="checkbox" checked={canExport} onChange={e=>setCanExport(e.target.checked)}/> Allow report export</label><button disabled={busy} className="rounded border p-3">Create private invitation</button></form>
 {link&&<div role="status" className="my-3"><label>Private invitation link<input className="block w-full border p-3" readOnly value={link}/></label><p>Share securely with the named colleague. No email has been sent. The link expires in seven days.</p></div>}
 <h3 className="mt-4 font-semibold">Current members</h3>{data.members.map(m=><div key={m.userId} className="border-t py-3"><p>{m.name||m.email} · {m.role} · {m.canExport?'Export allowed':'No export permission'}</p>{m.role!=='OWNER'&&<button disabled={busy} className="underline" onClick={()=>{setRemoving(m.userId);setConfirm('')}}>Remove access for {m.email}</button>}</div>)}
 {removing&&<form className="my-3 border p-3" onSubmit={async e=>{e.preventDefault();const r=await act(endpoint,'DELETE',{userId:removing,confirm});if(r){setRemoving('');setConfirm('')}}}><label>Type REMOVE CASE ACCESS<input className="block w-full border p-3" required pattern="REMOVE CASE ACCESS" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label><button disabled={busy||confirm!=='REMOVE CASE ACCESS'}>Confirm removal</button><button type="button" onClick={()=>setRemoving('')}>Cancel</button></form>}
 <h3 className="mt-4 font-semibold">Pending invitations</h3>{!data.invitations.length&&<p>No pending invitations.</p>}{data.invitations.map(i=><p key={i.id}>{i.email} · {i.role} <button disabled={busy} className="underline" onClick={()=>act(`${inviteEndpoint}/${encodeURIComponent(i.id)}`,'DELETE')}>Cancel invitation</button></p>)}
 </>}</details>
}
