import { readFile, stat } from 'node:fs/promises'
import { SNAPSHOT_LIMIT, type Snapshot } from './model'
import { parseSnapshot } from './snapshot'

/** Operator-controlled local snapshot only. No user-supplied paths or outbound
 * requests on the public search route. No access to private case evidence. */
export async function loadSnapshot(): Promise<{ snapshot: Snapshot | null; status: string }> {
  const path = process.env.CAMBRIDGESHIRE_SNAPSHOT_PATH
  if (!path) return { snapshot: null, status: 'Countywide occurrence import has not been configured. Sourced place accounts are available.' }
  try {
    if ((await stat(path)).size > SNAPSHOT_LIMIT) throw new Error('Snapshot too large')
    return { snapshot: parseSnapshot(JSON.parse(await readFile(path, 'utf8'))), status: 'Loaded regional occurrence snapshot. Check coverage and collection date below.' }
  } catch { return { snapshot: null, status: 'Occurrence snapshot unavailable or invalid. Sourced place accounts remain available.' } }
}
