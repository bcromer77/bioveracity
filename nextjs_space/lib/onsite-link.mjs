// Deliberately do not turn arbitrary source URIs into navigation or proxy targets.
export function internalHref(value) {
  if (typeof value !== 'string' || value.length > 4096 || /[\\\u0000-\u0020]/.test(value)) return null
  if (value.startsWith('#') || value.startsWith('?')) return value
  if (value.startsWith('/') && !value.startsWith('//')) return value
  try {
    const url = new URL(value)
    if (url.origin === 'https://bioveracity.com' && !url.username && !url.password) return url.pathname + url.search + url.hash
  } catch {}
  return null
}
