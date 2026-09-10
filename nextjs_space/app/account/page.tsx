import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const session = await auth()
  // Signed-out visitors go to login; signed-in visitors go straight to the workspace.
  if (!session?.user) redirect('/login?callbackUrl=/workspace')
  redirect('/workspace')
}
