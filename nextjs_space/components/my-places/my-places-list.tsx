'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Eye, MapPin, AlertTriangle, Pencil, X, Loader2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { SafeDate } from '@/components/safe-format'
import { getEvidenceDisplay } from '@/lib/evidence-taxonomy'
import { toast } from 'sonner'

interface PlaceItem {
  watchlistId: string
  assetId: string
  slug: string
  name: string
  type: string
  region: string
  status: string
  reason: string | null
  gapCount: number
  divergenceCount: number
  lastChange: { title: string; date: string; changeType: string; evidenceClass: string } | null
}

function changeLabel(t: string) {
  if (t === 'divergence') return 'Evidence divergence'
  if (t === 'material_change') return 'Material change'
  if (t === 'gap') return 'Evidence gap'
  return 'Update'
}

export function MyPlacesList({ initialPlaces }: { initialPlaces: PlaceItem[] }) {
  const [places, setPlaces] = useState<PlaceItem[]>(initialPlaces ?? [])
  const [editing, setEditing] = useState<PlaceItem | null>(null)
  const [reasonDraft, setReasonDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const openEdit = (p: PlaceItem) => {
    setEditing(p)
    setReasonDraft(p?.reason ?? '')
  }

  const saveReason = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch('/api/watchlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: editing.assetId, reason: reasonDraft }),
      })
      if (res?.ok) {
        setPlaces((prev) => prev.map((x) => (x.assetId === editing.assetId ? { ...x, reason: reasonDraft } : x)))
        toast.success('Updated why this place matters to you.')
        setEditing(null)
      } else {
        toast.error('Could not save. Please try again.')
      }
    } catch {
      toast.error('An error occurred.')
    } finally {
      setSaving(false)
    }
  }

  const unfollow = async (p: PlaceItem) => {
    setRemovingId(p.assetId)
    try {
      const res = await fetch(`/api/watchlist?assetId=${encodeURIComponent(p.assetId)}`, { method: 'DELETE' })
      if (res?.ok) {
        setPlaces((prev) => prev.filter((x) => x.assetId !== p.assetId))
        toast.success(`Stopped following ${p.name}.`)
      } else {
        toast.error('Could not update. Please try again.')
      }
    } catch {
      toast.error('An error occurred.')
    } finally {
      setRemovingId(null)
    }
  }

  if (!places?.length) {
    return (
      <div className="rounded-lg border border-border/60 bg-card/40 px-6 py-16 text-center">
        <Eye className="h-10 w-10 text-muted-foreground/60 mx-auto mb-4" />
        <h2 className="font-display text-lg font-bold mb-2">You are not following any places yet</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
          Search for a place, river, port or organisation, open it, and choose Follow. It will then appear here.
        </p>
        <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Link href="/search">Start a search <ArrowRight className="h-4 w-4 ml-2" /></Link>
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {places.map((p) => {
          const ev = p.lastChange ? getEvidenceDisplay(p.lastChange.evidenceClass) : null
          return (
            <div key={p.watchlistId} className="rounded-lg border border-border/60 bg-card/40 p-5 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/asset/${p.slug}`} className="font-display font-bold text-lg text-foreground hover:text-[hsl(var(--link))] transition-colors block truncate">
                    {p.name}
                  </Link>
                  <div className="flex items-center gap-2 text-[13px] text-muted-foreground mt-1">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="truncate">{p.region}</span>
                  </div>
                </div>
                <button
                  onClick={() => unfollow(p)}
                  disabled={removingId === p.assetId}
                  aria-label={`Stop following ${p.name}`}
                  className="text-muted-foreground/70 hover:text-destructive transition-colors shrink-0"
                >
                  {removingId === p.assetId ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                </button>
              </div>

              {(p.divergenceCount > 0 || p.gapCount > 0) && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {p.divergenceCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-2.5 py-1 text-xs font-semibold">
                      <AlertTriangle className="h-3.5 w-3.5" /> {p.divergenceCount} divergence{p.divergenceCount > 1 ? 's' : ''}
                    </span>
                  )}
                  {p.gapCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      □ {p.gapCount} evidence gap{p.gapCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}

              <div className="mt-3 rounded-md border border-border/50 bg-background/40 px-3 py-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1 font-medium">Last meaningful change</div>
                {p.lastChange ? (
                  <div>
                    <div className="flex items-center gap-2 text-[13px] text-muted-foreground mb-1">
                      <span>{changeLabel(p.lastChange.changeType)}</span>
                      <span>·</span>
                      <SafeDate date={p.lastChange.date} options={{ dateStyle: 'medium' }} />
                      {ev && <span className="ml-auto" title={ev.label}>{ev.symbol}</span>}
                    </div>
                    <div className="text-[15px] leading-snug text-foreground">{p.lastChange.title}</div>
                  </div>
                ) : (
                  <div className="text-[15px] text-muted-foreground">No recorded change yet.</div>
                )}
              </div>

              <div className="mt-3 flex-1">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Why this place matters to you</div>
                  <button onClick={() => openEdit(p)} className="text-muted-foreground/70 hover:text-foreground transition-colors" aria-label="Edit reason">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
                {p.reason ? (
                  <p className="text-[15px] text-foreground/90 italic">“{p.reason}”</p>
                ) : (
                  <button onClick={() => openEdit(p)} className="text-[15px] text-[hsl(var(--link))] hover:decoration-2 underline underline-offset-2">
                    Add a note (optional)
                  </button>
                )}
              </div>

              <div className="mt-4">
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href={`/asset/${p.slug}`}>Open place <ArrowRight className="h-3 w-3 ml-1" /></Link>
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Why does this place matter to you?</DialogTitle>
            <DialogDescription>
              Optional. This is only visible to you and helps you remember why you are following {editing?.name}.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reasonDraft}
            onChange={(e) => setReasonDraft(e?.target?.value ?? '')}
            rows={4}
            placeholder="e.g. I live nearby and want to know when the evidence changes."
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveReason} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
