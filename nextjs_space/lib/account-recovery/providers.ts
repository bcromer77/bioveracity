// Whether Google sign-in should be offered. Google auth stays hidden unless the
// public feature flag is explicitly enabled AND full provider configuration is
// present. This mirrors the inline check used by the login/signup pages and is
// exposed as a pure helper so the behaviour can be unit-tested.

type EnvLike = Record<string, string | undefined>

export function isGoogleAuthEnabled(env: EnvLike): boolean {
  if (env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED !== 'true') return false
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
}
