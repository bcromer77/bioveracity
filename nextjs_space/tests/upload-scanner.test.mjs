import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { scanLocalFile, ScanError } from '../lib/workspaces/scan-file.mjs'

for (const [name, error, status, phrase] of [
  ['missing scanner', { code: 'ENOENT' }, 503, /not installed/],
  ['file rejected', { code: 1 }, 422, /file did not pass/],
  ['scanner database failure', { code: 2 }, 503, /signature database/],
  ['timeout', { killed: true, signal: 'SIGTERM' }, 503, /finish in time/],
]) {
  test(`${name} fails closed with an actionable error and removes temporary bytes`, async () => {
    let temporaryFile
    await assert.rejects(scanLocalFile(Buffer.from('synthetic private evidence'), (command, args, options, done) => {
      assert.equal(command, 'clamscan')
      assert.equal(options.timeout, 20000)
      assert.ok(args.includes('--alert-exceeds-max=yes'))
      temporaryFile = args.at(-1)
      done(Object.assign(new Error('/private/path MUST NOT LEAK'), error))
    }), e => e instanceof ScanError && e.status === status && phrase.test(e.message) && !e.message.includes('MUST NOT LEAK'))
    await assert.rejects(stat(temporaryFile), { code: 'ENOENT' })
  })
}

test('a successful scan reads the exact restricted file and cleans up', async () => {
  let temporaryFile
  const bytes = Buffer.from('synthetic private evidence')
  await scanLocalFile(bytes, (command, args, options, done) => {
    temporaryFile = args.at(-1)
    Promise.all([readFile(temporaryFile), stat(temporaryFile)]).then(([actual, info]) => {
      assert.deepEqual(actual, bytes)
      assert.equal(info.mode & 0o777, 0o600)
      done(null)
    }).catch(done)
  })
  await assert.rejects(stat(temporaryFile), { code: 'ENOENT' })
})
