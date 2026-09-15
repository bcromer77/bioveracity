import { readFile, stat } from 'node:fs/promises'
import { SNAPSHOT_LIMIT, type Snapshot } from './model'
import { parseSnapshot } from './snapshot'

/** Operator-controlled local snapshot only. No user-supplied paths or outbound
 * requests on the public search route. No access to private case evidence. */
export async function loadSnapshot(): Promise<{ snapshot: Snapshot | null; status: string }> {
  const path = process.env.CAMBRIDGESHIRE_SNAPSHOT_PATH
  if (!path) return { snapshot: null, status: 'Explore the place stories below. The wider wildlife records aren’t available here yet.' }
  try {
    if ((await stat(path)).size > SNAPSHOT_LIMIT) throw new Error('Snapshot too large')
    return { snapshot: parseSnapshot(JSON.parse(await readFile(path, 'utf8'))), status: 'Place stories and published wildlife records are available below.' }
  } catch { return { snapshot: null, status: 'The wider wildlife records couldn’t be loaded. You can still explore the place stories.' } }
}
