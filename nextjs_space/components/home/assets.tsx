'use client'

import Link from 'next/link'
import { ArrowRight, AlertCircle, Activity } from 'lucide-react'
import { FadeIn, Stagger, StaggerItem, HoverLift } from '@/components/ui/animate'
import { Badge } from '@/components/ui/badge'

const TYPE_LABELS: Record<string, string> = {
  port: 'Port',
  wastewater: 'Wastewater',
  lake: 'Lake / Catchment',
  industrial: 'Industrial',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/10 text-green-600 dark:text-green-400',
  monitoring: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  construction: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  planning: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
}

export function HomeAssets({ assets }: { assets: any[] }) {
  return (
    <section className="border-b border-border/40 bg-card/30">
      <div className="mx-auto max-w-[1200px] px-4 py-12">
        <FadeIn>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-lg font-semibold tracking-tight">Priority Assets</h2>
            <Link href="/assets" className="text-xs text-accent hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </FadeIn>
        <Stagger staggerDelay={0.06}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(assets ?? [])?.map((asset: any) => (
              <StaggerItem key={asset?.id}>
                <HoverLift>
                  <Link href={`/asset/${asset?.slug ?? ''}`} className="block p-4 rounded-lg bg-card border border-border/50 hover:border-accent/30 transition-all group" style={{ boxShadow: 'var(--shadow-sm)' }}>
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">{TYPE_LABELS[asset?.type ?? ''] ?? asset?.type}</span>
                      <Badge variant="secondary" className={`text-[10px] ${STATUS_COLORS[asset?.status ?? 'active'] ?? ''}`}>
                        {asset?.status ?? 'active'}
                      </Badge>
                    </div>
                    <h3 className="font-medium text-sm group-hover:text-accent transition-colors">{asset?.name ?? 'Unknown'}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{asset?.summary ?? ''}</p>
                    <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        {asset?._count?.events ?? 0} events
                      </span>
                      {(asset?._count?.evidenceGaps ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-amber-500">
                          <AlertCircle className="h-3 w-3" />
                          {asset?._count?.evidenceGaps ?? 0} gaps
                        </span>
                      )}
                    </div>
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
