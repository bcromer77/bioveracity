import { rightsRequest } from '@/lib/data-rights/http'
export const dynamic = 'force-dynamic'
export async function GET() {
  return rightsRequest(async s => ({generatedAt:new Date().toISOString(), scope:'Account details, terms acceptance, rights requests, notification preferences and owned venue profiles/plans and gallery release records. This is not a complete subject access response. Request access for case material, uploads, logs and other personal data; other people’s data requires review.', ...await s.overview()}), true)
}
