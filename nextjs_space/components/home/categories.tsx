'use client'

import Link from 'next/link'
import { Anchor, Droplets, Factory, Building2, Shield, MapPin } from 'lucide-react'
import { FadeIn, Stagger, StaggerItem, HoverLift } from '@/components/ui/animate'

const CATEGORIES = [
  { icon: Anchor, label: 'Ports', href: '/assets?type=port', description: 'Dredging, reclamation, marine effects' },
  { icon: Droplets, label: 'Water & Rivers', href: '/assets?type=river', description: 'Quality, flow, catchment evidence' },
  { icon: Factory, label: 'Wastewater', href: '/assets?type=wastewater', description: 'Treatment, overflow, odour, capacity' },
  { icon: Building2, label: 'Industrial', href: '/assets?type=industrial', description: 'Permits, emissions, attribution' },
  { icon: Shield, label: 'Regulation', href: '/assets?type=regulation', description: 'Enforcement, compliance, consent' },
  { icon: MapPin, label: 'Regions', href: '/regions', description: 'Ireland, England, Scotland, NI' },
]

export function HomeCategories() {
  return (
    <section className="border-b border-border/40">
      <div className="mx-auto max-w-[1200px] px-4 py-12">
        <FadeIn>
          <h2 className="font-display text-lg font-semibold tracking-tight mb-6">Evidence by Sector</h2>
        </FadeIn>
        <Stagger staggerDelay={0.05}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {CATEGORIES?.map((cat: any) => (
              <StaggerItem key={cat?.label}>
                <HoverLift>
                  <Link href={cat?.href} className="block p-4 rounded-lg bg-card border border-border/50 hover:border-accent/50 transition-all text-center group" style={{ boxShadow: 'var(--shadow-sm)' }}>
                    <cat.icon className="h-5 w-5 mx-auto mb-2 text-muted-foreground group-hover:text-accent transition-colors" />
                    <p className="text-sm font-medium">{cat?.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{cat?.description}</p>
                  </Link>
                </HoverLift>
              </StaggerItem>
            ))}
          </div>
        </Stagger>
      </div>
    </section>
  )
}
