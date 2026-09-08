'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Star, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { PLAIN_CATEGORIES } from '@/lib/categories'

export function FollowButton({
  assetId,
  assetName,
  isAuthed,
  isFollowing: initialFollowing,
  categories = [],
}: {
  assetId: string
  assetName: string
  isAuthed: boolean
  isFollowing: boolean
  categories?: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [following, setFollowing] = useState(initialFollowing)
  const [loading, setLoading] = useState(false)
  const [reasonOpen, setReasonOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [savingReason, setSavingReason] = useState(false)
  const [everything, setEverything] = useState(true)
  const [watched, setWatched] = useState<Record<string, boolean>>({})

  const available = PLAIN_CATEGORIES.filter((c) => categories.includes(c.id))

  const toggleCat = (id: string) => {
    setWatched((s) => {
      const next = { ...s, [id]: !s[id] }
      const anyOn = Object.values(next).some(Boolean)
      setEverything(!anyOn)
      return next
    })
  }

  const chooseEverything = () => {
    setEverything(true)
    setWatched({})
  }

  const handleClick = async () => {
    if (!isAuthed) {
      const cb = encodeURIComponent(pathname ?? '/')
      router.push(`/signup?callbackUrl=${cb}`)
      return
    }
    setLoading(true)
    try {
      if (following) {
        await fetch(`/api/watchlist?assetId=${encodeURIComponent(assetId)}`, { method: 'DELETE' })
        setFollowing(false)
      } else {
        const res = await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assetId }),
        })
        if (res.ok) {
          setFollowing(true)
          setReasonOpen(true)
        } else if (res.status === 401) {
          const cb = encodeURIComponent(pathname ?? '/')
          router.push(`/signup?callbackUrl=${cb}`)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const saveReason = async () => {
    setSavingReason(true)
    const selected = Object.keys(watched).filter((k) => watched[k])
    const alertTypes = everything || selected.length === 0 ? 'all' : selected.join(',')
    try {
      await fetch('/api/watchlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, reason: reason.trim() || null, alertTypes }),
      })
      setReasonOpen(false)
    } finally {
      setSavingReason(false)
    }
  }

  return (
    <>
      <Button
        variant={following ? 'secondary' : 'outline'}
        onClick={handleClick}
        disabled={loading}
        className="gap-1.5 text-[15px]"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : following ? (
          <Check className="h-4 w-4 text-green-700" />
        ) : (
          <Star className="h-4 w-4" />
        )}
        {following ? 'Following' : 'Follow this place'}
      </Button>

      <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>You&rsquo;re now following {assetName}</DialogTitle>
            <DialogDescription>
              You&rsquo;ll be notified when material new evidence appears here.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-[14px] font-semibold text-foreground">What should BioVeracity watch?</p>
            <label className="flex items-center gap-2 text-[14px] text-foreground">
              <input type="checkbox" checked={everything} onChange={chooseEverything} className="h-4 w-4 accent-accent" />
              Everything material
            </label>
            {available.length > 0 && (
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {available.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-[14px] text-foreground">
                    <input
                      type="checkbox"
                      checked={!!watched[c.id]}
                      onChange={() => toggleCat(c.id)}
                      className="h-4 w-4 accent-accent"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-[14px] font-semibold text-foreground">Why does this place matter to you?</p>
            <p className="text-[13px] text-muted-foreground">Optional and only visible to you — it helps shape your picture.</p>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. I fish this estuary / I live nearby / my organisation reports on this catchment"
              rows={3}
              className="text-sm"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" size="sm" onClick={() => setReasonOpen(false)} disabled={savingReason}>
              Skip
            </Button>
            <Button size="sm" onClick={saveReason} disabled={savingReason} className="bg-accent text-accent-foreground hover:bg-accent/90">
              {savingReason ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
