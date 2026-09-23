'use server'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { adapter } from '@/lib/workspaces/http'
import { workspaceService } from '@/lib/workspaces/service'

// Creates the BNG case inside an already-resolved, write-permitted workspace and drops the
// person straight into it. createCase re-checks write permission server-side, so a forged
// workspaceId cannot create a case the caller may not write to. The success redirect is kept
// OUTSIDE the try/catch so its NEXT_REDIRECT signal is never swallowed by error handling.
export async function createBngRecord(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login?callbackUrl=/workspace/bng')
  const userId = session.user.id
  const workspaceId = String(formData.get('workspaceId') ?? '')
  const title = String(formData.get('projectName') ?? '').trim()
  const siteName = String(formData.get('siteName') ?? '').trim()
  let caseId = ''
  try {
    const service = workspaceService({
      ...adapter(prisma),
      transaction: op => prisma.$transaction(tx => op(adapter(tx)), { isolationLevel: 'Serializable' }),
    }, userId)
    const created = await service.createCase(workspaceId, {
      title,
      template: 'BNG',
      sites: siteName ? [{ name: siteName, latitude: null, longitude: null }] : [],
    })
    caseId = created.id
  } catch {
    redirect(`/workspace/bng?workspace=${encodeURIComponent(workspaceId)}&error=create`)
  }
  redirect(`/workspace/${encodeURIComponent(workspaceId)}?case=${encodeURIComponent(caseId)}`)
}
