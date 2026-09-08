// §6/§30: remove the internal phrase "Last checked at seed time" from every
// evidence-gap dataRequired string. Idempotent; only removes internal jargon,
// no facts changed.
import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main(){
  const gaps = await p.evidenceGap.findMany({ where: { dataRequired: { contains: 'seed time', mode: 'insensitive' } } })
  let n = 0
  for(const g of gaps){
    const cleaned = (g.dataRequired ?? '').replace(/\s*Last checked at seed time\.?\s*$/i, '').trimEnd()
    if(cleaned !== g.dataRequired){
      await p.evidenceGap.update({ where: { id: g.id }, data: { dataRequired: cleaned } })
      n++
    }
  }
  console.log('gaps cleaned:', n)
}
main().finally(()=>p.$disconnect())
