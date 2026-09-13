import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { buildStrangfordLoughSeed } from '../lib/sources/daera/to-schema-2-1'

function option(name: string): string | null {
  const prefix = `--${name}=`
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null
}

async function main() {
  const place = option('place') ?? 'strangford-lough'
  if (place !== 'strangford-lough') {
    throw new Error(`Unsupported place: ${place}. Available: strangford-lough`)
  }

  const retrievedAt = option('retrieved-at') ?? new Date().toISOString()
  if (Number.isNaN(new Date(retrievedAt).getTime())) {
    throw new Error('--retrieved-at must be an ISO-8601 timestamp')
  }

  const json = `${JSON.stringify(buildStrangfordLoughSeed(retrievedAt), null, 2)}\n`
  const output = option('out')

  if (output) {
    const path = resolve(output)
    await writeFile(path, json, 'utf8')
    process.stdout.write(`${path}\n`)
    return
  }

  process.stdout.write(json)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})

