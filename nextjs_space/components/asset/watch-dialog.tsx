'use client'

import { useState } from 'react'
import { Eye, Loader2, CheckCircle2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function WatchAssetDialog({ open, onOpenChange, assetId, assetName }: {
  open: boolean; onOpenChange: (o: boolean) => void; assetId: string; assetName: string
}) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async () => {
    if (!email?.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, email }),
      })
      if (res?.ok) {
        setDone(true)
        toast.success('You will be notified when material changes occur.')
      } else {
        toast.error('Failed to add watch. Please try again.')
      }
    } catch {
      toast.error('An error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Watch {assetName}
          </DialogTitle>
          <DialogDescription>
            Receive alerts when material changes—regulatory activity, new evidence, or status updates—are recorded.
          </DialogDescription>
        </DialogHeader>
        {done ? (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            Added to your watchlist.
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e: any) => setEmail(e?.target?.value ?? '')}
              placeholder="your@email.com"
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <Button onClick={handleSubmit} disabled={loading || !email?.trim()} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Watch This Asset'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
