'use client'

import { Shield, Database, FileText, Users, Cloud, Radio } from 'lucide-react'
import { EvidenceLegend } from '@/components/evidence-badge'
import { FadeIn } from '@/components/ui/animate'

const SOURCES = [
  { icon: Shield, label: 'Regulator publications' },
  { icon: FileText, label: 'Planning records' },
  { icon: Database, label: 'Operator disclosures' },
  { icon: Users, label: 'Community reports' },
  { icon: Cloud, label: 'Weather & hydrology' },
  { icon: Radio, label: 'Media coverage' },
]

export function HomeTrust() {
  return (
    <section className="bg-card/30">
      <div className="mx-auto max-w-[1200px] px-4 py-12">
        <FadeIn>
          <p className="font-mono text-xs tracking-[0.2em] uppercase text-muted-foreground mb-2">Evidence Standard</p>
          <h2 className="font-display text-xl font-bold tracking-tight mb-4">Built from primary evidence</h2>
          <p className="text-sm text-muted-foreground max-w-2xl mb-6 leading-relaxed">
            Every claim on this platform is linked to its source and classified by evidence type. Operator statements never overwrite regulator findings. Community reports are preserved with provenance but not promoted to confirmed incidents without corroboration.
          </p>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="flex flex-wrap gap-4 mb-6">
            {SOURCES?.map((src: any) => (
              <div key={src?.label} className="flex items-center gap-2 text-xs text-muted-foreground">
                <src.icon className="h-3.5 w-3.5" />
                <span>{src?.label}</span>
              </div>
            ))}
          </div>
        </FadeIn>
        <FadeIn delay={0.2}>
          <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
            <p className="text-[10px] text-muted-foreground mb-3">Evidence Classification</p>
            <EvidenceLegend />
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
