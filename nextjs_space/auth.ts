import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
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
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const email = normaliseEmail(credentials.email)
        if (!email) return null
        const user = await prisma.user.findUnique({ where: { email } })
        if (!user?.password) return null
        const isValid = await bcrypt.compare(credentials.password as string, user.password)
        if (!isValid) return null
        return { id: user.id, email: user.email, name: user.name, role: user.role, accessState: user.accessState, authVersion: user.authVersion }
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
      // Direct OAuth requests must not bypass the credential-signup release.
      // Existing Google users retain access, including their data-rights controls.
      if (account?.provider === 'google' && process.env.DATA_RIGHTS_ENABLED === 'true') {
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
          select: { authVersion: true },
        })
        const valid = sessionAuthorityValid({
          tokenAuthVersion: (token as any).authVersion,
          currentAuthVersion: current?.authVersion,
          userExists: Boolean(current),
        })
        if (!valid) return null
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
