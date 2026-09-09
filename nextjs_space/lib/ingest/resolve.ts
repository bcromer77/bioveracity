import { prisma } from '@/lib/prisma'

// Identity resolution is NOT claim verification. Every supplied identity hint
// must agree in an explicit jurisdiction; identifiers also need a namespace.
export interface ResolveHints {
  slug?: string | null
  name?: string | null
  officialIdentifier?: string | null
  identifiers?: string[] | null
  aliases?: string[] | null
  jurisdiction?: string | null
  identifierAuthority?: string | null
  identifierType?: string | null
}
const normalized = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')
const values = (items: (string | null | undefined)[]) => [...new Set(items.filter((x): x is string => typeof x === 'string' && !!x.trim()).map(x => x.trim()))]

export async function resolveAsset(hints: ResolveHints): Promise<string | null> {
  const jurisdiction = hints.jurisdiction?.trim()
  if (!jurisdiction) return null
  const scope = { jurisdiction: { equals: jurisdiction, mode: 'insensitive' as const } }
  const resolved: string[] = []
  const agree = (ids: string[]) => {
    const unique = [...new Set(ids)]
    if (unique.length !== 1) return false
    resolved.push(unique[0])
    return new Set(resolved).size === 1
  }
  const identifiers = values([hints.officialIdentifier, ...(hints.identifiers ?? [])])
  if (identifiers.length) {
    const authority = hints.identifierAuthority?.trim()
    const identifierType = hints.identifierType?.trim()
    if (!authority || !identifierType) return null
    const matches = await prisma.assetIdentifier.findMany({
      where: { value: { in: identifiers }, verified: true, authority, identifierType, asset: scope },
      select: { assetId: true, value: true },
    })
    // One verified ID must not mask a missing, unverified or conflicting ID.
    for (const value of identifiers) if (!agree(matches.filter(row => row.value === value).map(row => row.assetId))) return null
  }
  const name = hints.name?.trim()
  if (name) {
    const matches = await prisma.asset.findMany({ where: { ...scope, name: { equals: name, mode: 'insensitive' } }, select: { id: true }, take: 2 })
    if (matches.length) {
      if (!agree(matches.map(row => row.id))) return null
    } else {
      const aliases = await prisma.assetAlias.findMany({ where: { aliasNormalized: normalized(name), verificationState: 'VERIFIED', asset: scope }, select: { assetId: true } })
      if (!agree(aliases.map(row => row.assetId))) return null
    }
  }
  for (const alias of values(hints.aliases ?? [])) {
    const matches = await prisma.assetAlias.findMany({ where: { aliasNormalized: normalized(alias), verificationState: 'VERIFIED', asset: scope }, select: { assetId: true } })
    if (!agree(matches.map(row => row.assetId))) return null
  }
  const slug = hints.slug?.trim()
  if (slug) {
    const matches = await prisma.asset.findMany({ where: { ...scope, slug }, select: { id: true }, take: 2 })
    if (!agree(matches.map(row => row.id))) return null
  }
  return resolved.length ? resolved[0] : null
}
