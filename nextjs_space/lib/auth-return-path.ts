// Only return to a local route after credentials or Google sign-in.
export function authReturnPath(value: string | null): string {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\u0000-\u0020]/.test(value)
  )
    return '/workspace'
  try {
    const url = new URL(value, 'https://bioveracity.invalid')
    return url.origin === 'https://bioveracity.invalid'
      ? url.pathname + url.search + url.hash
      : '/workspace'
  } catch {
    return '/workspace'
  }
}
