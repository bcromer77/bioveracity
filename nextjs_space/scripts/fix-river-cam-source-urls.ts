// §4/§5: attach the real Environment Agency Catchment Data Explorer URL to the
// River Cam WFD classification event. Idempotent; no dates or facts invented.
import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const EA_WFD_URL = 'https://environment.data.gov.uk/catchment-planning/WaterBody/GB105033042750'
async function main(){
  const asset = await p.asset.findFirst({ where: { slug: 'river-cam' }, include: { events: true } })
  if(!asset){ console.log('river-cam not found'); return }
  const wfd = asset.events.find(e => /water framework directive/i.test(e.title))
  if(!wfd){ console.log('WFD event not found'); return }
  if(wfd.sourceUrl === EA_WFD_URL){ console.log('WFD sourceUrl already set — no change'); }
  else {
    await p.event.update({ where: { id: wfd.id }, data: { sourceUrl: EA_WFD_URL, sourceDomain: 'environment.data.gov.uk' } })
    console.log('WFD sourceUrl set ->', EA_WFD_URL)
  }
}
main().finally(()=>p.$disconnect())
