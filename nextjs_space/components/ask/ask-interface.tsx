'use client'

import { useState, useRef } from 'react'
import { Search, Send, Loader2, HelpCircle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EvidenceBadge, EvidenceLegend } from '@/components/evidence-badge'
import { FadeIn, SlideIn } from '@/components/ui/animate'

const EXAMPLE_QUESTIONS = [
  'What is the current status of the Seafield sludge investment project?',
  'What evidence gaps exist at Lough Neagh?',
  'Has the Environment Agency taken enforcement action at March WRC?',
  'What dredging permits does Dublin Port hold?',
  'What capital projects are planned at Port of Cork Ringaskiddy?',
  'What nutrient attribution data exists for Lough Neagh?',
]

interface AnswerSection {
  title: string
  content: string
}

export function AskInterface() {
  const [question, setQuestion] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamedText, setStreamedText] = useState('')
  const [sections, setSections] = useState<AnswerSection[]>([])
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const handleAsk = async (q?: string) => {
    const query = q ?? question
    if (!query?.trim()) return
    setIsStreaming(true)
    setStreamedText('')
    setSections([])
    setError('')
    setQuestion(query)

    abortRef.current = new AbortController()

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query }),
        signal: abortRef.current?.signal,
      })

      if (!response?.ok) throw new Error('Failed to get response')

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
      if (!sections?.length && buffer) parseSections(buffer)
    } catch (err: any) {
      if (err?.name !== 'AbortError') setError(err?.message ?? 'Request failed')
    } finally {
      setIsStreaming(false)
    }
  }

  const parseSections = (text: string) => {
    const sectionHeaders = [
      'What We Know', 'What We Do Not Know', 'Why It Matters',
      'Who Should Care', 'What Evidence Would Resolve It', 'What To Watch Next', 'Sources'
    ]
    const result: AnswerSection[] = []
    let currentTitle = ''
    let currentContent = ''
    const lines = (text ?? '').split('\n')
    for (const line of lines) {
      const cleaned = line?.replace(/^#+\s*/, '')?.replace(/\*\*/g, '')?.trim()
      const matchedHeader = sectionHeaders.find((h: string) => cleaned?.toLowerCase() === h?.toLowerCase())
      if (matchedHeader) {
        if (currentTitle) result.push({ title: currentTitle, content: currentContent?.trim() })
        currentTitle = matchedHeader
        currentContent = ''
      } else {
        currentContent += line + '\n'
      }
    }
    if (currentTitle) result.push({ title: currentTitle, content: currentContent?.trim() })
    if (result?.length > 0) setSections(result)
  }

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8">
      <FadeIn>
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight mb-2">Ask BioVeracity</h1>
          <p className="text-sm text-muted-foreground">Ask about a port, river, wastewater plant, permit or environmental problem</p>
        </div>
      </FadeIn>

      <SlideIn from="bottom" delay={0.1}>
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            value={question}
            onChange={(e: any) => setQuestion(e?.target?.value ?? '')}
            onKeyDown={(e: any) => e?.key === 'Enter' && handleAsk()}
            placeholder="What happened at Lough Neagh?"
            className="w-full pl-12 pr-14 py-4 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
            disabled={isStreaming}
          />
          <Button
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={() => handleAsk()}
            disabled={isStreaming || !question?.trim()}
          >
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </SlideIn>

      {!streamedText && !isStreaming && !error && (
        <FadeIn delay={0.2}>
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Example questions</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {EXAMPLE_QUESTIONS?.map((q: string) => (
                <button
                  key={q}
                  onClick={() => handleAsk(q)}
                  className="text-left p-3 rounded-md bg-secondary/50 hover:bg-secondary text-xs transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
          <EvidenceLegend />
        </FadeIn>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          {error}
        </div>
      )}

      {(isStreaming || streamedText) && (
        <div className="space-y-4">
          {sections?.length > 0 ? (
            sections?.map((section: AnswerSection, i: number) => (
              <div key={i} className="p-4 rounded-lg bg-card border border-border/50" style={{ boxShadow: 'var(--shadow-sm)' }}>
                <h3 className="font-display font-semibold text-sm mb-2 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  {section?.title}
                </h3>
                <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {section?.content}
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 rounded-lg bg-card border border-border/50" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {streamedText}
                {isStreaming && <span className="inline-block w-2 h-4 bg-accent/50 animate-pulse ml-1" />}
              </div>
            </div>
          )}
          {isStreaming && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Analysing evidence…
            </div>
          )}
        </div>
      )}
    </div>
  )
}
