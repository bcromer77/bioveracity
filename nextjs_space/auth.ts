import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { identities, securityDb } from '@/lib/account-recovery/security-http'
import { requireLimit, securityIp, adminAccount } from '@/lib/account-recovery/security'
import { normaliseEmail } from '@/lib/account-recovery/email'
import { sessionAuthorityValid } from '@/lib/account-recovery/session-authority'
import { isGoogleAuthEnabled } from '@/lib/account-recovery/providers'

// Google is registered server-side ONLY when the feature flag is exactly "true"
// AND both credentials are non-empty. When disabled the provider is never added,
// so the /api/auth/*/google route does not exist. Account linking is left at the
// NextAuth default (disabled): auto-linking a Google identity to an existing
// credentials account that shares the same email is an account-takeover vector
// and has no documented, tested requirement, so the dangerous linking option is
// deliberately omitted.
const googleAuthEnabled = isGoogleAuthEnabled(process.env)

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    ...(googleAuthEnabled
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        adminCode: { label: 'Administrator code', type: 'text' },
      },
      async authorize(credentials, request) {
        try { await requireLimit(securityDb,'loginIp',securityIp(request)) } catch { return null }
        if (typeof credentials?.password !== 'string' || credentials.password.length > 256) return null
        if (!credentials?.email || !credentials?.password) return null
        const email = normaliseEmail(credentials.email)
        if (!email) return null
        try { await requireLimit(securityDb,'loginEmail',email) } catch { return null }
        const user = await prisma.user.findUnique({ where: { email } })
        if (!user?.password) return null
        const isValid = await bcrypt.compare(credentials.password as string, user.password)
        if (!isValid) return null
        if (process.env.AUTH_REQUIRE_VERIFIED_EMAIL === 'true' && !user.emailVerified) return null
        if (process.env.AUTH_ADMIN_EMAIL_STEP_UP === 'true' && adminAccount(user)) {
          if (!await identities().adminCode(credentials.adminCode,user.id)) return null
        }
        return { adminStepVerified: process.env.AUTH_ADMIN_EMAIL_STEP_UP === 'true' && adminAccount(user), id: user.id, email: user.email, name: user.name, role: user.role, accessState: user.accessState, authVersion: user.authVersion }
      },
    }),
  ],
  cookies: {
    state: {
      name: `authjs.state`,
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production' },
    },
    pkceCodeVerifier: {
      name: `authjs.pkce.code_verifier`,
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production' },
    },
  },
  callbacks: {
    async signIn({ account, user }) {
      if (account?.provider === 'google' && process.env.AUTH_ADMIN_EMAIL_STEP_UP === 'true') {
        const current = user.email ? await prisma.user.findUnique({where:{email:user.email}}) : null
        // Google sign-in here does not establish the application's admin second step.
        if (current && adminAccount(current)) return false
      }
      // Direct OAuth requests must not bypass the credential-signup release.
      // Existing Google users retain access, including their data-rights controls.
      if (account?.provider === 'google') {
        const existing = user.email ? await prisma.user.findUnique({where:{email:user.email}}) : null
        if (!existing) return '/signup'
      }
      return true
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`
      if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.adminStepVerified = (user as any).adminStepVerified === true
        token.role = (user as any)?.role ?? 'user'
        token.accessState = (user as any)?.accessState ?? 'REGISTERED'
        ;(token as any).authVersion = (user as any)?.authVersion ?? 0
        return token
      }
      // On every subsequent request, re-check the token against the user's current
      // authority version. A password reset bumps authVersion, so any JWT minted
      // beforehand (or for a deleted user) fails this check and is invalidated:
      // returning null clears the session cookies and revokes access.
      if (token?.id) {
        const current = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { authVersion: true, role: true, accessState: true, emailVerified: true },
        })
        const valid = sessionAuthorityValid({
          tokenAuthVersion: (token as any).authVersion,
          currentAuthVersion: current?.authVersion,
          userExists: Boolean(current),
        })
        if (!valid) return null
        // Fresh authority prevents stale role/access claims after demotion.
        if (process.env.AUTH_ADMIN_EMAIL_STEP_UP === 'true' && adminAccount(current!) && token.adminStepVerified !== true) return null
        token.role = current!.role
        token.accessState = current!.accessState
        if (process.env.AUTH_REQUIRE_VERIFIED_EMAIL === 'true' && !current!.emailVerified) return null
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        ;(session.user as any).role = token.role as string
        ;(session.user as any).accessState = (token as any).accessState as string
      }
      return session
    },
  },
})
