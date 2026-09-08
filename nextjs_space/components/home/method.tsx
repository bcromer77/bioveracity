'use client'

import { Radar, CheckCircle2, Gavel, FileCheck } from 'lucide-react'
import { FadeIn, Stagger, StaggerItem } from '@/components/ui/animate'

const STEPS = [
  { icon: Radar, title: 'Detect', description: 'Correlate physical measurements, operational records, regulatory publications, weather, and community reports into a single timeline.' },
  { icon: CheckCircle2, title: 'Verify', description: 'Classify every claim with evidence taxonomy. Distinguish regulator findings from operator assertions, media reports, and community observations.' },
  { icon: Gavel, title: 'Resolve', description: 'Map evidence gaps, test competing hypotheses, and identify what data would settle disputed questions.' },
  { icon: FileCheck, title: 'Prove', description: 'Build defensible before-and-after records that demonstrate whether capital investment or regulatory action produced its intended environmental effect.' },
]

export function HomeMethod() {
  return (
    <section className="border-b border-border/40">
      <div className="mx-auto max-w-[1200px] px-4 py-12">
        <FadeIn>
          <p className="font-mono text-xs tracking-[0.2em] uppercase text-muted-foreground mb-2">Method</p>
          <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight mb-8">Evidence, not opinion</h2>
        </FadeIn>
        <Stagger staggerDelay={0.1}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS?.map((step: any, i: number) => (
              <StaggerItem key={step?.title}>
                <div className="p-5 rounded-lg bg-card border border-border/50" style={{ boxShadow: 'var(--shadow-sm)' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-accent/10">
                      <step.icon className="h-4 w-4 text-accent" />
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <h3 className="font-display font-semibold text-sm mb-2">{step?.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step?.description}</p>
                </div>
              </StaggerItem>
            ))}
          </div>
        </Stagger>
      </div>
    </section>
  )
}
