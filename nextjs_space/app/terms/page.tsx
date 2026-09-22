import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { termsSections } from '@/lib/data-rights/legal'
import { TERMS_VERSION } from '@/lib/data-rights/policy'
export const metadata = {title:'Terms and Conditions — BioVeracity'}
export default function Page() { return <div><SiteHeader/><main className="mx-auto max-w-3xl px-5 py-12"><h1 className="text-3xl font-bold">Terms and Conditions</h1><p className="mt-3">Version {TERMS_VERSION} · 22 September 2026</p>{termsSections.map(([heading,text]) => <section key={heading} className="mt-8"><h2 className="text-xl font-semibold">{heading}</h2><p className="mt-3 leading-7">{text}</p></section>)}<p className="mt-8"><Link className="underline" href="/account">Your data and privacy controls</Link> · <Link className="underline" href="/contact">Contact</Link> · <Link className="underline" href="/contributor-release">Contributor release</Link></p></main><SiteFooter/></div> }
