import { PrismaClient } from '@prisma/client'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { marchCorrection, MARCH_SOURCE } from '../lib/march-case'

async function main() {
  const apply = process.argv.includes('--apply')
  const outputArg = process.argv.find(arg => arg.startsWith('--out='))
  if (apply && !outputArg) throw new Error('--apply requires --out=<audit.json>; use only after approval of the dry run')
  const db = new PrismaClient()
  try {
    const events = await db.event.findMany({ where: { asset: { slug: 'march-wrc' } }, orderBy: { date: 'asc' } })
    const changes = events.map(before => ({ before, patch: marchCorrection(before) })).filter(item => item.patch !== null)
    const report = { mode: apply ? 'approved-apply' : 'dry-run', createdAt: new Date().toISOString(), source: MARCH_SOURCE, changes, sameDateReviewGroups: [...new Set(events.map(e => e.date.toISOString().slice(0, 10)))].map(date => ({ date, ids: events.filter(e => e.date.toISOString().startsWith(date)).map(e => e.id) })).filter(group => group.ids.length > 1), note: 'No records are deleted or merged. Shared dates do not prove duplication. Summaries/divergences elsewhere require a separate audit.' }
    if (outputArg) { const path = resolve(outputArg.slice(6)); mkdirSync(resolve(path, '..'), { recursive: true }); writeFileSync(path, JSON.stringify(report, null, 2), { flag: 'wx' }) }
    console.log(JSON.stringify(report, null, 2))
    if (apply) await db.$transaction(async tx => {
      for (const { before, patch } of changes) {
        const result = await tx.event.updateMany({ where: { id: before.id, title: before.title, description: before.description, sourceUrl: before.sourceUrl, sourceDomain: before.sourceDomain, date: before.date, datePrecision: before.datePrecision, evidenceClass: before.evidenceClass, verified: before.verified }, data: patch! })
        if (result.count !== 1) throw new Error('Record changed since inspection; transaction rolled back')
      }
    })
  } finally { await db.$disconnect() }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Audit failed'); process.exitCode = 1 })
