// Canonical, authenticated citation URL for a cited passage.
// Identifies workspace, case, document and immutable passage. Contains NO secrets,
// session tokens or expiring storage URLs — access is always enforced server-side when
// the link is opened, so the link itself never grants access. Used consistently by
// search results, chronology, source-context panels, detailed review and issued PDF
// reports so any citation reliably reopens the exact cited passage in the correct case.
//
// origin may be an absolute application origin (e.g. window.location.origin on the client,
// or manifest.appOrigin / NEXTAUTH_URL on the server). When origin is empty a root-relative
// path is returned, which still resolves correctly in a browser context.
export function citationUrl(origin: string | null | undefined, workspaceId: string, caseId: string, documentId: string, passageId: string): string {
  const base = (origin ?? '').replace(/\/+$/, '')
  const path = `/workspace/${encodeURIComponent(workspaceId)}?case=${encodeURIComponent(caseId)}&doc=${encodeURIComponent(documentId)}&cite=${encodeURIComponent(passageId)}`
  return base + path
}
