'use client'

import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-white">
      <div className="mx-auto max-w-[1100px] px-4 py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-accent font-display text-[10px] font-bold text-accent-foreground">
              BV
            </span>
            <span className="font-display text-[15px] font-bold text-foreground">BioVeracity</span>
          </div>
          <div className="flex items-center gap-5 text-[15px]">
            <Link href="/search" className="text-muted-foreground hover:text-foreground">Search</Link>
            <Link href="/institutional" className="text-muted-foreground hover:text-foreground">Institutional access</Link>
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground">Privacy</Link>
            <Link href="/contact" className="text-muted-foreground hover:text-foreground">Contact</Link>
          </div>
        </div>
        <p className="mt-6 border-t border-border pt-5 text-[13px] leading-relaxed text-muted-foreground">
          BioVeracity is an independent evidence platform. It is not affiliated with, endorsed by, or operated on behalf of any regulator, government department, or infrastructure operator. All intelligence is derived from publicly available sources, planning records, regulatory publications, operator disclosures, community reports, and media.
        </p>
      </div>
    </footer>
  )
}
