import { prisma } from '@/lib/prisma'

// Attempt to associate an incoming record with a canonical Asset using the
// hints a producer may supply. Deliberately CONSERVATIVE: it only returns a
// match when confident, following the §D preferred resolution hierarchy:
//   1. official identifier (AssetIdentifier.value, exact)
//   2. exact canonical name (Asset.name)
//   3. verified alias (AssetAlias.aliasNormalized, deterministic normalisation)
//   4. exact slug
//   5. human review (returns null)
// It NEVER creates a public asset and NEVER fuzzy-merges — unresolved records
// become entity candidates for human review instead.
export interface ResolveHints {
  slug?: string | null
  name?: string | null
  officialIdentifier?: string | null
  identifiers?: string[] | null // additional official identifiers to try
  aliases?: string[] | null
}

// §E deterministic alias normalisation: trim, lowercase, collapse whitespace.
function normalizeAlias(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

export async function resolveAsset(hints: ResolveHints): Promise<string | null> {
  // 1. Official identifier(s) — highest confidence. Exact equality uses the
  //    AssetIdentifier value index (no case-insensitive scan).
  const identifierValues: string[] = []
  if (hints.officialIdentifier?.trim()) identifierValues.push(hints.officialIdentifier.trim())
  for (const v of hints.identifiers ?? []) if (v?.trim()) identifierValues.push(v.trim())
  if (identifierValues.length) {
    const matches = await prisma.assetIdentifier.findMany({ where: { value: { in: identifierValues }, verified: true }, select: { assetId: true } })
    const assets = [...new Set(matches.map(row => row.assetId))]
    // Conflicting authorities/namespaces or unknown supplied identifiers need review.
    return assets.length === 1 ? assets[0] : null
  }

  // 2. Exact canonical name (case-insensitive equality; no fuzzy contains, so a
  //    similarly-named but different place is never wrongly bound).
  const name = hints.name?.trim()
  if (name) {
    const byName = await prisma.asset.findMany({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
      take: 2,
    })
    if (byName.length > 1) return null
    if (byName.length === 1) return byName[0].id
  }

  // 3. Verified alias — match the deterministically-normalised alias form
  //    against the AssetAlias index.
  const aliasCandidates: string[] = []
  if (name) aliasCandidates.push(name)
  for (const a of hints.aliases ?? []) if (a?.trim()) aliasCandidates.push(a.trim())
  for (const a of aliasCandidates) {
    const byAlias = await prisma.assetAlias.findMany({
      where: { aliasNormalized: normalizeAlias(a), verificationState: 'VERIFIED' },
      select: { assetId: true },
    })
    const assets = [...new Set(byAlias.map(row => row.assetId))]
    if (assets.length > 1) return null
    if (assets.length === 1) return assets[0]
  }

  // 4. Exact slug.
  const slug = hints.slug?.trim()
  if (slug) {
    const bySlug = await prisma.asset.findUnique({ where: { slug }, select: { id: true } })
    if (bySlug) return bySlug.id
  }

  // 5. Human review.
  return null
}
