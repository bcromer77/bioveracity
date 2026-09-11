'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, MapPin, Loader2 } from 'lucide-react'

const TYPEWRITER_PHRASES = [
  'River Blackwater water quality',
  'Poolbeg incinerator emissions',
  'Derrybrien wind farm planning',
  'Galway Bay shellfish pollution',
  'Cork harbour dredging',
  'Liffey flood defences',
  'Shannon estuary biodiversity',
]

function useTypewriter(phrases: string[], speed = 60, pause = 2000) {
  const [text, setText] = useState('')
  const idx = useRef(0)
  const charPos = useRef(0)
  const deleting = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function tick() {
      const phrase = phrases[idx.current]
      if (!deleting.current) {
        charPos.current++
        setText(phrase.slice(0, charPos.current))
        if (charPos.current >= phrase.length) {
          deleting.current = true
          timer.current = setTimeout(tick, pause)
          return
        }
      } else {
        charPos.current--
        setText(phrase.slice(0, charPos.current))
        if (charPos.current <= 0) {
          deleting.current = false
          idx.current = (idx.current + 1) % phrases.length
        }
      }
      timer.current = setTimeout(tick, deleting.current ? speed / 2 : speed)
    }
    timer.current = setTimeout(tick, speed)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [phrases, speed, pause])

  return text
}

const TYPE_LABELS: Record<string, string> = {
  port: 'Port',
  wastewater: 'Wastewater',
  river: 'River',
  lake: 'Lake',
  industrial: 'Industrial',
}

export function UniversalSearch({
  size = 'large',
  initialValue = '',
  autoFocus = false,
  showSubmitButton = false,
}: {
  size?: 'large' | 'compact'
  initialValue?: string
  autoFocus?: boolean
  showSubmitButton?: boolean
}) {
  const router = useRouter()
  const [value, setValue] = useState(initialValue)
  const [results, setResults] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const typewriterText = useTypewriter(TYPEWRITER_PHRASES)
  const [activeIdx, setActiveIdx] = useState(-1)
  const boxRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<any>(null)

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const fetchResults = useCallback((q: string) => {
    if (!q || q.trim().length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    fetch(`/api/search?q=${encodeURIComponent(q)}&limit=6`)
      .then((r) => r.json())
      .then((data) => {
        setResults(data?.results ?? [])
        setOpen(true)
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchResults(value), 220)
    return () => clearTimeout(debounceRef.current)
  }, [value, fetchResults])

  function submit(q?: string) {
    const query = (q ?? value).trim()
    if (!query) return
    setOpen(false)
    router.push(`/search?q=${encodeURIComponent(query)}`)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      if (activeIdx >= 0 && results[activeIdx]) {
        router.push(`/asset/${results[activeIdx].slug}`)
        setOpen(false)
      } else {
        submit()
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const big = size === 'large'

  return (
    <div ref={boxRef} className="relative w-full">
      <div
        className={`flex items-center gap-3 rounded-lg border-2 border-input bg-white transition-colors focus-within:border-foreground ${
          big ? 'px-4 py-3.5 md:px-5' : 'px-3 py-2'
        }`}
      >
        <Search className={`shrink-0 text-muted-foreground ${big ? 'h-5 w-5' : 'h-4 w-4'}`} />
        <div className="relative flex-1">
          <input
            autoFocus={autoFocus}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setActiveIdx(-1)
            }}
            onFocus={() => { setFocused(true); if (value.trim().length >= 2) setOpen(true) }}
            onBlur={() => setFocused(false)}
            onKeyDown={onKeyDown}
            placeholder={focused ? 'Search a river, place, facility or issue' : undefined}
            aria-label="Search a river, place, facility or environmental issue"
            className={`w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground ${
              big ? 'text-[17px] md:text-lg' : 'text-[15px]'
            }`}
          />
          {!focused && !value && (
            <span
              aria-hidden
              className={`pointer-events-none absolute inset-0 flex items-center text-muted-foreground ${
                big ? 'text-[17px] md:text-lg' : 'text-[15px]'
              }`}
            >
              {typewriterText}<span className="ml-px inline-block h-[1.1em] w-[2px] animate-pulse bg-muted-foreground/60" />
            </span>
          )}
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {!showSubmitButton && (
          <button
            onClick={() => submit()}
            aria-label="Search"
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-md bg-accent font-semibold text-accent-foreground transition-colors hover:brightness-95 ${
              big ? 'px-4 py-2 text-[15px]' : 'px-2.5 py-1.5 text-xs'
            }`}
          >
            <span className="hidden sm:inline">Search</span>
            <Search className="h-4 w-4 sm:hidden" />
          </button>
        )}
      </div>

      {showSubmitButton && (
        <button
          onClick={() => submit()}
          className="mt-4 inline-flex items-center justify-center rounded-md bg-accent px-8 py-3 text-[16px] font-semibold text-accent-foreground transition-colors hover:brightness-95"
        >
          Search
        </button>
      )}

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-lg border border-border bg-popover text-left shadow-lg">
          {results.map((r: any, i: number) => (
            <button
              key={r.id}
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => {
                router.push(`/asset/${r.slug}`)
                setOpen(false)
              }}
              className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                activeIdx === i ? 'bg-secondary' : 'hover:bg-secondary/50'
              }`}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-semibold text-foreground">{r.name}</span>
                  <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                    {TYPE_LABELS[r.type] ?? r.type}
                  </span>
                </div>
                <p className="truncate text-[13px] text-muted-foreground">
                  {r.region}
                  {r.lastChange ? ` · last change: ${r.lastChange.title}` : ''}
                </p>
              </div>
            </button>
          ))}
          <button
            onClick={() => submit()}
            className="flex w-full items-center gap-2 border-t border-border px-4 py-2.5 text-left text-[13px] text-muted-foreground hover:bg-secondary/50"
          >
            <Search className="h-3.5 w-3.5" />
            See all results for “{value}”
          </button>
        </div>
      )}
    </div>
  )
}
