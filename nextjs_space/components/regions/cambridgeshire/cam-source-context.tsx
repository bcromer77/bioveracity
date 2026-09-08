import Link from 'next/link'
import { CAM_CLASSIFICATION, CAM_SOURCE } from '@/lib/river-cam-baseline'

export function CamSourceContext() {
  return <section className="mx-auto my-6 max-w-7xl rounded-xl border bg-card p-5">
    <h2 className="text-lg font-semibold">Investigate the River Cam</h2>
    <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{CAM_CLASSIFICATION}</p>
    <p className="mt-2 text-xs text-muted-foreground">Source checked 8 September 2026 · This identifier covers a specific water body, not every reach of the River Cam.</p>
    <nav className="mt-4 flex flex-wrap gap-5 text-sm underline" aria-label="River Cam investigation">
      <Link href="/asset/river-cam">Place and timeline</Link>
      <Link href="/regions/cambridgeshire-peterborough/live">Explore the map</Link>
      <Link href="/evidence?q=River%20Cam">Search reviewed sources</Link>
      <a href={CAM_SOURCE} target="_blank" rel="noreferrer">Environment Agency classifications</a>
    </nav>
  </section>
}
