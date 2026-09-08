import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { ContactForm } from '@/components/contact/contact-form'

export const metadata = {
  title: 'Contact — BioVeracity',
  description: 'Get in touch with BioVeracity, or bring us a place you want on the record.',
}

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-[640px] px-4 py-12">
          <h1 className="font-display text-[32px] font-bold leading-tight text-foreground">Contact us</h1>
          <p className="mt-3 text-[17px] leading-relaxed text-muted-foreground">
            Whether you have a question, want to tell us about a place that should be on the record, or need to
            reach the team, send us a message below and we will get back to you.
          </p>
          <div className="mt-8">
            <ContactForm />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
