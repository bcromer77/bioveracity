'use client'

import { useState } from 'react'
import Link from 'next/link'
import { 
  Activity, Shield, FileText, Building2, Landmark, BarChart3, Users, Newspaper, AlertCircle, 
  FolderOpen, Search, Eye, AlertTriangle, Clock, ArrowRight, ExternalLink, ChevronDown, ChevronUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EvidenceBadge, EvidenceLegend } from '@/components/evidence-badge'
import { FadeIn, SlideIn, Stagger, StaggerItem } from '@/components/ui/animate'
import { SafeDate } from '@/components/safe-format'
import { formatEventDate } from '@/lib/format-date'
import { WatchAssetDialog } from '@/components/asset/watch-dialog'
import { ASK_ENABLED } from '@/lib/features'

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  monitoring: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  construction: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  planning: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-500',
  high: 'bg-orange-500/10 text-orange-500',
  medium: 'bg-amber-500/10 text-amber-500',
  low: 'bg-blue-500/10 text-blue-500',
  info: 'bg-gray-500/10 text-gray-500',
}

interface Section {
  id: string
  label: string
  icon: any
}

const SECTIONS: Section[] = [
  { id: 'status', label: 'Current Status', icon: Activity },
  { id: 'timeline', label: 'What Changed', icon: Clock },
  { id: 'regulatory', label: 'Regulatory Activity', icon: Shield },
  { id: 'authorisations', label: 'Authorisations', icon: Landmark },
  { id: 'projects', label: 'Capital Projects', icon: Building2 },
  { id: 'monitoring', label: 'Environmental Monitoring', icon: BarChart3 },
  { id: 'community', label: 'Community Context', icon: Users },
  { id: 'news', label: 'Recent Sources', icon: Newspaper },
  { id: 'gaps', label: 'Open Evidence Gaps', icon: AlertCircle },
]

export function AssetDetail({ asset }: { asset: any }) {
  const [activeSection, setActiveSection] = useState('status')
  const [watchOpen, setWatchOpen] = useState(false)

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6">
      {/* Header */}
      <FadeIn>
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-mono text-muted-foreground uppercase">{asset?.type ?? ''}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-[10px] font-mono text-muted-foreground">{asset?.jurisdiction ?? asset?.region ?? ''}</span>
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight mb-2">{asset?.name ?? 'Unknown Asset'}</h1>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Badge variant="outline" className={STATUS_COLORS[asset?.status ?? 'active'] ?? ''}>
              {asset?.status ?? 'active'}
            </Badge>
            {asset?.operatorName && (
              <span className="text-xs text-muted-foreground">Operator: {asset?.operatorName}</span>
            )}
            {asset?.regulatorName && (
              <span className="text-xs text-muted-foreground">Regulator: {asset?.regulatorName}</span>
            )}
          </div>
          {asset?.statusDetail && (
            <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">{asset?.statusDetail}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-4">
            {ASK_ENABLED && (
              <Link href={`/ask?q=What is the current status of ${asset?.name ?? ''}`}>
                <Button size="sm" className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90 text-xs">
                  <Search className="h-3.5 w-3.5" />
                  Ask About This Asset
                </Button>
              </Link>
            )}
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setWatchOpen(true)}>
              <Eye className="h-3.5 w-3.5" />
              Watch This Asset
            </Button>
            <Link href={`/lead?asset=${asset?.slug ?? ''}`}>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <AlertTriangle className="h-3.5 w-3.5" />
                Bring Us A Problem
              </Button>
            </Link>
          </div>
        </div>
      </FadeIn>

      {/* Section Nav */}
      <div className="flex flex-wrap gap-1 mb-6 p-1 rounded-lg bg-secondary/30">
        {SECTIONS?.map((section: Section) => (
          <button
            key={section?.id}
            onClick={() => setActiveSection(section?.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all ${
              activeSection === section?.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <section.icon className="h-3 w-3" />
            <span className="hidden md:inline">{section?.label}</span>
          </button>
        ))}
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {activeSection === 'status' && (
          <SlideIn from="bottom">
            <div className="p-5 rounded-lg bg-card border border-border/50" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <h2 className="font-display font-semibold text-sm mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-accent" /> Current Status
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{asset?.description ?? asset?.summary ?? 'No detailed status information available.'}</p>
              {asset?.summary && asset?.description && (
                <div className="mt-4 p-3 rounded bg-secondary/30">
                  <p className="text-xs text-muted-foreground">{asset?.summary}</p>
                </div>
              )}
            </div>
          </SlideIn>
        )}

        {activeSection === 'timeline' && (
          <SlideIn from="bottom">
            <div className="p-5 rounded-lg bg-card border border-border/50" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <h2 className="font-display font-semibold text-sm mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-accent" /> What Changed
              </h2>
              <div className="space-y-3">
                {(asset?.events ?? [])?.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No events recorded.</p>
                ) : (
                  (asset?.events ?? [])?.map((event: any) => (
                    <div key={event?.id} className="flex gap-3 p-3 rounded-md bg-secondary/20 hover:bg-secondary/40 transition-colors">
                      <div className="flex flex-col items-center">
                        <EvidenceBadge classCode={event?.evidenceClass ?? 'A'} />
                        {event?.severity && (
                          <Badge variant="secondary" className={`text-[9px] mt-1 ${SEVERITY_COLORS[event?.severity ?? 'info'] ?? ''}`}>
                            {event?.severity}
                          </Badge>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{event?.title ?? 'Untitled'}</p>
                        {event?.description && <p className="text-xs text-muted-foreground mt-1">{event?.description}</p>}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] text-muted-foreground font-mono" suppressHydrationWarning>
                            {formatEventDate(event?.date, event?.datePrecision)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{event?.eventType ?? ''}</span>
                          {event?.sourceUrl && (
                            <a href={event?.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent hover:underline flex items-center gap-0.5">
                              Source <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </SlideIn>
        )}

        {activeSection === 'regulatory' && (
          <SlideIn from="bottom">
            <div className="p-5 rounded-lg bg-card border border-border/50" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <h2 className="font-display font-semibold text-sm mb-4 flex items-center gap-2">
                <Shield className="h-4 w-4 text-accent" /> Regulatory Activity
              </h2>
              {(asset?.regulatoryItems ?? [])?.length === 0 ? (
                <p className="text-xs text-muted-foreground">No regulatory activity recorded.</p>
              ) : (
                <div className="space-y-3">
                  {(asset?.regulatoryItems ?? [])?.map((item: any) => (
                    <div key={item?.id} className="p-3 rounded-md bg-secondary/20">
                      <div className="flex items-start gap-2">
                        <EvidenceBadge classCode={item?.evidenceClass ?? 'R'} />
                        <div>
                          <p className="text-sm font-medium">{item?.title ?? 'Untitled'}</p>
                          {item?.description && <p className="text-xs text-muted-foreground mt-1">{item?.description}</p>}
                          <div className="flex items-center gap-2 mt-1">
                            {item?.regulator && <span className="text-[10px] text-muted-foreground">{item?.regulator}</span>}
                            {item?.date && <span className="text-[10px] text-muted-foreground font-mono"><SafeDate date={item?.date} options={{ dateStyle: 'medium' }} /></span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SlideIn>
        )}

        {activeSection === 'authorisations' && (
          <SlideIn from="bottom">
            <div className="p-5 rounded-lg bg-card border border-border/50" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <h2 className="font-display font-semibold text-sm mb-4 flex items-center gap-2">
                <Landmark className="h-4 w-4 text-accent" /> Authorisations
              </h2>
              {(asset?.authorisations ?? [])?.length === 0 ? (
                <p className="text-xs text-muted-foreground">No authorisations recorded.</p>
              ) : (
                <div className="space-y-3">
                  {(asset?.authorisations ?? [])?.map((auth: any) => (
                    <div key={auth?.id} className="p-3 rounded-md bg-secondary/20">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <EvidenceBadge classCode={auth?.evidenceClass ?? 'R'} />
                            {auth?.permitRef && <span className="text-xs font-mono">{auth?.permitRef}</span>}
                          </div>
                          <p className="text-sm font-medium mt-1">{auth?.description ?? auth?.type ?? 'Unknown'}</p>
                          {auth?.authority && <p className="text-xs text-muted-foreground mt-1">{auth?.authority}</p>}
                        </div>
                        <Badge variant="outline" className="text-[10px]">{auth?.status ?? 'active'}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SlideIn>
        )}

        {activeSection === 'projects' && (
          <SlideIn from="bottom">
            <div className="p-5 rounded-lg bg-card border border-border/50" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <h2 className="font-display font-semibold text-sm mb-4 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-accent" /> Capital Projects
              </h2>
              {(asset?.capitalProjects ?? [])?.length === 0 ? (
                <p className="text-xs text-muted-foreground">No capital projects recorded.</p>
              ) : (
                <div className="space-y-3">
                  {(asset?.capitalProjects ?? [])?.map((project: any) => (
                    <div key={project?.id} className="p-3 rounded-md bg-secondary/20">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium">{project?.name ?? 'Untitled'}</p>
                          {project?.description && <p className="text-xs text-muted-foreground mt-1">{project?.description}</p>}
                          {project?.value && <p className="text-xs font-mono text-accent mt-1">{project?.value}</p>}
                          {project?.proofRequired && (
                            <p className="text-xs text-muted-foreground mt-2">
                              <span className="font-medium">Proof required:</span> {project?.proofRequired}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-[10px]">{project?.status ?? 'planned'}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SlideIn>
        )}

        {activeSection === 'monitoring' && (
          <SlideIn from="bottom">
            <div className="p-5 rounded-lg bg-card border border-border/50" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <h2 className="font-display font-semibold text-sm mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-accent" /> Environmental Monitoring
              </h2>
              {(asset?.measurements ?? [])?.length === 0 ? (
                <p className="text-xs text-muted-foreground">No measurement data available. This may represent an evidence gap.</p>
              ) : (
                <div className="space-y-2">
                  {(asset?.measurements ?? [])?.map((m: any) => (
                    <div key={m?.id} className="flex items-center justify-between p-2 rounded bg-secondary/20">
                      <div className="flex items-center gap-2">
                        <EvidenceBadge classCode={m?.evidenceClass ?? 'R'} />
                        <span className="text-xs font-medium">{m?.parameter ?? ''}</span>
                        {m?.station && <span className="text-[10px] text-muted-foreground">{m?.station}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono">{m?.value ?? ''} {m?.unit ?? ''}</span>
                        <span className="text-[10px] text-muted-foreground"><SafeDate date={m?.date} options={{ dateStyle: 'short' }} /></span>
                        {!m?.validated && <Badge variant="outline" className="text-[9px]">non-validated</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SlideIn>
        )}

        {activeSection === 'community' && (
          <SlideIn from="bottom">
            <div className="p-5 rounded-lg bg-card border border-border/50" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <h2 className="font-display font-semibold text-sm mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 text-accent" /> Community Context
              </h2>
              {(asset?.communityItems ?? [])?.length === 0 ? (
                <p className="text-xs text-muted-foreground">No community reports recorded.</p>
              ) : (
                <div className="space-y-3">
                  {(asset?.communityItems ?? [])?.map((item: any) => (
                    <div key={item?.id} className="p-3 rounded-md bg-secondary/20">
                      <div className="flex items-start gap-2">
                        <EvidenceBadge classCode={item?.evidenceClass ?? 'C'} />
                        <div>
                          <p className="text-sm font-medium">{item?.title ?? 'Untitled'}</p>
                          {item?.description && <p className="text-xs text-muted-foreground mt-1">{item?.description}</p>}
                          <div className="flex items-center gap-2 mt-1">
                            {item?.reportedBy && <span className="text-[10px] text-muted-foreground">{item?.reportedBy}</span>}
                            {item?.date && <span className="text-[10px] text-muted-foreground font-mono"><SafeDate date={item?.date} options={{ dateStyle: 'medium' }} /></span>}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1 italic">Community reports are evidence of concern, not proof of violation.</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SlideIn>
        )}

        {activeSection === 'news' && (
          <SlideIn from="bottom">
            <div className="p-5 rounded-lg bg-card border border-border/50" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <h2 className="font-display font-semibold text-sm mb-4 flex items-center gap-2">
                <Newspaper className="h-4 w-4 text-accent" /> Recent Sources
              </h2>
              {(asset?.newsItems ?? [])?.length === 0 ? (
                <p className="text-xs text-muted-foreground">No recent news items.</p>
              ) : (
                <div className="space-y-2">
                  {(asset?.newsItems ?? [])?.map((item: any) => (
                    <div key={item?.id} className="p-3 rounded-md bg-secondary/20 hover:bg-secondary/40 transition-colors">
                      <p className="text-sm font-medium">{item?.title ?? 'Untitled'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <EvidenceBadge classCode={item?.evidenceClass ?? 'M'} />
                        <span className="text-[10px] text-muted-foreground font-mono">{item?.sourceDomain ?? ''}</span>
                        <span className="text-[10px] text-muted-foreground"><SafeDate date={item?.date} options={{ dateStyle: 'medium' }} /></span>
                        {item?.sourceUrl && (
                          <a href={item?.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent hover:underline flex items-center gap-0.5">
                            Source <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SlideIn>
        )}

        {activeSection === 'gaps' && (
          <SlideIn from="bottom">
            <div className="p-5 rounded-lg bg-card border border-border/50" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <h2 className="font-display font-semibold text-sm mb-4 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" /> Open Evidence Gaps
              </h2>
              {(asset?.evidenceGaps ?? [])?.length === 0 ? (
                <p className="text-xs text-muted-foreground">No open evidence gaps identified.</p>
              ) : (
                <div className="space-y-3">
                  {(asset?.evidenceGaps ?? [])?.map((gap: any) => (
                    <div key={gap?.id} className="p-3 rounded-md bg-amber-500/5 border border-amber-500/10">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{gap?.description ?? 'Unspecified gap'}</p>
                          {gap?.consequence && (
                            <p className="text-xs text-muted-foreground mt-1">
                              <span className="font-medium">Decision consequence:</span> {gap?.consequence}
                            </p>
                          )}
                          {gap?.dataRequired && (
                            <p className="text-xs text-muted-foreground mt-1">
                              <span className="font-medium">Data required:</span> {gap?.dataRequired}
                            </p>
                          )}
                          <Badge variant="outline" className="text-[9px] mt-2">{gap?.priority ?? 'medium'} priority</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SlideIn>
        )}
      </div>

      <div className="mt-6">
        <EvidenceLegend />
      </div>

      <WatchAssetDialog open={watchOpen} onOpenChange={setWatchOpen} assetId={asset?.id ?? ''} assetName={asset?.name ?? ''} />
    </div>
  )
}
