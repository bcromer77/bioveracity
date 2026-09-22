'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ClubRecords, type ClubRecordView, type ClubRunView } from './club-records'
import type { WatchConfig } from '@/lib/club-watch/sources'
type WatchView={watch:{enabled:boolean;config:WatchConfig};records:ClubRecordView[];runs:ClubRunView[]}
type Billing={state:string;paymentState:string;paidUntil:string|null;checkedAt:string|null;canCancel:boolean;canCheckout:boolean;needsReconciliation:boolean}
type View={watch:WatchView|null;billing:Billing|null;payment:{available:boolean;mode?:string;taxLabel?:string}}
export function ClubPanel({hubId,name,admin=false}:{hubId:string;name:string;admin?:boolean}){
  const [view,setView]=useState<View|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[agree,setAgree]=useState(false),[cancel,setCancel]=useState('')
  const endpoint=admin?`/api/admin/wild/clubs/${encodeURIComponent(hubId)}`:`/api/wild/hubs/${encodeURIComponent(hubId)}/club`
  const load=useCallback(async()=>{const r=await fetch(endpoint,{cache:'no-store'}),j=await r.json();if(!r.ok)throw Error(j.error);setView(admin?{watch:j,billing:null,payment:{available:false}}:j)},[endpoint,admin])
  useEffect(()=>{load().catch(e=>setError(e.message))},[load])
  async function action(input:Record<string,unknown>,success:string){
    setBusy(true);setError('');setMessage('')
    try{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}),j=await r.json();if(!r.ok)throw Error(j.error)
      if(j.url){window.location.assign(j.url);return}await load();setMessage(success)
    }catch(e){setError(e instanceof Error?e.message:'Please try again.')}finally{setBusy(false)}
  }
  // The return URL is not payment evidence. Poll the owned subscription only.
  useEffect(()=>{
    if(admin||new URLSearchParams(window.location.search).get('billing')!=='return')return
    let stopped=false,attempts=0
    const refresh=async()=>{if(stopped||attempts++>=6)return;try{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'refresh'})});if(!r.ok)throw Error('Payment status is not confirmed yet. Use Refresh billing status.');await load()}catch(e){if(!stopped)setError(e instanceof Error?e.message:'Unable to check billing.')}}
    void refresh();const timer=setInterval(()=>{void refresh()},5000)
    return()=>{stopped=true;clearInterval(timer)}
  },[endpoint,load,admin])
  const billing=view?.billing,watch=view?.watch
  return <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
    <Link className="underline" href={`/wild/studio?hub=${encodeURIComponent(hubId)}`}>← Venue studio · QR code and photographs</Link><h1 className="text-3xl font-semibold">{name}</h1>
    {error&&<p role="alert" className="rounded border border-red-700 p-3 text-red-800">{error}</p>}{message&&<p role="status">{message}</p>}
    {!view&&!error&&<p>Loading your club…</p>}
    {admin&&<form className="space-y-3 rounded border p-4" key={watch?JSON.stringify(watch.watch.config):'new'} onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);void action({action:'configure',enabled:data.get('enabled')==='on',config:{scopeLabel:data.get('scopeLabel'),west:Number(data.get('west')),south:Number(data.get('south')),east:Number(data.get('east')),north:Number(data.get('north')),waterbodyCode:data.get('waterbodyCode'),scopeConfirmed:data.get('scopeConfirmed')==='on'}},'Club source area saved. Changes require a new source check and review.')}}>
      <h2 className="text-xl font-semibold">Confirm the club’s source area</h2><p>Use the map area agreed with the club and the exact EPA waterbody identifier. This association is context; it does not assert an impact on the club.</p>
      <label className="block">Area description<input name="scopeLabel" required maxLength={160} defaultValue={watch?.watch.config.scopeLabel} className="block w-full border p-2"/></label>
      <div className="grid grid-cols-2 gap-3">{(['west','south','east','north'] as const).map(k=><label key={k} className="block">{k} (WGS84)<input name={k} type="number" step="any" required defaultValue={watch?.watch.config[k]} className="block w-full border p-2"/></label>)}</div>
      <label className="block">EPA waterbody code<input name="waterbodyCode" required defaultValue={watch?.watch.config.waterbodyCode} className="block w-full border p-2"/></label>
      <label className="flex gap-2"><input name="scopeConfirmed" type="checkbox" required/>I have checked the boundaries, waterbody and public source coverage with the club.</label>
      <label className="flex gap-2"><input name="enabled" type="checkbox" defaultChecked={watch?.watch.enabled}/>Enable this club’s source watch and subscription offer</label>
      <button disabled={busy} className="rounded border px-4 py-2">Save configuration</button>
    </form>}
    {!admin&&view&&<section className="space-y-3 rounded border p-4"><h2 className="text-2xl font-semibold">Club membership · €80 each month</h2>
      <p>Your venue page and QR code, guest photo journal, council/EPA source watch and opt-in weekly email. Telemetry is not included.</p>
      {view.payment.mode==='sandbox'&&<p className="font-semibold">Test payments only — this is the Revolut sandbox.</p>}
      {view.payment.taxLabel&&<p>{view.payment.taxLabel}</p>}
      {billing&&<><p>Subscription: {billing.state.toLowerCase()}. Payment: {billing.paymentState}. {billing.checkedAt?`Last checked ${new Date(billing.checkedAt).toLocaleString('en-GB')}.`:'Not yet confirmed with Revolut.'}</p>
        {billing.paidUntil&&<p>Paid source-watch service through {new Date(billing.paidUntil).toLocaleDateString('en-GB')}.</p>}
        {billing.needsReconciliation&&<p>Checkout needs an operator to reconcile the provider record. Please contact support; starting again could create a duplicate.</p>}
        <button className="rounded border px-4 py-2" disabled={busy||!view.payment.available||billing.needsReconciliation} onClick={()=>action({action:'refresh'},'Billing status checked with Revolut.')}>Refresh billing status</button>
      </>}
      {view.payment.available&&watch?.watch.enabled&&(!billing||billing.canCheckout)&&<><label className="flex items-start gap-3"><input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)}/><span>I authorise a recurring €80 EUR monthly club subscription, charged through Revolut until I cancel. I have read the <Link href="/terms" className="underline">venue terms</Link>.</span></label><button disabled={busy||!agree} className="rounded border bg-green-900 px-4 py-3 text-white" onClick={()=>action({action:'checkout',confirmed:agree},'')}>{busy?'Opening…':billing?'Continue secure checkout':'Subscribe through Revolut'}</button></>}
      {!view.payment.available&&<p>Payment setup is not available on this deployment yet.</p>}
      {!watch?.watch.enabled&&<p>The team must confirm your club’s source area before you subscribe.</p>}
      {billing?.canCancel&&<form className="space-y-3 border-t pt-4" onSubmit={e=>{e.preventDefault();void action({action:'cancel',confirmed:cancel},'Cancellation checked with Revolut. Review the subscription status above.')}}><h3 className="font-semibold">Cancel recurring billing</h3><p>Cancellation stops future billing cycles and pending orders. Paid source-watch service continues through the paid period shown above. Your published records, account, downloads and data requests remain available. This does not delete data or request a refund.</p><label className="block">Type CANCEL SUBSCRIPTION<input className="mt-1 block w-full border p-2" value={cancel} onChange={e=>setCancel(e.target.value)} autoComplete="off" required pattern="CANCEL SUBSCRIPTION"/></label><button className="rounded border px-4 py-2" disabled={busy||cancel!=='CANCEL SUBSCRIPTION'||!view.payment.available}>Cancel recurring billing</button></form>}
      <p><Link href={`/wild/studio/${encodeURIComponent(hubId)}/photos#preferences`} className="underline">Weekly email preferences and photo downloads</Link> · <Link className="underline" href="/account">Account and data rights</Link> · <Link href="/contact" className="underline">Contact support</Link></p>
    </section>}
    {watch&&<ClubRecords scope={watch.watch.config.scopeLabel} records={watch.records} runs={watch.runs}/>}
    {admin&&watch?.records.filter(r=>r.review==='PENDING').map(r=><form key={r.id} className="space-y-2 rounded border p-4" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void action({action:'review',recordId:r.id,decision:f.get('decision'),note:f.get('note')},'Review recorded.')}}><h3 className="font-semibold">Review: {r.content.title}</h3><p>Read the supporting source above and check its date, scope and wording before publication. Corrections require a fresh review.</p><label className="block">Decision<select name="decision" required className="block border p-2"><option value="">Choose</option><option value="APPROVED">Approve for public page and weekly email</option><option value="REJECTED">Reject</option></select></label><label className="block">Review note<textarea name="note" required maxLength={1000} className="block w-full border p-2"/></label><button disabled={busy} className="rounded border px-4 py-2">Record decision</button></form>)}
  </main>
}
