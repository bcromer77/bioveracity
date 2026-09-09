import { parseFile } from './parse-file.mjs'
process.once('message', async input => {
  try {
    const result = await parseFile(Buffer.from(input.bytes, 'base64'), input.name)
    process.send?.({ result }, () => process.exit(0))
  } catch { process.send?.({ error: 'Parsing failed: unsupported, encrypted, damaged or oversized content. No files were imported.' }, () => process.exit(1)) }
})
