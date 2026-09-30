// EVIDENCE -> ORIGINAL SOURCE. Server component (no client JS). The one place
// where a public, cleared source reference becomes a real outbound link. It is
// deliberately narrow: only exact https URLs on an allowlisted publisher origin
// are navigable; everything else keeps the on-site EvidenceLink disclosure.
// No proxy, no redirect, no referrer, no opener.
import type { ReactNode } from 'react'
import { EvidenceLink } from '@/components/evidence-link'

export const ORIGINAL_SOURCE_ORIGINS: readonly string[] = ['https://www.npws.ie']

export function originalSourceHref(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048 || /[\\\u0000-\u0020\u007f]/.test(value)) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return null
    if (!ORIGINAL_SOURCE_ORIGINS.includes(url.origin)) return null
    return url.href === value ? value : null
  } catch {
    return null
  }
}

export function OriginalSourceLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const target = originalSourceHref(href)
  if (target === null) return <EvidenceLink href={href} className={className}>{children}</EvidenceLink>
  const host = new URL(target).hostname.replace(/^www\./, '')
  return (
    <a href={target} rel="external noopener noreferrer" referrerPolicy="no-referrer" className={className} data-original-source="">
      {children}<span className="sr-only"> (original source, external site {host})</span>
    </a>
  )
}
