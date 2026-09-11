'use client'

import { useState, useEffect } from 'react'

// Animated explainer that cycles through the three BioVeracity case-building
// stages on a continuous loop. Pure CSS animation + React state — no deps.

const STAGES = [
  {
    label: 'Open a case',
    accent: 'hsl(var(--primary))',
    docs: [] as string[],
    timeline: false,
    report: false,
  },
  {
    label: 'Add and review evidence',
    accent: 'hsl(var(--accent))',
    docs: ['Planning report.pdf', 'Ecology survey.pdf', 'Water quality.csv'],
    timeline: true,
    report: false,
  },
  {
    label: 'Build the record',
    accent: 'hsl(var(--primary))',
    docs: ['Planning report.pdf', 'Ecology survey.pdf', 'Water quality.csv'],
    timeline: true,
    report: true,
  },
] as const

const CYCLE_MS = 3200

export function HowItWorksAnimation() {
  const [stage, setStage] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setStage(s => (s + 1) % STAGES.length)
        setVisible(true)
      }, 350)
    }, CYCLE_MS)
    return () => clearInterval(id)
  }, [])

  const s = STAGES[stage]

  return (
    <div
      aria-hidden
      className="relative mx-auto w-full max-w-[480px] select-none overflow-hidden rounded-xl border border-border bg-card shadow-md"
      style={{ minHeight: 310 }}
    >
      {/* Top bar */}
      <div className="flex items-center gap-2 border-b border-border bg-secondary/60 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
        <span className="ml-2 text-xs font-medium text-muted-foreground">BioVeracity</span>
      </div>

      {/* Stage badge */}
      <div className="px-5 pt-4">
        <div
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-500"
          style={{
            borderColor: s.accent,
            color: s.accent,
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(-6px)',
          }}
        >
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-white"
            style={{ backgroundColor: s.accent }}
          >
            {stage + 1}
          </span>
          {s.label}
        </div>
      </div>

      {/* Animated content area */}
      <div
        className="relative px-5 pb-5 pt-4 transition-all duration-500"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(8px)',
        }}
      >
        {/* Case header — always visible */}
        <div className="mb-3 flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
              <path d="M14 2v4a2 2 0 0 0 2 2h4" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">Enniscorthy flood case</p>
            <p className="text-[11px] text-muted-foreground">3 sources · River Slaney</p>
          </div>
        </div>

        {/* Documents panel */}
        <div className="space-y-1.5">
          {s.docs.map((doc, i) => (
            <div
              key={doc}
              className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs transition-all duration-500"
              style={{
                animationDelay: `${i * 150}ms`,
                animation: visible ? `slideIn 0.5s ease ${i * 150}ms both` : 'none',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-primary/70">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span className="text-foreground/80 font-medium">{doc}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-green-600">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          ))}
          {s.docs.length === 0 && (
            <div className="flex h-[104px] items-center justify-center rounded-md border-2 border-dashed border-border text-xs text-muted-foreground">
              Drop evidence files here
            </div>
          )}
        </div>

        {/* Timeline bar */}
        {s.timeline && (
          <div className="mt-3 rounded-md border border-border bg-secondary/30 px-3 py-2">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Chronology</p>
            <div className="flex items-center gap-1">
              {['2019', '2020', '2021', '2022', '2023'].map((yr, i) => (
                <div key={yr} className="flex flex-col items-center flex-1">
                  <div
                    className="h-1.5 w-full rounded-full transition-all duration-700"
                    style={{
                      backgroundColor: i <= 3 ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                      opacity: visible ? 1 : 0.3,
                      transitionDelay: `${i * 100}ms`,
                    }}
                  />
                  <span className="mt-1 text-[9px] text-muted-foreground">{yr}</span>
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex gap-1">
              {[
                { c: 'bg-blue-500/20 text-blue-700', l: 'Planning' },
                { c: 'bg-emerald-500/20 text-emerald-700', l: 'Ecology' },
                { c: 'bg-sky-500/20 text-sky-700', l: 'Water' },
              ].map(t => (
                <span key={t.l} className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${t.c}`}>{t.l}</span>
              ))}
            </div>
          </div>
        )}

        {/* Report */}
        {s.report && (
          <div
            className="mt-3 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs"
            style={{
              animation: visible ? 'slideIn 0.5s ease 0.3s both' : 'none',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4" />
              <path d="M14 2v4a2 2 0 0 0 2 2h4" />
              <path d="m3 15 2 2 4-4" />
            </svg>
            <span className="font-medium text-primary">Reviewed report ready</span>
          </div>
        )}
      </div>

      {/* Keyframe injection */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
