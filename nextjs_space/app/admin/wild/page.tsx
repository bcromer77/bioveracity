import { WildReviewQueue } from '@/components/admin/wild-review-queue'
export const dynamic = 'force-dynamic'
export default function WildReviewPage() {
  return <main className="mx-auto max-w-4xl space-y-6 p-8"><h1 className="text-3xl font-semibold">Ecology hub editorial review</h1>
    <p>Review the venue story, every monthly entry and each selected photo. Approval publishes this exact submission. Check attribution, rights, venue authority and sensitive material; record any limitations. Review does not certify biodiversity or environmental performance.</p>
    <WildReviewQueue />
  </main>
}
