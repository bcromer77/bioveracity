export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { request_id } = await request.json()
    if (!request_id) {
      return NextResponse.json({ status: 'FAILED', error: 'Missing request id' }, { status: 400 })
    }
    const statusResponse = await fetch('https://apps.abacus.ai/api/getConvertHtmlToPdfStatus', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
      },
      body: JSON.stringify({ request_id }),
    })
    const statusResult = await statusResponse.json()
    const status = statusResult?.status || 'FAILED'
    const result = statusResult?.result || null

    if (status === 'SUCCESS') {
      if (result && result.result) {
        return NextResponse.json({ status, pdf_base64: result.result })
      }
      return NextResponse.json({ status: 'FAILED', error: 'PDF generation completed but no result data' })
    }
    if (status === 'FAILED') {
      return NextResponse.json({ status, error: result?.error || 'PDF generation failed' })
    }
    return NextResponse.json({ status })
  } catch (error: any) {
    return NextResponse.json({ status: 'FAILED', error: 'Failed to check PDF status' }, { status: 500 })
  }
}
