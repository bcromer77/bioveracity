'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { FileText, Loader2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { buildRecordHtml } from '@/lib/pdf-report'

export function ProducePdfButton({
  asset,
  isAuthed,
}: {
  asset: any
  isAuthed: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<'' | 'summary' | 'report'>('')
  const [error, setError] = useState('')

  const handleOpen = () => {
    if (!isAuthed) {
      const cb = encodeURIComponent(pathname ?? '/')
      router.push(`/signup?callbackUrl=${cb}`)
      return
    }
    setError('')
    setOpen(true)
  }

  const generate = async (kind: 'summary' | 'report') => {
    setBusy(kind)
    setError('')
    try {
      const html = buildRecordHtml(asset, kind)
      const createRes = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html_content: html, reportKind: kind === 'report' ? 'report' : 'summary' }),
      })
      const created = await createRes.json()
      if (!createRes.ok || !created?.success) {
        if (createRes.status === 401) {
          const cb = encodeURIComponent(pathname ?? '/')
          router.push(`/signup?callbackUrl=${cb}`)
          return
        }
        if (createRes.status === 403) {
          setError(created?.error || 'The full evidence report requires institutional access.')
          return
        }
        throw new Error(created?.error || 'Could not start the record')
      }
      const requestId = created.request_id
      const started = Date.now()
      // Poll the status route until SUCCESS/FAILED (up to ~5 minutes).
      while (Date.now() - started < 5 * 60 * 1000) {
        await new Promise((r) => setTimeout(r, 1800))
        const stRes = await fetch('/api/generate-pdf/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ request_id: requestId }),
        })
        const st = await stRes.json()
        if (st?.status === 'SUCCESS' && st?.pdf_base64) {
          downloadPdf(st.pdf_base64, `BioVeracity-${slug(asset?.name)}-${kind}.pdf`)
          setOpen(false)
          return
        }
        if (st?.status === 'FAILED') {
          throw new Error(st?.error || 'The record could not be produced')
        }
      }
      throw new Error('Timed out producing the record. Please try again.')
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong')
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      <Button onClick={handleOpen} className="gap-1.5 bg-accent text-[15px] font-semibold text-accent-foreground hover:brightness-95">
        <FileText className="h-4 w-4" />
        Produce report
      </Button>

      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Produce a defensible record</DialogTitle>
            <DialogDescription>
              A dated, source-referenced document you can cite, forward or file. Every claim carries its evidence
              classification, and gaps are shown as gaps.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <button
              onClick={() => generate('summary')}
              disabled={!!busy}
              className="flex w-full items-start gap-3 rounded-lg border border-border/60 bg-card p-4 text-left transition-colors hover:bg-secondary/30 disabled:opacity-60"
            >
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <div className="flex-1">
                <p className="text-sm font-medium">Quick Summary</p>
                <p className="text-xs text-muted-foreground">Status, last meaningful change and the headline picture on one page.</p>
              </div>
              {busy === 'summary' && <Loader2 className="h-4 w-4 animate-spin text-accent" />}
            </button>

            <button
              onClick={() => generate('report')}
              disabled={!!busy}
              className="flex w-full items-start gap-3 rounded-lg border border-border/60 bg-card p-4 text-left transition-colors hover:bg-secondary/30 disabled:opacity-60"
            >
              <Download className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <div className="flex-1">
                <p className="text-sm font-medium">Evidence Report</p>
                <p className="text-xs text-muted-foreground">
                  The full chronology, every source record, open evidence gaps and a mandatory &ldquo;Where the evidence
                  changed&rdquo; section.
                </p>
              </div>
              {busy === 'report' && <Loader2 className="h-4 w-4 animate-spin text-accent" />}
            </button>
          </div>

          {busy && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Assembling the record… this can take up to a minute.
            </p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </DialogContent>
      </Dialog>
    </>
  )
}

function slug(name?: string) {
  return (name ?? 'place').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function downloadPdf(base64: string, filename: string) {
  const blob = new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
