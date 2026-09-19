import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/access'
import { redirect } from 'next/navigation'
import { VenueLaunchDesk } from '@/components/admin/venue-launch-desk'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Venue launch desk | BioVeracity', robots: { index: false, follow: false } }
export default async function VenueLaunchPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login?callbackUrl=%2Fadmin%2Fwild%2Flaunch')
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true, accessState: true } })
  if (!user || !isAdmin({ user, expires: '' })) redirect('/start')
  return <main className="mx-auto max-w-6xl p-4 sm:p-8"><VenueLaunchDesk /></main>
}
