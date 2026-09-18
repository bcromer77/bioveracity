import { body } from '@/lib/workspaces/request-body'
import { ownerContribRequest } from '@/lib/wild-hubs/contribution-http'
import { record, text } from '@/lib/wild-hubs/domain'
import { moderationInput } from '@/lib/wild-hubs/contributions'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ id: string }> }

// Owner: list every contribution to a hub they own, in full detail, to curate.
export async function GET(_: Request, ctx: Context) {
  return ownerContribRequest(async (s) => ({
    contributions: await s.list((await ctx.params).id),
  }))
}

// Owner: publish or decline one contribution. Publication changes visibility
// only — it never alters the contribution's evidence class.
export async function POST(request: Request, ctx: Context) {
  return ownerContribRequest(async (s) => {
    const v = record(await body(request, 5000))
    return s.moderate(
      (await ctx.params).id,
      text(v.contributionId, 80),
      moderationInput(v),
    )
  })
}
