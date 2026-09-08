// Idempotent, non-destructive: set honest temporal precision on Cambridgeshire
// events whose stored `date` is a placeholder-shaped value (1 Jan = year-only,
// 1st-of-month = month-only). No dates are invented or moved; only the DISPLAY
// precision is recorded so the UI never shows false day-level precision.
// Day-precise events (real exact dates) are left at the 'day' default.
import { prisma } from '../lib/prisma'

async function main() {
  const events = await prisma.event.findMany({
    where: { asset: { regionSlug: 'cambridgeshire' } },
    include: { asset: { select: { statusDetail: true } } },
  })
  let year = 0, month = 0, day = 0
  for (const e of events) {
    const d = e.date
    const m = d.getUTCMonth() // 0 = Jan
    const dom = d.getUTCDate()
    let precision: 'day' | 'month' | 'year' = 'day'
    if (m === 0 && dom === 1) precision = 'year'          // 1 Jan  -> year only known
    else if (dom === 1) precision = 'month'                // 1st of month -> month only known
    // everything else is a genuine exact date
    if (precision === 'year') year++
    else if (precision === 'month') month++
    else day++
    await prisma.event.update({ where: { id: e.id }, data: { datePrecision: precision } })
  }
  console.log(`Cambridgeshire event precision set — year:${year} month:${month} day:${day} (total ${events.length})`)
}
main().finally(() => prisma.$disconnect())
