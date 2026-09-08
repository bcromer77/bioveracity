import 'dotenv/config'
import { indexEvidence } from '../lib/evidence-index'
import { prisma } from '../lib/prisma'

indexEvidence().then(result => console.log(JSON.stringify(result))).catch(() => {
  console.error('Evidence indexing failed; check configuration, database and provider availability. Retry the bounded job.')
  process.exitCode = 1
}).finally(() => prisma.$disconnect())
