'use client'

import Link from 'next/link'
import { Clock, ArrowRight, Newspaper } from 'lucide-react'
import { EvidenceBadge } from '@/components/evidence-badge'
import { FadeIn, Stagger, StaggerItem } from '@/components/ui/animate'
import { SafeDate } from '@/components/safe-format'

interface LiveIntelProps {
  events: any[]
  news: any[]
}

export function HomeLiveIntel({ events, news }: LiveIntelProps) {
  return (
    <section className="border-b border-border/40 bg-card/30">
      <div className="mx-auto max-w-[1200px] px-4 py-12">
        <FadeIn>
          <div className="flex items-center gap-2 mb-6">
            <Clock className="h-4 w-4 text-accent" />
            <h2 className="font-display text-lg font-semibold tracking-tight">Live Intelligence</h2>
            <span className="ml-2 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Stagger staggerDelay={0.05}>
              <div className="space-y-1">
                {(events ?? [])?.map((event: any) => (
                  <StaggerItem key={event?.id}>
                    <Link href={`/asset/${event?.asset?.slug ?? ''}`} className="group block">
                      <div className="flex items-start gap-3 p-3 rounded-md hover:bg-secondary/50 transition-colors">
                        <div className="mt-0.5">
                          <EvidenceBadge classCode={event?.evidenceClass ?? 'A'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-snug group-hover:text-accent transition-colors">{event?.title ?? 'Untitled'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground font-mono">{event?.asset?.name ?? ''}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">
                              <SafeDate date={event?.date} options={{ dateStyle: 'medium' }} />
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                      </div>
                    </Link>
                  </StaggerItem>
                ))}
              </div>
            </Stagger>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Newspaper className="h-3.5 w-3.5 text-muted-foreground" />
              <h3 className="text-sm font-medium">Recent Sources</h3>
            </div>
            <div className="space-y-2">
              {(news ?? [])?.map((item: any) => (
                <div key={item?.id} className="p-3 rounded-md bg-secondary/30 hover:bg-secondary/50 transition-colors">
                  <p className="text-xs font-medium leading-snug">{item?.title ?? 'Untitled'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <EvidenceBadge classCode={item?.evidenceClass ?? 'M'} />
                    <span className="text-[10px] text-muted-foreground font-mono">{item?.sourceDomain ?? ''}</span>
                    <span className="text-[10px] text-muted-foreground">
                      <SafeDate date={item?.date} options={{ dateStyle: 'medium' }} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
