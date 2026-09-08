import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

export const metadata = {
  title: 'Privacy — BioVeracity',
  description: 'How BioVeracity handles the limited information you provide when you use the platform.',
}

const linkClass = 'text-[hsl(var(--link))] underline underline-offset-2 hover:decoration-2'

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-[760px] px-4 py-12">
          <h1 className="font-display text-[32px] font-bold leading-tight text-foreground">Privacy</h1>
          <p className="mt-3 text-[17px] leading-relaxed text-muted-foreground">
            BioVeracity is designed to be useful without asking for information you should not have to give.
            You can search places and read the public evidence record without an account. This page explains, in
            plain language, the limited information we hold when you choose to do more.
          </p>

          <section className="mt-9">
            <h2 className="font-display text-[21px] font-semibold text-foreground">What we collect</h2>
            <ul className="mt-3 space-y-3 text-[16px] leading-relaxed text-foreground">
              <li>
                <span className="font-semibold">Account details.</span> If you create an account, we store your
                name, email address and a securely hashed password. We never store your password in readable form.
              </li>
              <li>
                <span className="font-semibold">Places you follow.</span> When you follow a place, we record which
                place it is so we can notify you when material new evidence appears there, and which categories of
                change you asked us to watch.
              </li>
              <li>
                <span className="font-semibold">Why a place matters to you.</span> Following a place includes one
                optional question. If you answer it, we keep your response so we can understand what people need
                from the record. It is always optional.
              </li>
              <li>
                <span className="font-semibold">Messages you send us.</span> If you contact us or request
                institutional access, we keep what you send so we can respond.
              </li>
            </ul>
          </section>

          <section className="mt-9">
            <h2 className="font-display text-[21px] font-semibold text-foreground">What we do not do</h2>
            <ul className="mt-3 space-y-3 text-[16px] leading-relaxed text-foreground">
              <li>We do not sell your information.</li>
              <li>We do not ask for your profession or organisation before showing you the evidence.</li>
              <li>We do not use the record you follow to build a profile of you for advertising.</li>
            </ul>
          </section>

          <section className="mt-9">
            <h2 className="font-display text-[21px] font-semibold text-foreground">How we use what we hold</h2>
            <p className="mt-3 text-[16px] leading-relaxed text-foreground">
              We use your account and follow details to run the service you asked for: to sign you in, to keep your
              list of followed places, and to notify you when material new evidence appears at a place you follow.
              We use messages you send us to reply to you.
            </p>
          </section>

          <section className="mt-9">
            <h2 className="font-display text-[21px] font-semibold text-foreground">Keeping and removing your information</h2>
            <p className="mt-3 text-[16px] leading-relaxed text-foreground">
              You can unfollow any place at any time, which removes the record that you follow it. If you would like
              your account and the information associated with it removed, please{' '}
              <Link href="/contact" className={linkClass}>contact us</Link> and we will action it.
            </p>
          </section>

          <section className="mt-9">
            <h2 className="font-display text-[21px] font-semibold text-foreground">Questions</h2>
            <p className="mt-3 text-[16px] leading-relaxed text-foreground">
              If you have any questions about how your information is handled, please{' '}
              <Link href="/contact" className={linkClass}>get in touch</Link>.
            </p>
          </section>

          <p className="mt-10 border-t border-border pt-5 text-[13px] leading-relaxed text-muted-foreground">
            BioVeracity is an independent evidence platform and is not affiliated with any regulator, government
            department, or infrastructure operator.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
