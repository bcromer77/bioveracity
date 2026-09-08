import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Idempotent divergence seed. Safe to re-run: each divergence is checked by
// (assetId + title) before creation, and event changeType updates are updateMany
// which are naturally idempotent. NO deletes.

async function main() {
  const assets = await prisma.asset.findMany({ select: { id: true, slug: true } })
  const bySlug: Record<string, string> = {}
  for (const a of assets) bySlug[a.slug] = a.id

  const need = (slug: string) => {
    const id = bySlug[slug]
    if (!id) throw new Error(`Asset not found for slug: ${slug}`)
    return id
  }

  const divergences = [
    {
      assetId: need('march-wrc'),
      title: 'The evidence starts to disagree here',
      date: new Date('2025-07-27'),
      summary: 'The operator record and the community record describe the same period differently.',
      before: 'Anglian Water operates March Water Recycling Centre under environmental permit AN/AW1NF1063/015. Before summer 2025, the public operator record described routine treatment with no site-specific regulatory finding of a persistent odour problem.',
      theChange: 'On 27 July 2025 Anglian Water paused lime-related waste treatment at the site, resuming on 22 September 2025. Over the same summer, March residents reported persistent severe odour and approximately 30-40 daily HGV/tanker movements.',
      theDifference: 'The operator record frames the period as a temporary, managed pause. The community record describes the period as one of sustained, unresolved odour. No verified odour-concentration or source-apportionment series has been supplied that would reconcile the two accounts, and no site-specific Environment Agency enforcement finding has been published for March.',
      whatHappenedNext: 'Lime treatment resumed on 22 September 2025. At portfolio level, Ofwat concluded an investigation into Anglian Water in September 2025 with a £62.8M redress package, and the Environment Agency completed 1,500+ Anglian-area wastewater inspections across April 2025-March 2026 — neither is a site-specific finding for March.',
      status: 'unresolved',
      sourceDomain: 'marchtowncouncil.gov.uk',
    },
    {
      assetId: need('milton-wrc'),
      title: 'The evidence starts to disagree here',
      date: new Date('2025-08-01'),
      summary: 'A consented plan and a cancelled plan describe the same site four months apart.',
      before: 'In April 2025 development consent was granted to relocate the Cambridge (Milton) Water Recycling Centre, intended to release land for approximately 8,300-8,500 homes. The planning record showed an approved, funded relocation.',
      theChange: 'In August 2025 the relocation was cancelled after Housing Infrastructure Fund (HIF) funding was withdrawn. Within four months the same project moved from consented to cancelled.',
      theDifference: 'The environmental baseline work and consent commitments were prepared for a relocation that will not now proceed. Replacement capacity options at the existing site are undefined, so it is not established whether the prior environmental evidence transfers to any future option.',
      whatHappenedNext: 'No replacement scheme with defined capacity or environmental scope has been published. The transferability of the prior baseline evidence to a retained-site option remains an open evidence gap.',
      status: 'unresolved',
      sourceDomain: 'anglianwater.co.uk',
    },
    {
      assetId: need('lough-neagh'),
      title: 'The evidence starts to disagree here',
      date: new Date('2025-06-01'),
      summary: 'Delivery of the action plan and the state of the lake point in different directions.',
      before: 'In July 2024 the Executive approved a 37-point Lough Neagh Action Plan in response to severe blue-green algal blooms. The intervention record described a coordinated programme of remedial actions.',
      theChange: 'By mid-2025 DAERA reported 23 of 37 actions delivered and 14 in progress. Over the same 2025 season, community observers described severe bloom conditions as exceptionally intense, and severe taste-and-odour events had affected Castor Bay and Moyola treatment works in September 2024.',
      theDifference: 'The delivery record (most actions completed or underway) and the outcome record (blooms persisting, disruption continuing) disagree. Nutrient-source attribution itself is disputed — estimates for agriculture versus wastewater vary by model boundary and source grouping — and sediment phosphorus release is not quantified, so a short-term lack of ecological response does not by itself prove the interventions failed.',
      whatHappenedNext: 'In November 2025 the Office for Environmental Protection opened a statutory investigation into DfI, DAERA and the Utility Regulator. A Fisheries, Aquaculture and Water Environment Bill was introduced in June 2026. Drinking-water compliance was reported at 99.88% for 2024, even as taste-and-odour events were recorded — a further point where headline figures and lived experience diverge.',
      status: 'unresolved',
      sourceDomain: 'daera-ni.gov.uk',
    },
    {
      assetId: need('dublin-port'),
      title: 'The evidence starts to disagree here',
      date: new Date('2024-07-23'),
      summary: 'A future-facing planning record and a live operational permit describe the same waters.',
      before: 'Dublin Port operates under an active EPA dumping-at-sea permit (S0024-02) covering capital dredging and disposal at a licensed site west of Burford Bank. The regulatory record shows ongoing, permitted marine disposal.',
      theChange: 'On 23 July 2024 the 3FM Strategic Infrastructure Development application was submitted to An Coimisiún Pleanála, drawing 51 valid public submissions on ecology, birds, noise, vibration and traffic. The planning record now describes a large future redevelopment of the same estate.',
      theDifference: 'The planning record looks forward to assessed future impacts, while the operational permit governs disposal happening now. Public submissions raise ecological and noise concerns, but the available record does not establish how continuing permitted dredging and disposal interact with the effects assessed in the 3FM application.',
      whatHappenedNext: 'In August 2025 Dublin Port Company submitted a response addressing ecology, noise and traffic. The 3FM determination and any conditions that would connect the future assessment to current permitted operations were not established in the available record.',
      status: 'unresolved',
      sourceDomain: 'pleanala.ie',
    },
  ]

  for (const d of divergences) {
    const existing = await prisma.divergence.findFirst({
      where: { assetId: d.assetId, title: d.title, date: d.date },
      select: { id: true },
    })
    if (existing) {
      await prisma.divergence.update({ where: { id: existing.id }, data: d })
      console.log(`Updated divergence for asset ${d.assetId} @ ${d.date.toISOString().slice(0, 10)}`)
    } else {
      await prisma.divergence.create({ data: d })
      console.log(`Created divergence for asset ${d.assetId} @ ${d.date.toISOString().slice(0, 10)}`)
    }
  }

  // Tag relevant existing events with changeType so the timeline reflects material
  // changes and divergence points. updateMany is idempotent.
  const changeTag: { assetSlug: string; title: string; changeType: string }[] = [
    { assetSlug: 'march-wrc', title: 'Anglian Water pauses lime-related waste treatment', changeType: 'material_change' },
    { assetSlug: 'march-wrc', title: 'Residents report persistent severe odour and 30-40 daily HGV movements', changeType: 'divergence' },
    { assetSlug: 'milton-wrc', title: 'Relocation development consent granted', changeType: 'material_change' },
    { assetSlug: 'milton-wrc', title: 'Relocation cancelled after HIF funding withdrawn', changeType: 'divergence' },
    { assetSlug: 'lough-neagh', title: 'DAERA reports 23 of 37 actions delivered, 14 in progress', changeType: 'material_change' },
    { assetSlug: 'lough-neagh', title: 'Serious taste-and-odour events at Castor Bay and Moyola WTW', changeType: 'divergence' },
    { assetSlug: 'dublin-port', title: '3FM SID application submitted to An Coimisiún Pleanála', changeType: 'material_change' },
  ]

  for (const t of changeTag) {
    const assetId = bySlug[t.assetSlug]
    if (!assetId) continue
    const r = await prisma.event.updateMany({
      where: { assetId, title: t.title },
      data: { changeType: t.changeType },
    })
    console.log(`Tagged ${r.count} event(s) '${t.title}' -> ${t.changeType}`)
  }

  console.log('Divergence seed completed successfully')
}

main()
  .catch((e) => {
    console.error('Divergence seed error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
