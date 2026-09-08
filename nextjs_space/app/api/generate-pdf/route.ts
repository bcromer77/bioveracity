export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isRegistered, isInstitutional } from '@/lib/access'

// Creates an async HTML->PDF request and returns request_id immediately.
// The client polls /api/generate-pdf/status for the result.
export async function POST(request: Request) {
  try {
    const session = await auth()
    const { html_content, pdf_options, css_stylesheet, reportKind } = await request.json()

    // Commercial contract enforcement — server-side, regardless of UI state.
    // Quick Summary: any registered account (free retention benefit).
    // Full Evidence Report: institutional (or admin) only.
    const kind = reportKind === 'report' ? 'report' : 'summary'
    if (!isRegistered(session)) {
      return NextResponse.json({ success: false, error: 'You need an account to produce a record.', required: 'REGISTERED' }, { status: 401 })
    }
    if (kind === 'report' && !isInstitutional(session)) {
      return NextResponse.json(
        { success: false, error: 'The full evidence report requires institutional access.', required: 'INSTITUTIONAL' },
        { status: 403 },
      )
    }

    if (!html_content) {
      return NextResponse.json({ success: false, error: 'Nothing to render' }, { status: 400 })
    }

    const createResponse = await fetch('https://apps.abacus.ai/api/createConvertHtmlToPdfRequest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
      },
      body: JSON.stringify({
        html_content,
        pdf_options: pdf_options || { format: 'A4', print_background: true, margin: { top: '18mm', right: '16mm', bottom: '20mm', left: '16mm' } },
        css_stylesheet,
      }),
    })

    if (!createResponse.ok) {
      const error = await createResponse.json().catch(() => ({ error: 'Failed to create PDF request' }))
      return NextResponse.json({ success: false, error: error.error }, { status: 500 })
    }

    const { request_id } = await createResponse.json()
    if (!request_id) {
      return NextResponse.json({ success: false, error: 'No request ID returned' }, { status: 500 })
    }
    return NextResponse.json({ success: true, request_id })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Failed to create PDF request' }, { status: 500 })
  }
}
