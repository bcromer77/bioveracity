import { PublicShell } from '@/components/wild/public-shell'
import { SeasonalLanding } from '@/components/wild/seasonal-landing'
export const metadata = {
  title: 'BioVeracity | Your place. Every season.',
  description:
    'Create a local discovery guide for your hotel or venue. Bring your photographs, local nature stories and seasonal guest ideas together through one QR code.',
  openGraph: {
    title: 'BioVeracity | Your place. Every season.',
    description:
      'Your story, local discoveries and a seasonal plan guests can explore.',
  },
}
export default function HomePage() {
  return (
    <PublicShell>
      <SeasonalLanding />
    </PublicShell>
  )
}
