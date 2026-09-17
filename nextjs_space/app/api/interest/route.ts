import { prisma } from '@/lib/prisma'
import { notifyInterest } from '@/lib/lead-notification'
import { parseInterest, categoryLabel, InterestError, type InterestLeadData } from '@/lib/register-interest/interest'

export const dynamic = 'force-dynamic'

// PR54 — Register interest. Lightweight demand capture for anonymous visitors.
// This route NEVER creates or mutates a User, PrivateWorkspace, PrivateCase,
// WildHub, publication, evidence, subscription or payment record. It persists a
// single InterestLead, then attempts a founder notification. Persistence is the
// source of truth: an email failure must not lose the lead or tell the visitor
// their interest was not registered.
export async function POST(request: Request) {
  let data: InterestLeadData
  try {
    if (!request.headers.get('content-type')?.includes('application/json')) {
      return Response.json({ error: 'Please send your details as JSON.' }, { status: 415 })
    }
    // Bound the request body so an oversized payload is rejected before parsing.
    const reader = request.body?.getReader()
    let text = ''
    let size = 0
    const decoder = new TextDecoder()
    if (reader) {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > 12000) {
          await reader.cancel()
          return Response.json({ error: 'That submission is too large.' }, { status: 413 })
        }
        text += decoder.decode(value, { stream: true })
      }
      text += decoder.decode()
    }
    data = parseInterest(JSON.parse(text))
  } catch (e) {
    const message =
      e instanceof InterestError
        ? e.message
        : e instanceof SyntaxError
          ? 'Please check your details.'
          : 'Please check your details.'
    return Response.json({ error: message }, { status: 400 })
  }

  try {
    // Simple anti-spam: bound repeat submissions from one email in the last hour.
    const recent = await prisma.interestLead.count({
      where: { email: data.email, createdAt: { gte: new Date(Date.now() - 3600000) } },
    })
    if (recent >= 5) {
      return Response.json({ error: 'You are already on the list. We will be in touch.' }, {
        status: 429,
        headers: { 'Retry-After': '3600' },
      })
    }

    // Persistence is the source of truth and happens before any email attempt.
    await prisma.interestLead.create({
      data: {
        name: data.name,
        email: data.email,
        organisation: data.organisation,
        category: data.category,
        message: data.message,
        source: data.source,
      },
    })
  } catch {
    return Response.json(
      { error: 'We could not register your interest just now. Your details are still in the form; please try again.' },
      { status: 503 },
    )
  }

  // A notification failure is logged inside notifyInterest and never thrown, so
  // an otherwise valid lead still returns the normal successful state.
  await notifyInterest({
    name: data.name,
    email: data.email,
    organisation: data.organisation,
    category: data.category,
    categoryLabel: categoryLabel(data.category),
    source: data.source,
    message: data.message,
  })

  return Response.json({ registered: true }, { status: 201 })
}
