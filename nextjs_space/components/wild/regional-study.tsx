'use client'
import { useRef, useState } from 'react'
import { CLAIMS } from '@/lib/cambridgeshire/catalogue'
import { summariseStudy, validateStudy, type StudyResult } from '@/lib/cambridgeshire/measurement'

/** Explicit, local-only pilot measurement. No cookies, tracking requests,
 * identities, query text or private evidence. Export requires a user click. */
export function RegionalStudy() {
  const [results, setResults] = useState<StudyResult[]>([])
  const [error, setError] = useState('')
  const [started, setStarted] = useState(false)
  const start = useRef(0)
  const summary = summariseStudy(results)
  function download() {
    const blob = new Blob([JSON.stringify({ version: 1, scope: 'Local pilot tasks; not unique-user analytics', results, summary }, null, 2)], { type: 'application/json' })
    const href = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = href; a.download = 'cambridgeshire-study.json'; a.click(); URL.revokeObjectURL(href)
  }
  return <details className="mt-8 rounded border p-5">
    <summary className="cursor-pointer font-semibold">Help test discovery and evidence-checking time</summary>
    <p className="my-3">Optional pilot study. Results stay in this tab until you download them and disappear on refresh. Nothing is sent automatically. Record each task once; these counts are tasks, not unique people.</p>
    <h3 className="font-semibold">Guest discovery</h3>
    <p>Start the timer, use the search to find a place, then record whether it was useful and new to you.</p>
    <button type="button" className="bv-button bv-green my-3" onClick={() => { start.current = performance.now(); setStarted(true) }}>Start discovery task</button>
    <form className="grid gap-3" onSubmit={event => {
      event.preventDefault(); const data = new FormData(event.currentTarget)
      try {
        if (!started) throw new Error('Start the discovery task first.')
        const item = validateStudy({ task: 'guest-discovery', placeId: data.get('place'), useful: data.get('useful') === 'yes', previouslyKnown: data.get('known') === 'yes', elapsedSeconds: Math.max(1, Math.round((performance.now() - start.current) / 1000)) })
        setResults(prev => [...prev, item]); setStarted(false); setError('')
      } catch (e) { setError(e instanceof Error ? e.message : 'Check your answers.') }
    }}>
      <label>Place found <select className="block border p-2" name="place" required><option value="">Choose a place</option>{CLAIMS.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      <label>Was this useful? <select name="useful" required className="border p-2"><option value="">Choose</option><option value="yes">Yes</option><option value="no">No</option></select></label>
      <label>Did you already know this place? <select name="known" required className="border p-2"><option value="">Choose</option><option value="yes">Yes</option><option value="no">No</option></select></label>
      <button className="bv-button bv-green" disabled={!started}>Record guest task</button>
    </form>
    <h3 className="mt-6 font-semibold">Professional evidence checking</h3>
    <p>Use matched tasks with the same evidence scope and difficulty. Include source checking and corrections in both times. Alternate which method goes first. A reviewer should assess correctness against an agreed answer set.</p>
    <form className="mt-3 grid gap-3" onSubmit={event => {
      event.preventDefault(); const form = event.currentTarget; const data = new FormData(form)
      try {
        const item = validateStudy({ task: 'evidence-check', manualSeconds: Number(data.get('manual')), assistedSeconds: Number(data.get('assisted')), manualCorrect: Number(data.get('manualCorrect')), assistedCorrect: Number(data.get('assistedCorrect')), checks: Number(data.get('checks')), order: data.get('order') })
        setResults(prev => [...prev, item]); setError(''); form.reset()
      } catch (e) { setError(e instanceof Error ? e.message : 'Check your answers.') }
    }}>
      {([['manual', 'Manual time, seconds', 1], ['assisted', 'BioVeracity time, seconds', 1], ['checks', 'Number of checks assessed', 1], ['manualCorrect', 'Manual checks correct', 0], ['assistedCorrect', 'BioVeracity checks correct', 0]] as const).map(([name, title, min]) => <label key={name}>{title}<input name={name} type="number" min={min} max={name.includes('Correct') || name === 'checks' ? 100 : 86400} step="1" required className="block border p-2" /></label>)}
      <label>Order <select name="order" className="border p-2"><option value="manual-first">Manual first</option><option value="assisted-first">BioVeracity first</option></select></label>
      <button className="bv-button bv-green">Record comparison</button>
    </form>
    {error && <p role="alert" className="mt-3">{error}</p>}
    <div aria-live="polite" className="mt-4">
      <p>{summary.guestTasks} guest tasks; {summary.newUsefulDiscoveries} useful discoveries of previously unknown places.</p>
      <p>{summary.professionalPairs} professional comparisons. Median time saving: {summary.medianTimeSavingPercent === null ? 'not measured' : `${summary.medianTimeSavingPercent.toFixed(1)}%`}. Accuracy maintained: {summary.accuracyMaintained === null ? 'not measured' : summary.accuracyMaintained ? 'yes, in these entered results' : 'no'}.</p>
      <p>Initial test target: three comparisons, at least 30% median time saving and no reduction in assessed accuracy. Small samples do not establish market-wide results.</p>
    </div>
    <button type="button" className="bv-button bv-green mt-3" onClick={download} disabled={!results.length}>Download study results</button>
    <button type="button" className="ml-4 underline" onClick={() => { setResults([]); setStarted(false); setError('') }}>Clear results</button>
  </details>
}
