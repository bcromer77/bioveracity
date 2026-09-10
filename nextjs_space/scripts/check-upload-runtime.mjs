// Run in the deployed application directory, as the application user.
// Uses synthetic bytes only; never connects to a database or changes runtime flags.
import { scanLocalFile } from '../lib/workspaces/scan-file.mjs'

try {
  await scanLocalFile(Buffer.from('BioVeracity synthetic upload readiness check.'))
  console.log('PASS: the local security scanner completed a clean-file scan.')
  console.log('Next: verify a PDF upload, reload, passage search and reviewed export in a labelled test case.')
} catch (error) {
  console.error(`FAIL: ${error.message}`)
  console.error('Provision clamscan and its current signature database inside the deployed runtime. Keep uploads blocked until this check passes.')
  process.exitCode = 1
}
