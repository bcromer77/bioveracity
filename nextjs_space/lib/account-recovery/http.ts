import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import type { Database, Sql } from '../workspaces/service'
import { adapter } from '../workspaces/http'
import { accountRecoveryService, AccountRecoveryError, type RecoveryDeps } from './service'
import { resolveEmailConfig, createEmailer, EmailConfigError } from '../email/transactional'
import { resolveAppBaseUrl, buildResetLink, BaseUrlError } from './base-url'
import { buildResetEmail } from './reset-email'

export const recoveryHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
}

// Best-effort client IP from the standard proxy headers. Only the first hop of
// x-forwarded-for is used; the value is hashed before storage by the rate limiter.
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}

function database(): Database {
  return {
    ...adapter(prisma),
    transaction: (operation) =>
      prisma.$transaction((tx) => operation(adapter(tx) as Sql), { isolationLevel: 'Serializable' }),
  }
}

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12)
}

// Request-reset wiring. Email/base-url configuration problems must never leak or
// reveal account existence: if configuration is missing we log server-side and
// return the generic success response (no token is issued because sendEmail is
// never reached).
export function requestResetService() {
  let deps: RecoveryDeps
  try {
    const emailConfig = resolveEmailConfig(process.env as Record<string, string | undefined>)
    const emailer = createEmailer(emailConfig)
    const baseUrl = resolveAppBaseUrl(process.env as Record<string, string | undefined>)
    deps = {
      hashPassword,
      buildResetLink: (rawToken: string) => buildResetLink(baseUrl, rawToken),
      sendEmail: async ({ to, resetUrl }) => {
        const message = buildResetEmail({ resetUrl })
        await emailer.send({ to, subject: message.subject, html: message.html, text: message.text })
      },
    }
  } catch (error) {
    if (error instanceof EmailConfigError || error instanceof BaseUrlError) {
      // Configuration not present in this environment. Degrade safely.
      console.error('Account recovery is not fully configured:', error.name)
      deps = {
        hashPassword,
        buildResetLink: () => '',
        sendEmail: async () => {
          throw new Error('email-not-configured')
        },
      }
    } else {
      throw error
    }
  }
  return accountRecoveryService(database(), deps)
}

// Consume-reset wiring never sends email, so it needs no email configuration.
export function consumeResetService() {
  const deps: RecoveryDeps = {
    hashPassword,
    buildResetLink: () => '',
    sendEmail: async () => {},
  }
  return accountRecoveryService(database(), deps)
}

export { AccountRecoveryError }
