import 'dotenv/config'
import { execFileSync } from 'node:child_process'
import { statSync } from 'node:fs'
// Only a deliberate isolated restore. Never reads or creates a production backup.
const archive=process.argv[2]
if(!archive||!statSync(archive).isFile())throw Error('Supply a PostgreSQL custom-format backup archive')
const target=process.env.RESTORE_DATABASE_URL
function identity(value:string){const u=new URL(value);return `${u.hostname}:${u.port||5432}${u.pathname}`}
if(!target||process.env.RESTORE_REHEARSAL_ACK!=='ISOLATED_EMPTY_DATABASE')throw Error('Explicit isolated target and acknowledgement required')
if([process.env.DATABASE_URL,process.env.EVIDENCE_DATABASE_URL].filter(Boolean).some(v=>identity(v!)===identity(target)))throw Error('Restore target must differ from application and evidence databases')
const env={...process.env,PGDATABASE:target}
try{
 const count=execFileSync('psql',['-X','-At','--set','ON_ERROR_STOP=1','-c',"SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema')"],{env,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()
 if(count!=='0')throw Error('Target is not empty')
 execFileSync('pg_restore',['--list',archive],{env,stdio:['pipe','pipe','pipe']})
 // Supplying -d with no credentials uses the isolated PGDATABASE target.
 execFileSync('pg_restore',['--dbname','', '--exit-on-error','--single-transaction','--no-owner','--no-privileges',archive],{env,stdio:['pipe','pipe','pipe'],maxBuffer:16*1024*1024})
 console.log('Database archive restored into the isolated target. Still verify record counts, media, key recovery, private-file decryption and tenant access; this is not full recovery certification.')
}catch{console.error('Restore rehearsal failed. Target may be non-empty or the archive/tooling may be incompatible. Inspect privately; no credentials or database output printed.');process.exitCode=1}
