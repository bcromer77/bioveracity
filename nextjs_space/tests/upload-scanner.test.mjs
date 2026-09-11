import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { scanBytes, ScanError } from '../lib/workspaces/scan-file.mjs'

// --- Helper: create a mock fetchFn that returns a given response. ---
function mockFetch(status, body, { throwError, throwAbort } = {}) {
  return async (_url, _opts) => {
    if (throwAbort) {
      const err = new Error('The operation was aborted')
      err.name = 'AbortError'
      throw err
    }
    if (throwError) throw new Error('Network failure')
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }
  }
}

const fakeKey = 'test-api-key-0123456789'
const cleanBytes = Buffer.from('BioVeracity synthetic clean file for tests.')

// --- Clean scan ---
describe('clean file scan', () => {
  test('accepts a clean verdict from the advanced endpoint', async () => {
    await scanBytes(cleanBytes, fakeKey, {
      fetchFn: mockFetch(200, {
        CleanResult: true,
        ContainsExecutable: false,
        ContainsMacros: false,
        ContainsScript: false,
        FoundViruses: [],
      }),
    })
    // No exception = pass.
  })
})

// --- Missing / invalid API key ---
describe('missing or invalid API key', () => {
  for (const badKey of [undefined, null, '', 'short']) {
    test(`rejects key: ${JSON.stringify(badKey)}`, async () => {
      await assert.rejects(
        scanBytes(cleanBytes, badKey, { fetchFn: mockFetch(200, { CleanResult: true }) }),
        e => e instanceof ScanError && e.status === 503 && /key is not configured/.test(e.message)
      )
    })
  }

  test('rejects 401/403 from the provider', async () => {
    await assert.rejects(
      scanBytes(cleanBytes, fakeKey, { fetchFn: mockFetch(401, {}) }),
      e => e instanceof ScanError && e.status === 503 && /key is invalid or expired/.test(e.message)
    )
  })
})

// --- Malware detected ---
describe('malware detection', () => {
  test('rejects files with CleanResult=false and reports the virus name', async () => {
    await assert.rejects(
      scanBytes(cleanBytes, fakeKey, {
        fetchFn: mockFetch(200, {
          CleanResult: false,
          FoundViruses: [{ FileName: 'upload.bin', VirusName: 'EICAR-Test-File' }],
        }),
      }),
      e => e instanceof ScanError && e.status === 422 && /EICAR-Test-File/.test(e.message)
    )
  })

  test('rejects files with CleanResult=false even without virus names', async () => {
    await assert.rejects(
      scanBytes(cleanBytes, fakeKey, {
        fetchFn: mockFetch(200, { CleanResult: false, FoundViruses: [] }),
      }),
      e => e instanceof ScanError && e.status === 422 && /did not pass/.test(e.message)
    )
  })
})

// --- Ambiguous / incomplete results ---
describe('ambiguous scan results', () => {
  for (const [label, body] of [
    ['CleanResult missing', { ContainsExecutable: false }],
    ['CleanResult null', { CleanResult: null }],
    ['CleanResult string', { CleanResult: 'true' }],
  ]) {
    test(`rejects when ${label}`, async () => {
      await assert.rejects(
        scanBytes(cleanBytes, fakeKey, { fetchFn: mockFetch(200, body) }),
        e => e instanceof ScanError && e.status === 503 && /ambiguous/.test(e.message)
      )
    })
  }
})

// --- Advanced flags (executables, macros, scripts) ---
describe('advanced threat flags', () => {
  for (const [flag, phrase] of [
    ['ContainsExecutable', /executable/i],
    ['ContainsMacros', /macros/i],
    ['ContainsScript', /scripts/i],
    ['ContainsXmlExternalEntities', /XML external/i],
    ['ContainsInsecureDeserialization', /serialisation/i],
    ['ContainsUnsafeArchive', /unsafe archive/i],
  ]) {
    test(`rejects file with ${flag}=true`, async () => {
      await assert.rejects(
        scanBytes(cleanBytes, fakeKey, {
          fetchFn: mockFetch(200, { CleanResult: true, [flag]: true }),
        }),
        e => e instanceof ScanError && e.status === 422 && phrase.test(e.message)
      )
    })
  }
})

// --- Network / timeout errors ---
describe('network and timeout errors', () => {
  test('rejects on network failure', async () => {
    await assert.rejects(
      scanBytes(cleanBytes, fakeKey, { fetchFn: mockFetch(0, {}, { throwError: true }) }),
      e => e instanceof ScanError && e.status === 503 && /could not reach/.test(e.message)
    )
  })

  test('rejects on abort/timeout', async () => {
    await assert.rejects(
      scanBytes(cleanBytes, fakeKey, { fetchFn: mockFetch(0, {}, { throwAbort: true }) }),
      e => e instanceof ScanError && e.status === 503 && /finish in time/.test(e.message)
    )
  })

  test('rejects on rate limit (429)', async () => {
    await assert.rejects(
      scanBytes(cleanBytes, fakeKey, { fetchFn: mockFetch(429, {}) }),
      e => e instanceof ScanError && e.status === 503 && /rate limit/.test(e.message)
    )
  })

  test('rejects on malformed JSON response', async () => {
    await assert.rejects(
      scanBytes(cleanBytes, fakeKey, {
        fetchFn: async () => ({
          ok: true, status: 200,
          json: async () => { throw new SyntaxError('Unexpected token') },
        }),
      }),
      e => e instanceof ScanError && e.status === 503 && /malformed/.test(e.message)
    )
  })

  test('rejects on server error (500)', async () => {
    await assert.rejects(
      scanBytes(cleanBytes, fakeKey, { fetchFn: mockFetch(500, {}) }),
      e => e instanceof ScanError && e.status === 503 && /HTTP 500/.test(e.message)
    )
  })
})

// --- Rate limiter ---
describe('per-process rate limiting', () => {
  test('enforces ≥1 second gap between calls', async () => {
    const times = []
    const fetch = async () => {
      times.push(Date.now())
      return { ok: true, status: 200, json: async () => ({ CleanResult: true }) }
    }
    await scanBytes(cleanBytes, fakeKey, { fetchFn: fetch })
    await scanBytes(cleanBytes, fakeKey, { fetchFn: fetch })
    assert.ok(times.length === 2)
    assert.ok(times[1] - times[0] >= 900, `Gap was only ${times[1] - times[0]}ms`)
  })
})
