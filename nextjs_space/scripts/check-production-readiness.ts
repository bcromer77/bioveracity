import 'dotenv/config'
import { readiness } from '../lib/operations/readiness'
const result=readiness(process.env)
console.log(JSON.stringify(result,null,2))
if(!result.configurationReady)process.exitCode=1
