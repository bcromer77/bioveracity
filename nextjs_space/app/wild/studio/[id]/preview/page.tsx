import { notFound } from 'next/navigation'
import { PublicShell } from '@/components/wild/public-shell'
import { VisitorPage } from '@/components/wild/visitor-page'
import { loadPreviewEdition } from '@/lib/wild-hubs/preview'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Private preview | Your Wild Counties page',
  robots: { index: false, follow: false },
}

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const view = await loadPreviewEdition(id)
  if (!view) notFound()
  return (
    <PublicShell>
      <VisitorPage view={view} />
    </PublicShell>
  )
}
