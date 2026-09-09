import assert from 'node:assert/strict'
import test from 'node:test'
import { embeddingConfig } from '../lib/evidence-embeddings'

// These tests verify the config-failure semantics (task 4):
// - BIOVERACITY_VECTOR_ENABLED !== 'true' → null (clean skip)
// - BIOVERACITY_VECTOR_ENABLED === 'true' but missing key → null (caller distinguishes)
// - BIOVERACITY_VECTOR_ENABLED === 'true' + valid key + valid model → config object
// The script (index-evidence.ts) is responsible for mapping null+enabled to failure.

const saved: Record<string, string | undefined> = {}
function setEnv(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k]
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
}
function restoreEnv() {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
}

test('disabled vector search returns null config', () => {
  setEnv({ BIOVERACITY_VECTOR_ENABLED: 'false', OPENAI_API_KEY: 'sk-test-key' })
  try {
    assert.equal(embeddingConfig(), null)
  } finally { restoreEnv() }
})

test('unset BIOVERACITY_VECTOR_ENABLED returns null config', () => {
  setEnv({ BIOVERACITY_VECTOR_ENABLED: undefined, OPENAI_API_KEY: 'sk-test-key' })
  try {
    assert.equal(embeddingConfig(), null)
  } finally { restoreEnv() }
})

test('enabled but missing OPENAI_API_KEY returns null config', () => {
  setEnv({ BIOVERACITY_VECTOR_ENABLED: 'true', OPENAI_API_KEY: undefined })
  try {
    assert.equal(embeddingConfig(), null)
  } finally { restoreEnv() }
})

test('enabled but unsupported model returns null config', () => {
  setEnv({ BIOVERACITY_VECTOR_ENABLED: 'true', OPENAI_API_KEY: 'sk-test-key', BIOVERACITY_EMBEDDING_MODEL: 'gpt-4o' })
  try {
    assert.equal(embeddingConfig(), null)
  } finally { restoreEnv() }
})

test('enabled with valid key and default model returns config', () => {
  setEnv({ BIOVERACITY_VECTOR_ENABLED: 'true', OPENAI_API_KEY: 'sk-test-key', BIOVERACITY_EMBEDDING_MODEL: undefined })
  try {
    const cfg = embeddingConfig()
    assert.ok(cfg)
    assert.equal(cfg!.model, 'text-embedding-3-small')
    assert.ok(cfg!.space.includes('text-embedding-3-small'))
    assert.ok(cfg!.space.includes('1536'))
    assert.ok(cfg!.space.includes('reviewed-claim-excerpt-v1'))
  } finally { restoreEnv() }
})

test('enabled with valid key and text-embedding-3-large returns config', () => {
  setEnv({ BIOVERACITY_VECTOR_ENABLED: 'true', OPENAI_API_KEY: 'sk-test-key', BIOVERACITY_EMBEDDING_MODEL: 'text-embedding-3-large' })
  try {
    const cfg = embeddingConfig()
    assert.ok(cfg)
    assert.equal(cfg!.model, 'text-embedding-3-large')
  } finally { restoreEnv() }
})

// Test the script-level config semantics by checking exit code expectations
// (these document the contract; actual script invocation tested via shell in CI)
test('config semantics: script must distinguish disabled-skip from misconfigured-failure', () => {
  // The contract: when BIOVERACITY_VECTOR_ENABLED !== 'true', embeddingConfig() returns null
  // and the script should exit 0 (clean skip).
  // When BIOVERACITY_VECTOR_ENABLED === 'true' but embeddingConfig() returns null,
  // it means credentials or model are invalid → the script should exit 1.
  // We verify the library returns null in both cases (the script uses the enabled flag to distinguish).
  setEnv({ BIOVERACITY_VECTOR_ENABLED: 'false', OPENAI_API_KEY: undefined })
  try {
    assert.equal(embeddingConfig(), null, 'disabled + no key = null (skip case)')
  } finally { restoreEnv() }

  setEnv({ BIOVERACITY_VECTOR_ENABLED: 'true', OPENAI_API_KEY: undefined })
  try {
    assert.equal(embeddingConfig(), null, 'enabled + no key = null (failure case)')
  } finally { restoreEnv() }
  // The script index-evidence.ts checks BIOVERACITY_VECTOR_ENABLED separately to
  // distinguish the two null cases and set the appropriate exit code.
})
