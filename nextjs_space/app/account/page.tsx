import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const session = await auth()
  // Signed-out visitors go to login; signed-in visitors go through the context
  // resolver so they land in the right product (workspace or venue studio).
  if (!session?.user) redirect('/login?callbackUrl=%2Fstart')
  redirect('/start')
}
