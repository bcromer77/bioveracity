'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Activity, AlertCircle, Building2, Filter } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { HoverLift, Stagger, StaggerItem } from '@/components/ui/animate'

const TYPES = ['all', 'port', 'wastewater', 'lake', 'industrial']
const TYPE_LABELS: Record<string, string> = { all: 'All', port: 'Ports', wastewater: 'Wastewater', lake: 'Lakes & Rivers', industrial: 'Industrial' }
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/10 text-green-600 dark:text-green-400',
  monitoring: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  construction: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  planning: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
}

export function AssetsGrid({ assets }: { assets: any[] }) {
  const [filter, setFilter] = useState('all')
  const filtered = filter === 'all' ? (assets ?? []) : (assets ?? [])?.filter((a: any) => a?.type === filter)

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        {TYPES?.map((t: string) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1 rounded-full text-xs transition-colors ${filter === t ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
          >
            {TYPE_LABELS[t] ?? t}
          </button>
        ))}
      </div>
      <Stagger staggerDelay={0.04}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered?.map((asset: any) => (
            <StaggerItem key={asset?.id}>
              <HoverLift>
                <Link href={`/asset/${asset?.slug ?? ''}`} className="block p-4 rounded-lg bg-card border border-border/50 hover:border-accent/30 transition-all group" style={{ boxShadow: 'var(--shadow-sm)' }}>
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{asset?.type ?? ''} · {asset?.region ?? ''}</span>
                    <Badge variant="secondary" className={`text-[10px] ${STATUS_COLORS[asset?.status ?? 'active'] ?? ''}`}>{asset?.status}</Badge>
                  </div>
                  <h3 className="font-medium text-sm group-hover:text-accent transition-colors">{asset?.name ?? 'Unknown'}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{asset?.summary ?? ''}</p>
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
    </div>
  )
}
