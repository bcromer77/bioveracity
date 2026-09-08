import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { ResidentIntake } from './resident-intake'
export const dynamic = 'force-dynamic'
export default async function PostcodePage() {
  const session = await auth()
  if (!session?.user?.id) return <main className="p-8"><h1>Report an observation</h1><Link href="/login?callbackUrl=%2Fpostcode">Sign in to keep your reports private</Link></main>
  if (process.env.COMMUNITY_REPORTS_ENABLED !== 'true') return <main className="p-8"><h1>Community observations</h1><p>Report intake is being prepared. It is not accepting submissions yet.</p></main>
  const [places, reports] = await Promise.all([
    prisma.asset.findMany({ where: { latitude: { not: null }, longitude: { not: null } }, select: { id: true, slug: true, name: true, latitude: true, longitude: true }, orderBy: { name: 'asc' } }),
    prisma.residentSubmission.findMany({ where: { userId: session.user.id, visibility: 'PRIVATE', receivedAt: { gte: new Date(Date.now() - 72 * 3600000) } }, orderBy: { receivedAt: 'desc' }, take: 100 })
  ])
  return <ResidentIntake places={places} reports={reports.map(r => ({ id: r.id, assetId: r.assetId, category: r.category, description: r.description, status: r.status, observedAt: r.observedAt.toISOString(), receivedAt: r.receivedAt.toISOString() }))} />
}
