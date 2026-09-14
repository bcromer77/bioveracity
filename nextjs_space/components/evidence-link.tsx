'use client'
import { useState, type AnchorHTMLAttributes } from 'react'
import { internalHref } from '@/lib/onsite-link.mjs'

// References expand inline, including inside paragraph text. No proxy or redirect.
export function EvidenceLink({ href, children, className, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
 const [open, setOpen] = useState(false)
 const local = internalHref(href)
 if (local !== null) return <a {...props} href={local} className={className} onClick={onClick}>{children}</a>
 if (!href) return <span className={className}>{children}</span>
 return <span className={className}>
  <button type="button" className="text-inherit text-left underline" aria-expanded={open} onClick={event => { event.stopPropagation(); setOpen(value => !value) }}>{children || 'Source attribution'}</button>
  {open && <span className="mt-2 block text-xs font-normal">Reference retained for attribution: <span className="block break-all select-all">{href}</span></span>}
 </span>
}
