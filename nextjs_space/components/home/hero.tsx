'use client'

import Link from 'next/link'
import { Search, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ASK_ENABLED } from '@/lib/features'
import { FadeIn, SlideIn } from '@/components/ui/animate'

export function HomeHero() {
  return (
    <section className="relative overflow-hidden border-b border-border/40">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-secondary/30" />
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 30 Q15 25 30 30 Q45 35 60 30\' fill=\'none\' stroke=\'%23888\' stroke-width=\'0.5\' /%3E%3C/svg%3E")', backgroundSize: '60px 60px' }} />
      <div className="relative mx-auto max-w-[1200px] px-4 py-16 md:py-24">
        <FadeIn>
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-muted-foreground mb-4">Environmental Evidence Intelligence</p>
        </FadeIn>
        <SlideIn from="bottom" delay={0.1}>
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] mb-4">
            <span className="block">What happened?</span>
            <span className="block text-muted-foreground/60 mt-1">There should only be</span>
            <span className="block">one <span className="text-accent">answer</span>.</span>
          </h1>
        </SlideIn>
        <SlideIn from="bottom" delay={0.2}>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mt-6 leading-relaxed">
            Physical measurements, operations, weather, regulatory records, planning, human experience, and management action—on one clock.
          </p>
        </SlideIn>
        <SlideIn from="bottom" delay={0.3}>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link href={ASK_ENABLED ? '/ask' : '/search'}>
              <Button size="lg" className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 font-medium">
                <Search className="h-4 w-4" />
                {ASK_ENABLED ? 'Ask BioVeracity' : 'Search the evidence'}
              </Button>
            </Link>
            <Link href="/lead">
              <Button size="lg" variant="outline" className="gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                Bring Us A Live Problem
              </Button>
            </Link>
          </div>
        </SlideIn>
      </div>
    </section>
  )
}
