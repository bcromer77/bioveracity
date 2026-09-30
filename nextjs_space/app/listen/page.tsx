import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { ListeningHome } from './listening-home'
import './listen.css'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Ireland Listens · BioVeracity', description: 'Return to one place. Listen for five minutes. Begin its memory.' }
export default async function ListenPage() {
  const enabled = process.env.LISTENING_PILOT_ENABLED === 'true'
  const session = enabled ? await auth() : null
  const verified = session?.user?.id ? Boolean((await prisma.user.findUnique({ where: { id: session.user.id }, select: { emailVerified: true } }))?.emailVerified) : false
  return <main className="listening"><header className="listen-nav"><Link href="/">BioVeracity<span>Place · Time · Evidence</span></Link><Link href={session?.user ? '/start' : '/login?callbackUrl=%2Flisten'}>{session?.user ? 'My account' : 'Sign in'}</Link></header>
    <section className="listen-intro"><p className="listen-eyebrow">A free citizen observation pilot</p><h1>Ireland listens.<br /><em>A place remembers.</em></h1><p>One familiar place. Five quiet minutes. Return again and begin a listening history of the world around you.</p><p className="listen-small">An independent BioVeracity pilot. A collaboration with Mooney Goes Wild is proposed; RTÉ and the programme have not endorsed this service.</p></section>
    {!enabled ? <section className="listen-card"><h2>We’re preparing the first listening places.</h2><p>Registration for this pilot is not open yet. We are checking the full account, privacy and return-visit experience before inviting participants.</p><Link href="/">Explore BioVeracity</Link></section> : !session?.user ? <>
      <section className="listen-steps"><article><span>01</span><h2>Choose somewhere familiar</h2><p>Your garden, a park or a regular walk. Give it a private nickname and choose a county.</p></article><article><span>02</span><h2>Listen for five minutes</h2><p>You don’t need to identify a bird. Record whether you heard birds and the conditions of your visit.</p></article><article><span>03</span><h2>Come back to its memory</h2><p>See your dated visits together. Repeat at a similar time and in similar conditions.</p></article></section>
      <section className="listen-card"><h2>Your first five minutes matter.</h2><p>Free participation. No payment card. Adult participants only. Your nickname, notes and visits remain private to your account in this pilot.</p><Link className="listen-button" href="/signup?callbackUrl=%2Flisten">Join free</Link> <Link href="/login?callbackUrl=%2Flisten">I already have an account</Link></section>
    </> : !verified ? <section className="listen-card"><h2>Confirm your email to begin.</h2><p>We sent a confirmation link when you joined. Your places and visits stay private to your account once your email is confirmed.</p><Link className="listen-button" href="/verify-email?callbackUrl=%2Flisten">Confirm or resend my email</Link></section> : <ListeningHome />}
    <footer className="listen-footer"><p>Listening visits are personal observations, not verified species records. A quiet visit does not establish that birds are absent. Differences between visits do not establish ecological decline or its cause.</p><p>Built by BioVeracity · <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link></p></footer>
  </main>
}
