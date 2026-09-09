// Server-only provider. Model, dimension and input recipe identify an embedding space.
export const EMBEDDING_DIMENSIONS = 1536
export const EMBEDDING_RECIPE = 'reviewed-claim-excerpt-v1'
export function embeddingConfig() {
  if (process.env.BIOVERACITY_VECTOR_ENABLED !== 'true') return null
  const key = process.env.OPENAI_API_KEY
  const model = process.env.BIOVERACITY_EMBEDDING_MODEL || 'text-embedding-3-small'
  if (!key || !['text-embedding-3-small', 'text-embedding-3-large'].includes(model)) return null
  return { key, model, space: `openai:${model}:${EMBEDDING_DIMENSIONS}:${EMBEDDING_RECIPE}` }
}
export function validVector(value: unknown): number[] {
  if (!Array.isArray(value) || value.length !== EMBEDDING_DIMENSIONS || value.some(x => typeof x !== 'number' || !Number.isFinite(x))) throw new Error('Invalid embedding')
  const norm = Math.hypot(...value)
  if (!Number.isFinite(norm) || norm === 0) throw new Error('Invalid embedding norm')
  return value.map(x => x / norm)
}
export async function embedTexts(texts: string[], config: NonNullable<ReturnType<typeof embeddingConfig>>, fetcher: typeof fetch = fetch) {
  if (!texts.length || texts.length > 16 || texts.some(t => !t.trim() || Buffer.byteLength(t, 'utf8') > 8190)) throw new Error('Embedding input exceeds limits')
  const response = await fetcher('https://api.openai.com/v1/embeddings', {
    method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(12000),
    headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.model, dimensions: EMBEDDING_DIMENSIONS, encoding_format: 'float', input: texts }),
  })
  // Never surface provider bodies, inputs or keys in logs or user-visible errors.
  if (!response.ok) throw new Error('Embedding service unavailable')
  const body = await response.json()
  if (body.model !== config.model || !Array.isArray(body.data) || body.data.length !== texts.length) throw new Error('Embedding response mismatch')
  const rows = [...body.data].sort((a, b) => a.index - b.index)
  if (rows.some((r, i) => r.index !== i)) throw new Error('Embedding response indices mismatch')
  return rows.map(r => validVector(r.embedding))
}
