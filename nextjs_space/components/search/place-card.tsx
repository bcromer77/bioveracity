import Link from 'next/link'
import { MapPin, GitBranch, AlertCircle } from 'lucide-react'
import { SafeDate } from '@/components/safe-format'
import { EvidenceBadge } from '@/components/evidence-badge'
import type { PlaceResult } from '@/lib/search'

const TYPE_LABELS: Record<string, string> = {
  port: 'Port',
  wastewater: 'Wastewater',
  river: 'River',
  lake: 'Lake / Catchment',
  industrial: 'Industrial',
}

const CHANGE_LABEL: Record<string, string> = {
  divergence: 'Divergence',
  material_change: 'Material change',
  corroboration: 'Corroboration',
  gap: 'Not yet found',
  event: 'Latest',
}

export function PlaceCard({ place }: { place: PlaceResult }) {
  const isDivergence = place.lastChange?.changeType === 'divergence'
  return (
    <Link
      href={`/asset/${place.slug}`}
      className="group block rounded-lg border border-border bg-white p-5 transition-colors hover:border-foreground/30"
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
        <span className="rounded bg-secondary px-1.5 py-0.5 text-[12px] uppercase tracking-wide">
          {TYPE_LABELS[place.type] ?? place.type}
        </span>
        <span>{place.region}</span>
        <span className="capitalize">· {place.status}</span>
      </div>

      <h3 className="flex items-center gap-1.5 font-display text-xl font-bold leading-tight text-foreground group-hover:underline group-hover:underline-offset-2">
        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
        {place.name}
      </h3>

      {place.summary && (
        <p className="mt-2 line-clamp-2 text-[15px] text-muted-foreground">{place.summary}</p>
      )}

      {place.lastChange && (
        <div className={`mt-3 rounded-lg border p-3 ${isDivergence ? 'border-destructive/30 bg-destructive/[0.04]' : 'border-border bg-secondary/40'}`}>
          <div className={`mb-1 text-[13px] font-semibold uppercase tracking-wide ${isDivergence ? 'text-destructive' : 'text-muted-foreground'}`}>
            {isDivergence ? 'The evidence starts to differ here' : 'Last meaningful change'}
            {!isDivergence && <span className="font-normal"> · {CHANGE_LABEL[place.lastChange.changeType] ?? 'Latest'}</span>}
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5"><EvidenceBadge classCode={place.lastChange.evidenceClass} /></span>
            <div className="min-w-0">
              <p className="text-[15px] font-medium leading-snug text-foreground">{place.lastChange.title}</p>
              <p className="text-[13px] text-muted-foreground">
                <SafeDate date={place.lastChange.date} options={{ dateStyle: 'long' }} />
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-4 text-[13px] text-muted-foreground">
        <span>{place.eventCount} events</span>
        {place.divergenceCount > 0 && (
          <span className="flex items-center gap-1 text-destructive">
            <GitBranch className="h-3.5 w-3.5" /> {place.divergenceCount} evidence difference{place.divergenceCount > 1 ? 's' : ''}
          </span>
        )}
        {place.gapCount > 0 && (
          <span className="flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" /> {place.gapCount} open question{place.gapCount > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </Link>
  )
}
