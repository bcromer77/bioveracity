'use client'

import { useState, useRef } from 'react'
import { Send, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AnswerSection {
  title: string
  content: string
}

const SECTION_HEADERS = [
  'What We Know', 'What We Do Not Know', 'Why It Matters',
  'Who Should Care', 'What Evidence Would Resolve It', 'What To Watch Next', 'Sources',
]

export function PlaceAsk({ assetName }: { assetName: string }) {
  const [question, setQuestion] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamedText, setStreamedText] = useState('')
  const [sections, setSections] = useState<AnswerSection[]>([])
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const suggestions = [
    `What changed most recently at ${assetName}?`,
    `Where does the evidence disagree about ${assetName}?`,
    `What evidence gaps exist at ${assetName}?`,
  ]

  const parseSections = (text: string) => {
    const result: AnswerSection[] = []
    let currentTitle = ''
    let currentContent = ''
    const lines = (text ?? '').split('\n')
    for (const line of lines) {
      const cleaned = line?.replace(/^#+\s*/, '')?.replace(/\*\*/g, '')?.trim()
      const matched = SECTION_HEADERS.find((h) => cleaned?.toLowerCase() === h.toLowerCase())
      if (matched) {
        if (currentTitle) result.push({ title: currentTitle, content: currentContent.trim() })
        currentTitle = matched
        currentContent = ''
      } else {
        currentContent += line + '\n'
      }
    }
    if (currentTitle) result.push({ title: currentTitle, content: currentContent.trim() })
    if (result.length > 0) setSections(result)
  }

  const handleAsk = async (q?: string) => {
    const raw = q ?? question
    if (!raw?.trim()) return
    const scoped = `Regarding ${assetName}: ${raw.trim()}`
    setIsStreaming(true)
    setStreamedText('')
    setSections([])
    setError('')
    setQuestion(raw)
    abortRef.current = new AbortController()
    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: scoped }),
        signal: abortRef.current.signal,
      })
      if (!response.ok) throw new Error('Failed to get response')
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let partialRead = ''
      while (true) {
        const { done, value } = await reader!.read()
        if (done) break
        partialRead += decoder.decode(value, { stream: true })
        const lines = partialRead.split('\n')
        partialRead = lines.pop() ?? ''
        for (const line of lines) {
          if (line?.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              if (parsed?.status === 'processing') {
                buffer += parsed?.content ?? ''
                setStreamedText(buffer)
              } else if (parsed?.status === 'completed') {
                setStreamedText(parsed?.content ?? buffer)
                parseSections(parsed?.content ?? buffer)
              } else if (parsed?.status === 'error') {
                setError(parsed?.message ?? 'An error occurred')
              }
            } catch { /* skip */ }
          }
        }
      }
      if (!sections.length && buffer) parseSections(buffer)
    } catch (err: any) {
      if (err?.name !== 'AbortError') setError(err?.message ?? 'Request failed')
    } finally {
      setIsStreaming(false)
    }
  }

  return (
    <div>
      <div className="relative mb-4">
        <Sparkles className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-accent" />
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
          placeholder={`Ask about ${assetName}…`}
          className="w-full rounded-lg border-2 border-input bg-background py-3.5 pl-11 pr-14 text-[16px] transition-colors focus:outline-none focus:border-foreground"
          disabled={isStreaming}
        />
        <Button
          size="sm"
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-accent text-accent-foreground hover:bg-accent/90"
          onClick={() => handleAsk()}
          disabled={isStreaming || !question.trim()}
        >
          {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>

      {!streamedText && !isStreaming && !error && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => handleAsk(s)}
              className="rounded-full border border-border bg-muted/50 px-3.5 py-1.5 text-[14px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
      )}

      {(isStreaming || streamedText) && (
        <div className="space-y-3">
          {sections.length > 0 ? (
            sections.map((section, i) => (
              <div key={i} className="rounded-lg border border-border/50 bg-card p-4">
                <h3 className="mb-2 flex items-center gap-2 font-display text-[16px] font-bold text-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  {section.title}
                </h3>
                <div className="whitespace-pre-line text-[15px] leading-relaxed text-foreground/80">{section.content}</div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-border/50 bg-card p-4">
              <div className="whitespace-pre-line text-[15px] leading-relaxed text-foreground/80">
                {streamedText}
                {isStreaming && <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-accent/50" />}
              </div>
            </div>
          )}
          {isStreaming && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Analysing evidence…
            </div>
          )}
        </div>
      )}
    </div>
  )
}
