'use client'
import { EvidenceLink } from '@/components/evidence-link'


import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// Source-context viewer (Slice 2B). Opens the exact cited passage in its surrounding
// context inside an accessible dialog (Escape closes; focus is trapped and returned to
// the trigger by the shadcn/Radix DialogContent). For a retained PDF it additionally
// renders the correct PHYSICAL page as an image (derived from the passage locator
// "PDF page N"), alongside the exact cited passage text. If the page cannot be resolved
// or rendered — or the document is not a PDF — it falls back to the extracted-text panel
// and offers an authorised download; it never fabricates a PDF highlight.

export type ContextPassage = { id: string; ordinal: number; locator: string; text: string; isTarget: boolean }
export type SourceContext = {
  document: { id: string; name: string; sourceUrl: string | null; publicationDate: string | null; parserVersion: string; passageCount: number }
  target: { id: string; ordinal: number; locator: string }
  citation: string
  radius: number
  passages: ContextPassage[]
}

function pdfPageFromLocator(locator: string): number | null {
  const m = /PDF page (\d+)/i.exec(locator || '')
  if (!m) return null
  const n = parseInt(m[1], 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function SourceViewer({
  open, onOpenChange, context, busy, error, endpoint, citationHref,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  context: SourceContext | null
  busy: boolean
  error: string
  endpoint: string
  citationHref: string
}) {
  const [copied, setCopied] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [pdfError, setPdfError] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  // Guards so a slower render for an earlier document/page can never paint over a newer one.
  const renderSeq = useRef(0)
  // Cache of the loaded pdf.js document for the currently open source.
  const pdfDocRef = useRef<{ numPages: number; getPage: (n: number) => Promise<unknown> } | null>(null)
  const loadedDocIdRef = useRef<string>('')

  const targetPage = context ? pdfPageFromLocator(context.target.locator) : null
  const isPdfTarget = targetPage !== null

  useEffect(() => { setCopied(false) }, [citationHref, open])

  // Reset per-source state whenever a different source is opened.
  useEffect(() => {
    setPdfError(''); setTotalPages(0)
    setPage(targetPage ?? 1)
    if (!context || context.document.id !== loadedDocIdRef.current) { pdfDocRef.current = null; loadedDocIdRef.current = '' }
  }, [context?.document.id, targetPage])

  const copyLink = useCallback(async () => {
    try {
      const absolute = citationHref.startsWith('http') ? citationHref : `${window.location.origin}${citationHref}`
      await navigator.clipboard.writeText(absolute)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch { setCopied(false) }
  }, [citationHref])

  // Load + render the requested PDF page. Fully client-side; any failure degrades to the
  // text panel below without breaking the dialog.
  useEffect(() => {
    if (!open || !context || !isPdfTarget) return
    let cancelled = false
    const seq = ++renderSeq.current
    setPdfBusy(true); setPdfError('')
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        // Version-matched worker copied to /public at build time.
        ;(pdfjs as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        let doc = pdfDocRef.current
        if (!doc || loadedDocIdRef.current !== context.document.id) {
          const res = await fetch(`${endpoint}?action=original&id=${encodeURIComponent(context.document.id)}`, { cache: 'no-store', credentials: 'same-origin' })
          if (!res.ok) throw new Error('The original document could not be retrieved.')
          const bytes = new Uint8Array(await res.arrayBuffer())
          const loadingTask = (pdfjs as unknown as { getDocument: (o: unknown) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<unknown> }> } }).getDocument({ data: bytes })
          doc = await loadingTask.promise
          if (cancelled || seq !== renderSeq.current) return
          pdfDocRef.current = doc; loadedDocIdRef.current = context.document.id
        }
        const numPages = doc.numPages
        if (!cancelled && seq === renderSeq.current) setTotalPages(numPages)
        const wanted = Math.min(Math.max(page, 1), numPages)
        const pageObj = await doc.getPage(wanted) as { getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: unknown) => { promise: Promise<void> } }
        if (cancelled || seq !== renderSeq.current) return
        const canvas = canvasRef.current
        if (!canvas) return
        const baseViewport = pageObj.getViewport({ scale: 1 })
        const targetWidth = Math.min(680, Math.max(320, canvas.parentElement?.clientWidth ?? 560))
        const scale = targetWidth / baseViewport.width
        const viewport = pageObj.getViewport({ scale })
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas unavailable')
        canvas.width = Math.floor(viewport.width); canvas.height = Math.floor(viewport.height)
        await pageObj.render({ canvasContext: ctx, viewport, canvas }).promise
        if (cancelled || seq !== renderSeq.current) return
        setPdfBusy(false)
      } catch (e) {
        if (cancelled || seq !== renderSeq.current) return
        setPdfError(e instanceof Error ? e.message : 'This page could not be displayed. Download the authorised original below.')
        setPdfBusy(false)
      }
    })()
    return () => { cancelled = true }
  }, [open, context, isPdfTarget, page, endpoint])

  async function download() {
    if (!context) return
    try {
      const res = await fetch(`${endpoint}?action=original&id=${encodeURIComponent(context.document.id)}`, { cache: 'no-store', credentials: 'same-origin' })
      if (!res.ok) throw new Error()
      const blob = await res.blob(); const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = context.document.name || 'original'; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { /* surfaced by the disabled state; download is best-effort */ }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Source in context</DialogTitle>
        </DialogHeader>
        {busy && <p className="mt-2 text-sm text-muted-foreground" role="status">Reopening the cited source location…</p>}
        {error && <p className="mt-2 rounded-md border border-destructive p-3 text-sm" role="alert">{error}</p>}
        {context && (<>
          <div className="mt-1 rounded-md border border-border bg-background p-3">
            <p className="text-sm font-semibold break-words">{context.document.name}</p>
            <p className="mt-1 text-xs text-muted-foreground break-words">Citation: {context.citation}</p>
            <p className="mt-1 text-xs text-muted-foreground">Passage {context.target.ordinal + 1} of {context.document.passageCount} in this document{context.document.publicationDate ? ` · published ${context.document.publicationDate}` : ''}{context.document.parserVersion ? ` · ${context.document.parserVersion}` : ''}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="outline" onClick={copyLink}>{copied ? 'Link copied' : 'Copy citation link'}</Button>
              <Button variant="outline" onClick={download}>Download original document</Button>
              {context.document.sourceUrl && <EvidenceLink href={context.document.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center text-sm underline">Provider attribution</EvidenceLink>}
            </div>
          </div>

          {isPdfTarget && (
            <div className="mt-3 rounded-md border border-border bg-muted/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">Original PDF — page {page}{totalPages ? ` of ${totalPages}` : ''}{targetPage ? ` · cited on page ${targetPage}` : ''}</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" disabled={pdfBusy || page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</Button>
                  <Button variant="outline" disabled={pdfBusy || (totalPages > 0 && page >= totalPages)} onClick={() => setPage(p => (totalPages ? Math.min(totalPages, p + 1) : p + 1))}>Next</Button>
                  {targetPage && page !== targetPage && <Button variant="outline" onClick={() => setPage(targetPage)}>Back to cited page</Button>}
                </div>
              </div>
              <div className="mt-2 flex justify-center overflow-auto rounded border border-border bg-white">
                <canvas ref={canvasRef} className="max-w-full" aria-label={`Original PDF page ${page}`} />
              </div>
              {pdfBusy && <p className="mt-2 text-xs text-muted-foreground" role="status">Rendering the original page…</p>}
              {pdfError && <p className="mt-2 rounded-md border border-border bg-background p-2 text-xs text-muted-foreground">The original page could not be displayed here ({pdfError}). The exact cited text is shown below, and you can download the authorised original above.</p>}
            </div>
          )}

          <p className="mt-3 text-xs text-muted-foreground">The cited passage is highlighted. Surrounding passages from the same document are shown for context; extracted text only — download the original above to see full formatting.</p>
          <div className="mt-2 space-y-2">
            {context.passages.map(p => (
              <div key={p.id} className={`rounded-md border p-3 ${p.isTarget ? 'border-primary bg-secondary' : 'border-border bg-background'}`}>
                <p className="text-xs font-medium text-muted-foreground break-words">{p.locator}{p.isTarget ? ' · cited here' : ''}</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm">{p.text}</p>
              </div>
            ))}
          </div>
        </>)}
      </DialogContent>
    </Dialog>
  )
}
