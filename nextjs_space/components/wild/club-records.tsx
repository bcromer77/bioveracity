import type { SourceRecord, SourceId } from '@/lib/club-watch/sources'
import { EvidenceLink } from '@/components/evidence-link'
export type ClubRecordView={id:string;source:SourceId;content:SourceRecord;review:string;firstSeenAt:Date|string;lastSeenAt:Date|string}
export type ClubRunView={source:SourceId;status:string;count:number;note:string;checkedAt:Date|string}
export function ClubRecords({scope,records,runs}:{scope:string;records:ClubRecordView[];runs:ClubRunView[]}){
  const date=(v:Date|string)=>new Date(v).toLocaleDateString('en-GB',{timeZone:'UTC'})
  return <section className="space-y-4" aria-label="Council and EPA records">
    <h2 className="text-2xl font-semibold">Council and EPA records</h2><p>Area: {scope}. These records describe their stated places and dates. They do not measure the club’s environmental performance.</p>
    <div className="grid gap-3 sm:grid-cols-2">{(['planning','epa'] as const).map(source=>{const run=runs.find(r=>r.source===source),stale=!run||Date.now()-new Date(run.checkedAt).getTime()>48*3600000;return <div key={source} className="rounded border p-3"><h3 className="font-semibold">{source==='epa'?'EPA waterbody assessments':'Dublin City Council planning'}</h3><p>{!run?'Not checked yet':run.status==='OK'&&!stale?'Last retrieval completed':stale?'Source check overdue':'Latest retrieval incomplete'}</p>{run&&<><p>Checked {date(run.checkedAt)} · {run.count} records retrieved</p><p className="text-sm">{run.note}</p></>}</div>})}</div>
    {!records.length&&<p>No reviewed records are available here yet. This does not mean there are no applications or environmental changes.</p>}
    {records.map(r=><article key={r.id} className="rounded border p-4 space-y-2"><h3 className="text-lg font-semibold">{r.content.title}</h3><p>{r.content.summary}</p><p className="text-sm">{r.content.publisher} · {r.review.toLowerCase()}</p><p className="text-sm">{r.content.eventDate?`Source event date: ${r.content.eventDate}`:'Event date not supplied'}{r.content.period?` · Assessment period: ${r.content.period}`:''}. First retrieved {date(r.firstSeenAt)}; last seen {date(r.lastSeenAt)}.</p><p className="text-sm">{r.content.caveat}</p><EvidenceLink className="underline break-words" href={r.content.sourceUrl}>View supporting source attribution</EvidenceLink></article>)}
    {records.length===200&&<p>Showing at most 200 records. Contact us for the complete reviewed chronology.</p>}
  </section>
}
