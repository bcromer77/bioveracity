import { getEvidenceDisplay } from '@/lib/evidence-taxonomy'

function esc(s: any): string {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtDate(d: any): string {
  if (!d) return 'date unknown'
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  } catch {
    return 'date unknown'
  }
}

function badge(classCode?: string): string {
  const m = getEvidenceDisplay(classCode ?? 'A')
  return `<span class="ev ev-${esc(m.state)}">${m.symbol} ${esc(m.label)}</span>`
}

function changeLabel(kind?: string): string {
  switch (kind) {
    case 'divergence': return 'Divergence'
    case 'material_change': return 'Material change'
    case 'corroboration': return 'Corroboration'
    case 'gap': return 'Evidence gap'
    default: return 'Event'
  }
}

function pickLastChange(events: any[]): any | null {
  if (!events?.length) return null
  const sorted = [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const priority = sorted.find((e) => ['divergence', 'material_change'].includes(e.changeType))
  return priority ?? sorted[0]
}

const CSS = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; color: #14181f; line-height: 1.5; font-size: 12px; margin: 0; }
  h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -0.01em; }
  h2 { font-size: 14px; margin: 26px 0 10px; padding-bottom: 5px; border-bottom: 2px solid #e0a53a; text-transform: uppercase; letter-spacing: 0.04em; }
  h3 { font-size: 12px; margin: 14px 0 4px; }
  .brand { font-size: 11px; font-weight: 700; letter-spacing: 0.18em; color: #b5822a; text-transform: uppercase; }
  .muted { color: #5b6572; }
  .meta { color: #5b6572; font-size: 11px; margin: 2px 0; }
  .kv { display: flex; gap: 8px; font-size: 11px; margin: 2px 0; }
  .kv b { min-width: 96px; color: #5b6572; font-weight: 600; }
  .card { border: 1px solid #e3e7ee; border-radius: 8px; padding: 12px 14px; margin: 8px 0; }
  .lastchange { background: #fbf5e9; border: 1px solid #efd9a6; border-radius: 8px; padding: 12px 14px; margin: 10px 0; }
  .diverge { background: #fbf3e6; border: 1px solid #edc987; border-radius: 8px; padding: 12px 14px; margin: 10px 0; }
  .diverge .title { color: #a6690a; font-weight: 700; }
  .row { display: grid; grid-template-columns: 130px 1fr; gap: 6px; margin: 4px 0; font-size: 11px; }
  .row .lbl { color: #5b6572; text-transform: uppercase; font-size: 9px; letter-spacing: 0.05em; padding-top: 1px; }
  .row .hl { color: #a6690a; font-weight: 600; }
  .ev { display: inline-block; font-size: 9px; padding: 1px 6px; border-radius: 10px; border: 1px solid #d7dbe3; margin-right: 4px; white-space: nowrap; }
  .ev-verified { color: #1c7a43; border-color: #b6e0c6; background: #eefaf1; }
  .ev-official { color: #a6690a; border-color: #edc987; background: #fdf6e8; }
  .ev-public { color: #566; border-color: #d7dbe3; background: #f4f5f7; }
  .ev-analysis { color: #2a5fa6; border-color: #b6cbe8; background: #eef3fb; }
  .ev-gap { color: #b4530f; border-color: #f0c39a; background: #fdf1e7; }
  .item { border-bottom: 1px solid #eef1f5; padding: 8px 0; }
  .item:last-child { border-bottom: none; }
  .item .h { font-weight: 600; font-size: 11.5px; }
  .item .d { color: #5b6572; font-size: 11px; margin-top: 2px; }
  .item .s { color: #8a929e; font-size: 10px; margin-top: 3px; }
  .gap { background: #fdf6ef; border: 1px solid #f0d8bf; border-radius: 6px; padding: 8px 10px; margin: 6px 0; }
  .legend { margin-top: 6px; font-size: 10px; }
  .legend span { margin-right: 10px; }
  .disclaimer { margin-top: 26px; padding-top: 12px; border-top: 1px solid #e3e7ee; color: #8a929e; font-size: 9.5px; line-height: 1.6; }
  .empty { color: #8a929e; font-size: 11px; font-style: italic; }
`

function header(asset: any): string {
  return `
    <div class="brand">BioVeracity · Environmental Evidence Record</div>
    <h1>${esc(asset?.name)}</h1>
    <div class="meta">${esc(asset?.type ?? '')}${asset?.subtype ? ' · ' + esc(asset.subtype) : ''} · ${esc(asset?.jurisdiction ?? asset?.region ?? '')}</div>
    <div class="meta">Generated ${fmtDate(new Date())} · Status: ${esc(asset?.status ?? 'active')}</div>
  `
}

function summaryBlock(asset: any): string {
  const last = pickLastChange(asset?.events ?? [])
  const lastHtml = last
    ? `<div class="lastchange">
         <div class="muted" style="font-size:9px;text-transform:uppercase;letter-spacing:0.05em;">Last meaningful change · ${esc(changeLabel(last.changeType))}</div>
         <div style="font-weight:600;margin:3px 0;">${esc(last.title)}</div>
         <div class="muted">${fmtDate(last.date)} — ${badge(last.evidenceClass)}</div>
       </div>`
    : `<div class="lastchange"><span class="empty">No meaningful change recorded yet.</span></div>`
  return `
    <h2>Quick Summary</h2>
    ${asset?.operatorName ? `<div class="kv"><b>Operator</b><span>${esc(asset.operatorName)}</span></div>` : ''}
    ${asset?.regulatorName ? `<div class="kv"><b>Regulator</b><span>${esc(asset.regulatorName)}</span></div>` : ''}
    ${asset?.statusDetail ? `<p class="muted">${esc(asset.statusDetail)}</p>` : ''}
    ${asset?.summary ? `<p>${esc(asset.summary)}</p>` : ''}
    ${lastHtml}
    <div class="kv"><b>On record</b><span>${(asset?.events ?? []).length} events · ${(asset?.divergences ?? []).length} divergences · ${(asset?.evidenceGaps ?? []).length} open evidence gaps</span></div>
  `
}

function divergenceSection(asset: any): string {
  const divs = asset?.divergences ?? []
  const inner = divs.length
    ? divs.map((d: any) => `
        <div class="diverge">
          <div class="title">⚠ ${esc(d.title || 'The evidence starts to disagree here')}</div>
          <div class="muted" style="margin:2px 0 6px;">${fmtDate(d.date)}${d.summary ? ' — ' + esc(d.summary) : ''}</div>
          <div class="row"><span class="lbl">Before</span><span>${esc(d.before)}</span></div>
          <div class="row"><span class="lbl">The change</span><span>${esc(d.theChange)}</span></div>
          <div class="row"><span class="lbl">The difference</span><span class="hl">${esc(d.theDifference)}</span></div>
          ${d.whatHappenedNext ? `<div class="row"><span class="lbl">What happened next</span><span>${esc(d.whatHappenedNext)}</span></div>` : ''}
          <div class="row"><span class="lbl">Status</span><span>${esc((d.status ?? 'unresolved').replace('_', ' '))}</span></div>
          ${d.sourceUrl ? `<div class="row"><span class="lbl">Source</span><span>${esc(d.sourceDomain ?? d.sourceUrl)}</span></div>` : ''}
        </div>`).join('')
    : `<p class="empty">Across the sources on record, the evidence does not currently disagree in a material way. This is stated as a finding, not padded.</p>`
  return `<h2>Where the evidence changed</h2>${inner}`
}

function timelineSection(asset: any): string {
  const events = [...(asset?.events ?? [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  if (!events.length) return `<h2>Chronology</h2><p class="empty">No chronology recorded for this place yet.</p>`
  const items = events.map((e: any) => `
    <div class="item">
      <div class="h">${esc(e.title)} <span class="muted" style="font-weight:400;">· ${esc(changeLabel(e.changeType))}</span></div>
      ${e.description ? `<div class="d">${esc(e.description)}</div>` : ''}
      <div class="s">${fmtDate(e.date)} · ${badge(e.evidenceClass)}${e.sourceDomain ? ' · ' + esc(e.sourceDomain) : ''}</div>
    </div>`).join('')
  return `<h2>Chronology</h2><div class="card">${items}</div>`
}

function listSection(title: string, rows: any[], render: (r: any) => string): string {
  if (!rows?.length) return `<h2>${esc(title)}</h2><p class="empty">None on record.</p>`
  return `<h2>${esc(title)}</h2><div class="card">${rows.map(render).join('')}</div>`
}

function gapsSection(asset: any): string {
  const gaps = asset?.evidenceGaps ?? []
  if (!gaps.length) return `<h2>Open evidence gaps</h2><p class="empty">No open evidence gaps identified.</p>`
  return `<h2>Open evidence gaps</h2>${gaps.map((g: any) => `
    <div class="gap">
      <div class="h" style="font-weight:600;">□ ${esc(g.description)}</div>
      ${g.consequence ? `<div class="d"><b>Decision consequence:</b> ${esc(g.consequence)}</div>` : ''}
      ${g.dataRequired ? `<div class="d"><b>Data required:</b> ${esc(g.dataRequired)}</div>` : ''}
      <div class="s">${esc(g.priority ?? 'medium')} priority</div>
    </div>`).join('')}`
}

const DISCLAIMER = `
  <div class="disclaimer">
    BioVeracity is independent and is not affiliated with, endorsed by, or acting on behalf of any regulator or government body.
    Each entry carries its evidence classification: ● Verified Record, ◐ Official / Operator Statement, ○ Public / Community Report,
    △ BioVeracity Analysis, □ Evidence Gap. Community reports are evidence of concern, not proof of a violation. The absence of an
    enforcement record does not prove compliance. Where the record is silent, that silence is marked — it is not filled in.
    This record reflects the sources available at the time of generation.
  </div>
`

export function buildRecordHtml(asset: any, kind: 'summary' | 'report'): string {
  const legend = `<div class="legend muted"><span>● Verified</span><span>◐ Official / Operator</span><span>○ Public / Community</span><span>△ Analysis</span><span>□ Gap</span></div>`

  let body = ''
  if (kind === 'summary') {
    body = `${header(asset)}${legend}${summaryBlock(asset)}${divergenceSection(asset)}${DISCLAIMER}`
  } else {
    body = `
      ${header(asset)}${legend}
      ${summaryBlock(asset)}
      ${asset?.description ? `<h2>Overview</h2><p>${esc(asset.description)}</p>` : ''}
      ${divergenceSection(asset)}
      ${timelineSection(asset)}
      ${listSection('Regulatory activity', asset?.regulatoryItems ?? [], (r) => `
        <div class="item"><div class="h">${esc(r.title)}</div>${r.description ? `<div class="d">${esc(r.description)}</div>` : ''}<div class="s">${r.regulator ? esc(r.regulator) + ' · ' : ''}${fmtDate(r.date)} · ${badge(r.evidenceClass)}</div></div>`)}
      ${listSection('Authorisations', asset?.authorisations ?? [], (a) => `
        <div class="item"><div class="h">${esc(a.description ?? a.type)}${a.permitRef ? ' · ' + esc(a.permitRef) : ''}</div><div class="s">${a.authority ? esc(a.authority) + ' · ' : ''}status: ${esc(a.status ?? 'active')} · ${badge(a.evidenceClass)}</div></div>`)}
      ${listSection('Capital projects', asset?.capitalProjects ?? [], (p) => `
        <div class="item"><div class="h">${esc(p.name)}${p.value ? ' · ' + esc(p.value) : ''}</div>${p.description ? `<div class="d">${esc(p.description)}</div>` : ''}<div class="s">status: ${esc(p.status ?? 'planned')} · ${badge(p.evidenceClass)}</div></div>`)}
      ${listSection('Environmental monitoring', asset?.measurements ?? [], (m) => `
        <div class="item"><div class="h">${esc(m.parameter)}: ${esc(m.value ?? '')} ${esc(m.unit ?? '')}</div><div class="s">${m.station ? esc(m.station) + ' · ' : ''}${fmtDate(m.date)} · ${badge(m.evidenceClass)}${m.validated ? '' : ' · non-validated'}</div></div>`)}
      ${listSection('Community context', asset?.communityItems ?? [], (c) => `
        <div class="item"><div class="h">${esc(c.title)}</div>${c.description ? `<div class="d">${esc(c.description)}</div>` : ''}<div class="s">${c.reportedBy ? esc(c.reportedBy) + ' · ' : ''}${fmtDate(c.date)} · ${badge(c.evidenceClass)}</div></div>`)}
      ${listSection('Recent sources', asset?.newsItems ?? [], (n) => `
        <div class="item"><div class="h">${esc(n.title)}</div><div class="s">${n.sourceDomain ? esc(n.sourceDomain) + ' · ' : ''}${fmtDate(n.date)} · ${badge(n.evidenceClass)}</div></div>`)}
      ${gapsSection(asset)}
      ${DISCLAIMER}
    `
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`
}
