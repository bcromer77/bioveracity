export function assertPortSeedReady(): void {
  throw new Error('Legacy port seed is quarantined: reconcile source publisher, retrieval time, passage and milestone dates before enabling ingestion. See docs/port-community-execution.md. No database writes permitted by this entry point.')
}
