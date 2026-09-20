import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { InstitutionalForm } from '@/components/institutional/institutional-form'
import { Building2, Shield, FileText, Users } from 'lucide-react'

export const metadata = {
  title: 'Request Institutional Access · BioVeracity',
  description: 'For councils, public bodies and institutional teams who need long-lived, source-linked environmental evidence for planning, monitoring and casework.',
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
                What was promised here?
              </h1>
              <p className="text-base text-muted-foreground leading-relaxed">
                For councils and public bodies, the problem often outlives a single application, report or officer. BioVeracity keeps the source evidence attached to the place so planning, monitoring and enforcement teams can return to what was recorded, what was required, what evidence was later located and what remains unresolved. It supports review; it does not make the statutory decision.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10">
              {[
                { icon: FileText, title: 'Planning', body: 'Keep environmental evidence and source-backed commitments connected to the development or place they concern.' },
                { icon: Users, title: 'Monitoring', body: 'Return to the record over time and see what evidence has been located, what remains unresolved and what needs review next.' },
                { icon: Shield, title: 'Enforcement & casework', body: 'Start from the original source and chronology when a commitment, condition or environmental question needs investigation.' },
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
