import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { InstitutionalForm } from '@/components/institutional/institutional-form'
import { Building2, Shield, FileText, Users } from 'lucide-react'

export const metadata = {
  title: 'Request Institutional Access · BioVeracity',
  description: 'For regulators, operators, legal teams, insurers and public bodies who need defensible environmental evidence at scale.',
}

export default function InstitutionalPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-border/40 bg-card/30">
          <div className="mx-auto max-w-[1100px] px-4 py-12 md:py-16">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/50 px-3 py-1 text-xs text-muted-foreground mb-4">
                <Building2 className="h-3.5 w-3.5 text-accent" /> Institutional access
              </div>
              <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">
                When the decision has to hold up.
              </h1>
              <p className="text-base text-muted-foreground leading-relaxed">
                The same product serves everyone. Institutional access is for teams that need it at scale —
                many places followed at once, defensible evidence records for hearings and casework, and a
                clear account of what is established, what is disputed, and where the evidence is missing.
                We do not publish pricing. Tell us what you need to establish and we will respond with what
                the evidence can and cannot support.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10">
              {[
                { icon: Shield, title: 'Defensible by design', body: 'Every claim is traced to a source and labelled by evidence state. Unknown is recorded as unknown.' },
                { icon: FileText, title: 'Evidence records', body: 'Produce a structured record for a place, including where the evidence changed, for casework and review.' },
                { icon: Users, title: 'At your scale', body: 'Follow many places, monitor a portfolio, and see divergence as it emerges across them.' },
              ].map((f, i) => (
                <div key={i} className="rounded-lg border border-border/60 bg-background/40 p-4">
                  <f.icon className="h-5 w-5 text-accent mb-2" />
                  <div className="font-display font-bold text-sm mb-1">{f.title}</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <InstitutionalForm />
      </main>
      <SiteFooter />
    </div>
  )
}
