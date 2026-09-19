import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { AttentionPreferences } from '@/components/account/attention-preferences'

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const session = await auth()
  if (!session?.user) redirect('/login?callbackUrl=/account')
  return <div className="min-h-screen flex flex-col">
    <SiteHeader />
    <main className="mx-auto w-full max-w-[800px] flex-1 px-4 py-10"><AttentionPreferences /></main>
    <SiteFooter />
  </div>
}
