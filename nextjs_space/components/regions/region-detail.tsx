'use client'

import Link from 'next/link'
import { ArrowRight, Activity, AlertCircle, Building2, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { EvidenceBadge, EvidenceLegend } from '@/components/evidence-badge'
import { FadeIn, SlideIn, Stagger, StaggerItem, HoverLift } from '@/components/ui/animate'
import { SafeDate } from '@/components/safe-format'

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/10 text-green-600 dark:text-green-400',
  monitoring: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  construction: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  planning: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
}

export function RegionDetail({ title, description, assets, events, livePictureHref }: {
  title: string; description: string; assets: any[]; events: any[]; livePictureHref?: string
}) {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8">
      <FadeIn>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight mb-2">{title ?? 'Region'}</h1>
        <p className="text-sm text-muted-foreground max-w-3xl mb-4 leading-relaxed">{description ?? ''}</p>
        {livePictureHref && (
          <div className="mb-8">
            <Link
              href={livePictureHref}
              className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
            >
              Open the regional operating picture
              <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="mt-1.5 max-w-2xl text-[12px] text-muted-foreground/80">
              An immersive, time-based view of the same evidence — replay the record and watch the map
              and chronology move together. A product concept built on the real public record.
            </p>
          </div>
        )}
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SlideIn from="bottom" delay={0.1}>
            <h2 className="font-display font-semibold text-sm mb-4">Assets Under Review</h2>
            <Stagger staggerDelay={0.06}>
              <div className="space-y-3">
                {(assets ?? [])?.map((asset: any) => (
                  <StaggerItem key={asset?.id}>
                    <HoverLift>
                      <Link href={`/asset/${asset?.slug ?? ''}`} className="block p-4 rounded-lg bg-card border border-border/50 hover:border-accent/30 transition-all group" style={{ boxShadow: 'var(--shadow-sm)' }}>
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-medium text-sm group-hover:text-accent transition-colors">{asset?.name ?? 'Unknown'}</h3>
                          <Badge variant="secondary" className={`text-[10px] ${STATUS_COLORS[asset?.status ?? 'active'] ?? ''}`}>{asset?.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{asset?.summary ?? ''}</p>
                        <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1"><Activity className="h-3 w-3" />{asset?._count?.events ?? 0} events</span>
                          <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{asset?._count?.capitalProjects ?? 0} projects</span>
                          {(asset?._count?.evidenceGaps ?? 0) > 0 && (
                            <span className="flex items-center gap-1 text-amber-500"><AlertCircle className="h-3 w-3" />{asset?._count?.evidenceGaps} gaps</span>
                          )}
                        </div>
                      </Link>
                    </HoverLift>
                  </StaggerItem>
                ))}
              </div>
            </Stagger>
          </SlideIn>
        </div>

        <div>
          <SlideIn from="bottom" delay={0.2}>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-3.5 w-3.5 text-accent" />
              <h2 className="font-display font-semibold text-sm">Recent Activity</h2>
            </div>
            <div className="space-y-2">
              {(events ?? [])?.map((event: any) => (
                <Link key={event?.id} href={`/asset/${event?.asset?.slug ?? ''}`} className="block p-3 rounded-md bg-card border border-border/50 hover:border-accent/20 transition-colors group">
                  <div className="flex items-start gap-2">
                    <EvidenceBadge classCode={event?.evidenceClass ?? 'A'} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-snug group-hover:text-accent transition-colors">{event?.title ?? ''}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground font-mono">{event?.asset?.name ?? ''}</span>
                        <span className="text-[10px] text-muted-foreground"><SafeDate date={event?.date} options={{ dateStyle: 'short' }} /></span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </SlideIn>
          <div className="mt-6">
            <EvidenceLegend />
          </div>
        </div>
      </div>
    </div>
  )
}
