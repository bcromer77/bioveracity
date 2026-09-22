'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { authReturnPath } from '@/lib/auth-return-path'
export default function VerifyEmail() {
 const [callbackUrl,setCallbackUrl]=useState('/start')
 const [token,setToken]=useState(''), [email,setEmail]=useState(''), [message,setMessage]=useState('Check your inbox for your verification email. You can request a new one below.'),[busy,setBusy]=useState(false)
 useEffect(()=>{const fragment=new URLSearchParams(window.location.hash.slice(1)); const target=authReturnPath(fragment.get('returnTo') || new URLSearchParams(window.location.search).get('callbackUrl')); setCallbackUrl(target); setToken(fragment.get('token')||''); window.history.replaceState(null,'',`/verify-email?callbackUrl=${encodeURIComponent(target)}`)},[])
 async function submit(action:string){
  setBusy(true)
  try {const res=await fetch('/api/account/identity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,email,token,callbackUrl})});const data=await res.json();setMessage(res.ok?(action==='verify'?'Email confirmed. You can now sign in.':data.message):data.error);if(res.ok&&action==='verify')setToken('')}
  catch {setMessage('Unable to connect. Please try again.')}finally{setBusy(false)}
 }
 return <main className="mx-auto max-w-md px-5 py-16 space-y-5"><h1 className="text-2xl font-bold">Confirm your email</h1><p role="status">{message}</p>{token&&<button className="rounded bg-accent p-3" disabled={busy} onClick={()=>submit('verify')}>Confirm this email address</button>}<form className="space-y-3" onSubmit={e=>{e.preventDefault();void submit('resend')}}><label className="block">Email address<input className="block w-full border rounded p-3" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><button disabled={busy} className="underline">Send a new verification email</button></form><Link className="block underline" href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}>Sign in</Link></main>
}
