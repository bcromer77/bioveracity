import { readdirSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
// Historical files are immutable. Evidence migrations target a separate database.
export function migrationPlan(root: string, target: 'application'|'evidence') {
 const evidence=new Set(['0001_evidence_pipeline','0002_evidence_vectors','0003_biodiversity_safeguards'])
 const names=readdirSync(root,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort()
 const selected=names.filter(n=>target==='evidence'?evidence.has(n):!evidence.has(n))
 if(target==='application') {
  const foundation='20260909_private_workspace_foundation', files='20260909_private_case_files'
  selected.splice(selected.indexOf(foundation),1);selected.splice(selected.indexOf(files),0,foundation)
 }
 return selected.map(name=>{const sql=readFileSync(path.join(root,name,'migration.sql'),'utf8');return {name,sql,checksum:createHash('sha256').update(sql).digest('hex')}})
}
