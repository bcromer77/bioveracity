'use client'

import { useState } from 'react'
import { AlertTriangle, Loader2, CheckCircle2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FadeIn, SlideIn } from '@/components/ui/animate'
import { toast } from 'sonner'

export function LeadForm() {
  const [form, setForm] = useState({
    name: '', email: '', organisation: '', role: '',
    assetName: '', issue: '', disputed: '', decisionMatters: '', orgsInvolved: '',
  })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const update = (field: string, value: string) => setForm((prev: any) => ({ ...(prev ?? {}), [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e?.preventDefault?.()
    if (!form?.name || !form?.email || !form?.issue) return
    setLoading(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res?.ok) {
        setSubmitted(true)
        toast.success('Your problem has been submitted.')
      } else {
        toast.error('Submission failed. Please try again.')
      }
    } catch {
      toast.error('An error occurred.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-[600px] px-4 py-16 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
        <h2 className="font-display text-xl font-bold mb-2">Problem Received</h2>
        <p className="text-sm text-muted-foreground">We will review the evidence landscape and respond with an initial assessment of what can be established and what evidence gaps exist.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[600px] px-4 py-8">
      <FadeIn>
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-5 w-5 text-accent" />
          <h1 className="font-display text-2xl font-bold tracking-tight">Bring Us A Live Problem</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Describe a contested environmental question. We will map the available evidence, identify gaps, and assess what can be defensibly established.
        </p>
      </FadeIn>
      <SlideIn from="bottom" delay={0.1}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="text-xs font-medium mb-1 block">Name *</label><input type="text" value={form?.name ?? ''} onChange={(e: any) => update('name', e?.target?.value ?? '')} required className="w-full px-3 py-2 rounded-md border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-accent/50" /></div>
            <div><label className="text-xs font-medium mb-1 block">Email *</label><input type="email" value={form?.email ?? ''} onChange={(e: any) => update('email', e?.target?.value ?? '')} required className="w-full px-3 py-2 rounded-md border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-accent/50" /></div>
            <div><label className="text-xs font-medium mb-1 block">Organisation</label><input type="text" value={form?.organisation ?? ''} onChange={(e: any) => update('organisation', e?.target?.value ?? '')} className="w-full px-3 py-2 rounded-md border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-accent/50" /></div>
            <div><label className="text-xs font-medium mb-1 block">Your role</label><input type="text" value={form?.role ?? ''} onChange={(e: any) => update('role', e?.target?.value ?? '')} className="w-full px-3 py-2 rounded-md border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-accent/50" /></div>
          </div>
          <div><label className="text-xs font-medium mb-1 block">Asset or location involved</label><input type="text" value={form?.assetName ?? ''} onChange={(e: any) => update('assetName', e?.target?.value ?? '')} placeholder="e.g. March WRC, Lough Neagh, Port of Cork" className="w-full px-3 py-2 rounded-md border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-accent/50" /></div>
          <div><label className="text-xs font-medium mb-1 block">What is the problem? *</label><textarea value={form?.issue ?? ''} onChange={(e: any) => update('issue', e?.target?.value ?? '')} required rows={3} className="w-full px-3 py-2 rounded-md border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none" /></div>
          <div><label className="text-xs font-medium mb-1 block">What is disputed?</label><textarea value={form?.disputed ?? ''} onChange={(e: any) => update('disputed', e?.target?.value ?? '')} rows={2} className="w-full px-3 py-2 rounded-md border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none" /></div>
          <div><label className="text-xs font-medium mb-1 block">What decision depends on resolving this?</label><textarea value={form?.decisionMatters ?? ''} onChange={(e: any) => update('decisionMatters', e?.target?.value ?? '')} rows={2} className="w-full px-3 py-2 rounded-md border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none" /></div>
          <div><label className="text-xs font-medium mb-1 block">Organisations involved</label><input type="text" value={form?.orgsInvolved ?? ''} onChange={(e: any) => update('orgsInvolved', e?.target?.value ?? '')} className="w-full px-3 py-2 rounded-md border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-accent/50" /></div>
          <Button type="submit" disabled={loading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-2" />Submit Problem</>}
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">Your submission is stored securely and reviewed by the BioVeracity evidence team.</p>
        </form>
      </SlideIn>
    </div>
  )
}
