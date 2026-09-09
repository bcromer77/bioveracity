import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { isInstitutional } from '@/lib/access'
import { createPdfHandlers } from './pdf-job-access.mjs'

export const pdfJobHandlers = createPdfHandlers({
  async getActor() {
    const session = await auth()
    if (!session?.user?.id) return null
    // JWT entitlement can be stale: deletion/downgrade must take effect at poll time.
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true, accessState: true } })
    if (!user) return null
    return { id: user.id, institutional: isInstitutional({ ...session, user: { ...session.user, ...user } }) }
  },
})
