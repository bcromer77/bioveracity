// Run in the deployed application directory, as the application user.
// Uses synthetic bytes only; never connects to a database or changes runtime flags.
import { scanBytes } from '../lib/workspaces/scan-file.mjs'

const apiKey = process.env.CLOUDMERSIVE_API_KEY
if (!apiKey) {
  console.error('FAIL: CLOUDMERSIVE_API_KEY is not set in the environment.')
  console.error('Configure the Cloudmersive API key as a server-only environment variable.')
  process.exitCode = 1
} else {
  try {
    await scanBytes(Buffer.from('BioVeracity synthetic upload readiness check.'), apiKey)
    console.log('PASS: the Cloudmersive security scanner completed a clean-file scan.')
    console.log('Next: verify a PDF upload, reload, passage search and reviewed export in a labelled test case.')
  } catch (error) {
    console.error(`FAIL: ${error.message}`)
    console.error('Check that the CLOUDMERSIVE_API_KEY is valid and the free-tier quota has not been exceeded.')
    process.exitCode = 1
  }
}
