// Only return to a local route after credentials or Google sign-in. With no
// explicit target we send people to the context resolver (/start), never a
// single universal home, so venue owners and professionals each land in the
// right product.
export function authReturnPath(value: string | null): string {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\u0000-\u0020]/.test(value)
  )
    return '/start'
  try {
    const url = new URL(value, 'https://bioveracity.invalid')
    return url.origin === 'https://bioveracity.invalid'
      ? url.pathname + url.search + url.hash
      : '/start'
  } catch {
    return '/start'
  }
}
