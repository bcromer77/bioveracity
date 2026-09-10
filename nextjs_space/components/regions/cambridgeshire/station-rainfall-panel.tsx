'use client'
import { useEffect, useRef, useState } from 'react'
import { RAIN_STATIONS, type RainStation, type RainResult } from '@/lib/station-rainfall'

export function StationRainfallPanel({ date, defaultStation = 'fleam-dyke' }: { date: string; defaultStation?: RainStation }) {
  const [station, setStation] = useState<RainStation>(defaultStation)
  const [days, setDays] = useState(7)
  const [result, setResult] = useState<{ key: string; data: RainResult } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const key = `${station}:${date}:${days}`
  useEffect(() => { controller.current?.abort(); setLoading(false); setError(''); return () => controller.current?.abort() }, [key])
  const data = result?.key === key ? result.data : null
  async function load() {
    controller.current?.abort()
    const current = new AbortController()
    controller.current = current
    setLoading(true); setError(''); setResult(null)
    try {
      const response = await fetch(`/api/physical/rainfall?station=${station}&date=${date}&days=${days}`, { signal: current.signal })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Rainfall unavailable')
      if (!current.signal.aborted) setResult({ key, data: body })
    } catch (cause) { if (!current.signal.aborted) setError(cause instanceof Error ? cause.message : 'Rainfall unavailable') }
    finally { if (!current.signal.aborted) setLoading(false) }
  }
  return <details className="mt-4 rounded border border-slate-600 bg-slate-950/60 p-3 text-xs text-slate-200">
    <summary className="cursor-pointer font-semibold text-sky-200">Explore station rainfall</summary>
    <p className="mt-2">Daily records dated before {date}. This is rainfall at a named station, not a measurement at the selected site or an estimate for the whole catchment.</p>
    <div className="mt-3 flex flex-wrap gap-3 print:hidden">
      <label>Station<select className="mt-1 block max-w-full rounded bg-slate-800 p-2" value={station} onChange={e => setStation(e.target.value as RainStation)}>{Object.entries(RAIN_STATIONS).map(([id, value]) => <option key={id} value={id}>{value.name}</option>)}</select></label>
      <label>Days<select className="mt-1 block rounded bg-slate-800 p-2" value={days} onChange={e => setDays(Number(e.target.value))}>{[1, 7, 30].map(value => <option key={value}>{value}</option>)}</select></label>
      <button disabled={loading} onClick={load} className="self-end rounded bg-sky-200 px-3 py-2 font-semibold text-slate-950 disabled:opacity-50">{loading ? 'Loading…' : 'Load rainfall'}</button>
    </div>
    <div aria-live="polite">{error && <p className="mt-3 text-amber-200">{error}</p>}{data && <>
      <p className="mt-3 font-semibold">{data.name} · {data.available}/{data.days.length} daily values available</p>
      <p className="mt-1">Station: {data.latitude}, {data.longitude}. Provider dates are preserved. Daily accumulation boundaries have not been aligned to an incident time; no 72-hour total is inferred.</p>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">Environment Agency daily rainfall and quality flags</caption><thead><tr><th className="p-1">Provider date</th><th className="p-1">mm</th><th className="p-1">Quality / completeness</th></tr></thead><tbody>{data.days.map(day => <tr className="border-t border-slate-700" key={day.date}><td className="p-1">{day.date}</td><td className="p-1">{day.value === null ? 'Missing' : day.value.toFixed(1)}</td><td className="p-1">{day.quality} / {day.completeness}</td></tr>)}</tbody></table></div>
      <p className="mt-2">Unchecked, estimated or suspect readings retain their provider flags. Available does not mean independently verified. Rainfall alone cannot establish an operational impact.</p>
      <p className="mt-2"><a href={data.sourceUrl} target="_blank" rel="noreferrer" className="underline">Original readings</a> · <a href={data.stationUrl} target="_blank" rel="noreferrer" className="underline">Station metadata</a> · <a href={data.licence} target="_blank" rel="noreferrer" className="underline">Licence</a></p>
      <p className="mt-2 text-[11px]">{data.attribution} Presented as a dated table with explicit gaps. Retrieved {data.retrievedAt}.</p>
    </>}</div>
  </details>
}
