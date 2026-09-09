import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { collectSssi } from '../lib/sources/natural-england.mjs';

const directory = process.argv[2];
if (!directory) throw new Error('Usage: node scripts/natural-england-snapshot.mjs <output-directory>');
try {
  const snapshot = await collectSssi();
  const folder = resolve(directory);
  await mkdir(folder, { recursive: true });
  const target = join(folder, `sssi-${snapshot.retrieved_at.replaceAll(':', '-')}.json`);
  // Never overwrite a historical snapshot. No database or production writes.
  await writeFile(target, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx' });
  console.log(`SSSI snapshot: ${snapshot.records.length} records; ${target}`);
} catch (error) {
  console.error(`Snapshot failed; no successful snapshot written: ${error.message}`);
  process.exitCode = 1;
}
