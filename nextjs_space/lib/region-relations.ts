export type RegionRelation = {
  fromAsset: { slug: string }
  toAsset: { slug: string; name: string }
  relationshipType: string
  verificationState: string
  sourceUrl: string | null
}

export function verifiedDischargeConnections(
  relations: RegionRelation[],
  plotted?: Set<string>,
) {
  return relations
    .filter((relation) =>
      relation.relationshipType === 'DISCHARGES_TO' &&
      relation.verificationState === 'VERIFIED' &&
      Boolean(relation.sourceUrl?.startsWith('https://')) &&
      (!plotted || (plotted.has(relation.fromAsset.slug) && plotted.has(relation.toAsset.slug))),
    )
    .map((relation) => ({
      fromSlug: relation.fromAsset.slug,
      toSlug: relation.toAsset.slug,
      toName: relation.toAsset.name,
      label: 'discharges to',
      sourceUrl: relation.sourceUrl as string,
    }))
}
