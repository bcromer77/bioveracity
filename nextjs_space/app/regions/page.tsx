import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { MapPin, ArrowRight, Anchor, Droplets, Factory } from 'lucide-react'
import { FadeIn, Stagger, StaggerItem, HoverLift } from '@/components/ui/animate'

export const dynamic = 'force-dynamic'

const REGIONS = [
  { slug: 'irish-ports', label: 'Irish Ports', icon: Anchor, description: 'Port of Cork, Dublin Port, Shannon Foynes, Rosslare Europort, Port of Waterford (Belview). Dredging, reclamation, ORE development, marine effects and planning evidence.', assetCount: 5 },
  { slug: 'cambridgeshire', label: 'Cambridgeshire', icon: Factory, description: 'March WRC, Milton WRC, Woodhurst/Envar. Wastewater capacity, odour attribution, regulatory scrutiny and AMP8 investment.', assetCount: 2 },
  { slug: 'scotland', label: 'Scottish Wastewater', icon: Droplets, description: 'Edinburgh Seafield WWTW, Kirkcaldy bathing water. Sludge management, odour assurance, overflow monitoring and compliance.', assetCount: 1 },
  { slug: 'northern-ireland', label: 'Northern Ireland', icon: Droplets, description: 'Lough Neagh and catchment. Nutrient attribution, cyanobacterial blooms, storm overflows, treatment works and regulatory reform.', assetCount: 1 },
]

export default function RegionsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-[1200px] px-4 py-8">
          <FadeIn>
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-accent" />
              <h1 className="font-display text-2xl font-bold tracking-tight">Regions</h1>
            </div>
            <p className="text-sm text-muted-foreground mb-8">Evidence intelligence organised by geographic region and infrastructure cluster</p>
          </FadeIn>
          <Stagger staggerDelay={0.1}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {REGIONS?.map((r: any) => (
                <StaggerItem key={r?.slug}>
                  <HoverLift>
                    <Link href={`/regions/${r?.slug}`} className="block p-6 rounded-lg bg-card border border-border/50 hover:border-accent/30 transition-all group" style={{ boxShadow: 'var(--shadow-sm)' }}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                            <r.icon className="h-5 w-5 text-accent" />
                          </div>
                          <div>
                            <h2 className="font-display font-semibold group-hover:text-accent transition-colors">{r?.label}</h2>
                            <span className="text-[10px] text-muted-foreground">{r?.assetCount} assets under review</span>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{r?.description}</p>
                    </Link>
                  </HoverLift>
                </StaggerItem>
              ))}
            </div>
          </Stagger>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
