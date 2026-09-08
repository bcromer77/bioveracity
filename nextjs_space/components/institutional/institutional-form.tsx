'use client'

import { useState } from 'react'
import { Building2, Loader2, CheckCircle2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function InstitutionalForm() {
  const [form, setForm] = useState({
    name: '', email: '', organisation: '', role: '',
    orgType: '', assetName: '', need: '', scale: '',
  })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const update = (field: string, value: string) => setForm((prev: any) => ({ ...(prev ?? {}), [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e?.preventDefault?.()
    if (!form?.name || !form?.email || !form?.need) return
    setLoading(true)
    try {
      // Reuse the Lead intake. Institutional context is folded into existing fields.
      const issue = `[INSTITUTIONAL ACCESS REQUEST]\n\nWhat they need to establish:\n${form.need}`
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          organisation: form.organisation,
          role: [form.orgType, form.role].filter(Boolean).join(' — '),
          assetName: form.assetName,
          issue,
          decisionMatters: form.scale,
        }),
      })
      if (res?.ok) {
        setSubmitted(true)
        toast.success('Your request has been received.')
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
      <div className="mx-auto max-w-[600px] px-4 py-20 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
        <h2 className="font-display text-xl font-bold mb-2">Request received</h2>
        <p className="text-sm text-muted-foreground">
          We will review what you need to establish and respond with an honest assessment of what the evidence
          can and cannot support, and how access would work at your scale.
        </p>
      </div>
    )
  }

  const input = 'w-full px-3 py-2 rounded-md border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-accent/50'

  return (
    <div className="mx-auto max-w-[640px] px-4 py-12">
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="h-5 w-5 text-accent" />
        <h2 className="font-display text-2xl font-bold tracking-tight">Request institutional access</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Tell us who you are and what you need to establish. There is no obligation and we do not publish pricing.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="text-xs font-medium mb-1 block">Name *</label><input type="text" value={form.name} onChange={(e: any) => update('name', e?.target?.value ?? '')} required className={input} /></div>
          <div><label className="text-xs font-medium mb-1 block">Work email *</label><input type="email" value={form.email} onChange={(e: any) => update('email', e?.target?.value ?? '')} required className={input} /></div>
          <div><label className="text-xs font-medium mb-1 block">Organisation</label><input type="text" value={form.organisation} onChange={(e: any) => update('organisation', e?.target?.value ?? '')} className={input} /></div>
          <div><label className="text-xs font-medium mb-1 block">Your role</label><input type="text" value={form.role} onChange={(e: any) => update('role', e?.target?.value ?? '')} className={input} /></div>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block">Type of organisation</label>
          <select value={form.orgType} onChange={(e: any) => update('orgType', e?.target?.value ?? '')} className={input}>
            <option value="">Select…</option>
            <option>Regulator or public body</option>
            <option>Infrastructure operator</option>
            <option>Legal or expert witness</option>
            <option>Insurer or risk</option>
            <option>Community group or NGO</option>
            <option>Academic or research</option>
            <option>Other</option>
          </select>
        </div>
        <div><label className="text-xs font-medium mb-1 block">Places or region of interest</label><input type="text" value={form.assetName} onChange={(e: any) => update('assetName', e?.target?.value ?? '')} placeholder="e.g. Lough Neagh, Irish ports, Cambridgeshire wastewater" className={input} /></div>
        <div><label className="text-xs font-medium mb-1 block">What do you need to establish? *</label><textarea value={form.need} onChange={(e: any) => update('need', e?.target?.value ?? '')} required rows={4} placeholder="The question, decision, or case the evidence needs to support." className={`${input} resize-none`} /></div>
        <div><label className="text-xs font-medium mb-1 block">Scale</label><input type="text" value={form.scale} onChange={(e: any) => update('scale', e?.target?.value ?? '')} placeholder="e.g. one case, a portfolio of sites, ongoing monitoring" className={input} /></div>
        <Button type="submit" disabled={loading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-2" />Request access</>}
        </Button>
        <p className="text-[10px] text-muted-foreground text-center">
          BioVeracity is an independent evidence platform, not affiliated with any regulator or operator. Your request is stored securely and reviewed by the evidence team.
        </p>
      </form>
    </div>
  )
}
