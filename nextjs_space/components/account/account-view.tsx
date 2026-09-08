'use client'

import Link from 'next/link'
import { User, AlertTriangle } from 'lucide-react'
import { SafeDate } from '@/components/safe-format'

export function AccountView({ user, watchlists, leads }: { user: any; watchlists: any[]; leads: any[] }) {
  return (
    <div className="mx-auto max-w-[900px] px-4 py-10">
      <div className="flex items-center gap-3 mb-10">
        <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center">
          <User className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{user?.name ?? 'Account'}</h1>
          <p className="text-[15px] text-muted-foreground">{user?.email ?? ''}</p>
        </div>
      </div>

      <div className="space-y-10">
        <div>
          <h2 className="font-display font-bold text-lg text-foreground mb-4">
            Places you follow <span className="text-muted-foreground font-normal">({watchlists?.length ?? 0})</span>
          </h2>
          {(watchlists ?? [])?.length === 0 ? (
            <p className="text-[15px] text-muted-foreground">
              You are not following any places yet. <Link href="/search" className="text-[hsl(var(--link))] underline underline-offset-2 hover:decoration-2">Search for a place</Link> and choose Follow.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {(watchlists ?? [])?.map((w: any) => (
                <li key={w?.id}>
                  <Link href={`/asset/${w?.asset?.slug ?? ''}`} className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/50 transition-colors group">
                    <div>
                      <p className="text-[16px] font-semibold text-foreground group-hover:text-[hsl(var(--link))] transition-colors">{w?.asset?.name ?? 'Unknown'}</p>
                      <p className="text-[13px] text-muted-foreground mt-0.5">{w?.asset?.type ?? ''} · {w?.asset?.status ?? ''}</p>
                    </div>
                    <span className="text-[hsl(var(--link))] text-[15px]">View timeline →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="font-display font-bold text-lg text-foreground mb-4">
            Problems you submitted <span className="text-muted-foreground font-normal">({leads?.length ?? 0})</span>
          </h2>
          {(leads ?? [])?.length === 0 ? (
            <p className="text-[15px] text-muted-foreground">No problems submitted yet.</p>
          ) : (
            <ul className="space-y-3">
              {(leads ?? [])?.map((lead: any) => (
                <li key={lead?.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    <p className="text-[16px] font-semibold text-foreground">{lead?.assetName ?? 'General'}</p>
                  </div>
                  <p className="text-[15px] text-muted-foreground mt-1.5 line-clamp-2">{lead?.issue ?? ''}</p>
                  <div className="flex items-center gap-2 mt-2.5 text-[13px] text-muted-foreground">
                    <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 font-medium">{lead?.status ?? 'new'}</span>
                    <span><SafeDate date={lead?.createdAt} options={{ dateStyle: 'medium' }} /></span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
