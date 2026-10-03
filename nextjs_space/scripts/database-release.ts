import 'dotenv/config'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { migrationPlan } from '../lib/operations/migrations'
// Plan is read-only and offline. Apply requires explicit target, URL and acknowledgement.
const target=process.argv.includes('--evidence')?'evidence':'application'
const plan=migrationPlan('prisma/migrations',target)
if(!process.argv.includes('--apply')) {
 console.log(JSON.stringify({target,migrations:plan.map(({name,checksum})=>({name,checksum})),notice:'Plan only. Reconcile hosted schema and migration history before applying.'},null,2))
} else {
 if(process.env.DATABASE_RELEASE_ACK!=='REVIEWED_BACKUP_AND_TARGET')throw Error('A reviewed target and backup are required')
 const url=process.env.RELEASE_DATABASE_URL
 if(!url)throw Error('RELEASE_DATABASE_URL must explicitly identify the target')
 const literal=(s:string)=>"'"+s.replace(/'/g,"''")+"'"
 const sql=`BEGIN;
 SELECT pg_advisory_xact_lock(681992025);
 CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
 id VARCHAR(36) PRIMARY KEY, checksum VARCHAR(64) NOT NULL, finished_at TIMESTAMPTZ,
 migration_name VARCHAR(255) NOT NULL, logs TEXT, rolled_back_at TIMESTAMPTZ,
 started_at TIMESTAMPTZ NOT NULL DEFAULT now(), applied_steps_count INTEGER NOT NULL DEFAULT 0
 );
 DO $guard$ BEGIN
 IF EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL)
 THEN RAISE EXCEPTION 'Unresolved failed migration; reconcile manually'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)
 AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name<>'_prisma_migrations')
 THEN RAISE EXCEPTION 'Existing schema without migration history; reconcile manually'; END IF;
 END $guard$;
 ${target==='application'?`DO $guard$ BEGIN
 IF to_regclass('"EvidenceDocument"') IS NULL AND NOT EXISTS(SELECT 1 FROM "_prisma_migrations" WHERE migration_name='20260915_ellona_opportunity_watch' AND finished_at IS NOT NULL AND rolled_back_at IS NULL)
 THEN RAISE EXCEPTION 'Ellona historical migration references evidence in the application database; reconcile database topology before release. Never copy evidence migrations into production application database.'; END IF;
 END $guard$;`:''}
 ${plan.map(m=>`DO $guard$ BEGIN
 IF EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE migration_name=${literal(m.name)} AND finished_at IS NOT NULL AND rolled_back_at IS NULL AND checksum<>${literal(m.checksum)}) THEN RAISE EXCEPTION 'Migration checksum mismatch'; END IF;
 END $guard$;
 SELECT NOT EXISTS(SELECT 1 FROM "_prisma_migrations" WHERE migration_name=${literal(m.name)} AND finished_at IS NOT NULL AND rolled_back_at IS NULL) AS apply_migration \\gset
 \\if :apply_migration
 ${m.sql}
 INSERT INTO "_prisma_migrations"(id,checksum,migration_name,finished_at,applied_steps_count) VALUES (${literal(randomUUID())},${literal(m.checksum)},${literal(m.name)},now(),1);
 \\endif`).join('\n')}
 COMMIT;`
 try {
  // Credentials go through the environment, never arguments or output. -X ignores local psqlrc.
  execFileSync('psql',['-X','--set','ON_ERROR_STOP=1'],{env:{...process.env,PGDATABASE:url},input:sql,stdio:['pipe','pipe','pipe'],maxBuffer:8*1024*1024})
  console.log('Reviewed migration plan applied atomically. Record the release SHA and verify application behaviour.')
 }catch{console.error('Database release failed and transaction rolled back. Inspect the target privately; no database output or credentials printed.');process.exitCode=1}
}
