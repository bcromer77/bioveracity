export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ASK_ENABLED } from '@/lib/features'

const SYSTEM_PROMPT = `You are BioVeracity, an environmental evidence intelligence platform. You provide answers about environmental infrastructure - ports, wastewater treatment, water quality, industrial sites, and regulatory activity.

Your responses MUST be structured with these exact section headers (use ## for each):
## What We Know
## What We Do Not Know
## Why It Matters
## Who Should Care
## What Evidence Would Resolve It
## What To Watch Next
## Sources

IMPORTANT RULES:
- Every factual claim must reference its evidence classification:
  ● Verified Record (R) - regulator or statutory evidence
  ◐ Corroborated Report (G/O) - government or operator records
  ○ Unverified Report (C/M) - community or media reports
  △ BioVeracity Inference (A) - analytical inference
- Never fabricate data, statistics, or endorsements
- Distinguish between regulator findings and operator assertions
- Community reports are evidence of concern, not proof of violation
- Absence of enforcement records does not prove compliance
- Planning permission does not establish environmental performance
- Be precise about what is confirmed vs what is alleged

You have access to intelligence about these assets and regions:
- Irish Ports: Port of Cork/Ringaskiddy, Dublin Port, Shannon Foynes, Rosslare Europort
- Cambridgeshire: March WRC, Milton/Cambridge WRC, Woodhurst/Envar
- Scotland: Edinburgh Seafield WWTW, Kirkcaldy bathing water
- Northern Ireland: Lough Neagh and catchment, NI Water assets

Use the provided context data to answer accurately. If the question is outside your knowledge, say so explicitly.`

export async function POST(request: Request) {
  if (!ASK_ENABLED) {
    return NextResponse.json({ error: 'The Ask feature is currently unavailable.' }, { status: 503 })
  }
  try {
    const { question } = await request.json()
    if (!question) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    // Fetch relevant context from database
    const assets = await prisma.asset.findMany({
      include: {
        events: { take: 5, orderBy: { date: 'desc' } },
        authorisations: { take: 3 },
        capitalProjects: { take: 3 },
        regulatoryItems: { take: 3 },
        evidenceGaps: { take: 3 },
        communityItems: { take: 3 },
      },
    })

    const contextData = (assets ?? []).map((a: any) => {
      const events = (a?.events ?? []).map((e: any) => `- [${e?.evidenceClass}] ${e?.title} (${e?.date ? new Date(e.date).toISOString().split('T')[0] : 'date unknown'})`).join('\n')
      const projects = (a?.capitalProjects ?? []).map((p: any) => `- ${p?.name}: ${p?.value ?? 'value not disclosed'} - ${p?.status}`).join('\n')
      const gaps = (a?.evidenceGaps ?? []).map((g: any) => `- ${g?.description}`).join('\n')
      const regulatory = (a?.regulatoryItems ?? []).map((r: any) => `- [${r?.evidenceClass}] ${r?.title}`).join('\n')
      const community = (a?.communityItems ?? []).map((c: any) => `- [${c?.evidenceClass}] ${c?.title}`).join('\n')
      const auths = (a?.authorisations ?? []).map((auth: any) => `- ${auth?.permitRef ?? auth?.type}: ${auth?.description ?? auth?.status}`).join('\n')

      return `=== ${a?.name} (${a?.type}, ${a?.region}) ===
Status: ${a?.status} - ${a?.statusDetail ?? ''}
Operator: ${a?.operatorName ?? 'Not specified'}
Regulator: ${a?.regulatorName ?? 'Not specified'}
Summary: ${a?.summary ?? ''}
${events ? 'Recent Events:\n' + events : ''}
${projects ? 'Capital Projects:\n' + projects : ''}
${regulatory ? 'Regulatory Activity:\n' + regulatory : ''}
${auths ? 'Authorisations:\n' + auths : ''}
${community ? 'Community Reports:\n' + community : ''}
${gaps ? 'Evidence Gaps:\n' + gaps : ''}`
    }).join('\n\n')

    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Context data from the BioVeracity evidence database:\n\n${contextData}\n\nQuestion: ${question}` },
        ],
        stream: true,
        max_tokens: 3000,
      }),
    })

    if (!response?.ok) {
      const errText = await response?.text?.()
      return NextResponse.json({ error: `LLM API error: ${errText}` }, { status: 502 })
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        const encoder = new TextEncoder()
        let fullContent = ''
        let partialRead = ''

        try {
          while (true) {
            const { done, value } = await reader!.read()
            if (done) break
            partialRead += decoder.decode(value, { stream: true })
            const lines = partialRead.split('\n')
            partialRead = lines.pop() ?? ''

            for (const line of lines) {
              if (line?.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') {
                  const finalData = JSON.stringify({ status: 'completed', content: fullContent })
                  controller.enqueue(encoder.encode(`data: ${finalData}\n\n`))
                  return
                }
                try {
                  const parsed = JSON.parse(data)
                  const content = parsed?.choices?.[0]?.delta?.content ?? ''
                  if (content) {
                    fullContent += content
                    const progressData = JSON.stringify({ status: 'processing', content })
                    controller.enqueue(encoder.encode(`data: ${progressData}\n\n`))
                  }
                } catch { /* skip */ }
              }
            }
          }
          // If we didn't get [DONE], send what we have
          if (fullContent) {
            const finalData = JSON.stringify({ status: 'completed', content: fullContent })
            controller.enqueue(encoder.encode(`data: ${finalData}\n\n`))
          }
        } catch (error: any) {
          const errorData = JSON.stringify({ status: 'error', message: error?.message ?? 'Stream error' })
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Internal server error' }, { status: 500 })
  }
}
