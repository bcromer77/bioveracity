// Canonical application base URL for building password-reset links. The link is
// NEVER derived from the request Host/Origin header (an attacker can spoof it to
// send victims a poisoned reset link). In production APP_BASE_URL must be an
// explicit HTTPS origin; in development a localhost fallback is allowed.

export class BaseUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BaseUrlError'
  }
}

type EnvLike = Record<string, string | undefined>

export function resolveAppBaseUrl(env: EnvLike): string {
  const configured = env.APP_BASE_URL?.trim()
  const isProduction = env.NODE_ENV === 'production'

  if (configured) {
    let url: URL
    try {
      url = new URL(configured)
    } catch {
      throw new BaseUrlError('APP_BASE_URL is not a valid URL')
    }
    if (isProduction && url.protocol !== 'https:') {
      throw new BaseUrlError('APP_BASE_URL must use https in production')
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new BaseUrlError('APP_BASE_URL must use http or https')
    }
    return url.origin
  }

  if (isProduction) {
    throw new BaseUrlError('APP_BASE_URL must be configured in production')
  }
  return 'http://localhost:3000'
}

export function buildResetLink(baseUrl: string, rawToken: string): string {
  const url = new URL('/reset-password', baseUrl)
  url.searchParams.set('token', rawToken)
  return url.toString()
}
