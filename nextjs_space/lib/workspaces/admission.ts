import { WorkspaceError } from './service'
// Per-process admission, not a substitute for deployment-wide rate limits/container quotas.
const globalState=globalThis as typeof globalThis & { __caseAdmission?:Set<string> }
const active=globalState.__caseAdmission??(globalState.__caseAdmission=new Set())
export function admit(actor:string) {
  if(active.has(actor)||active.size>=2)throw new WorkspaceError(429,'Evidence processing is busy. Wait for the current request to finish.')
  active.add(actor);let done=false
  return ()=>{if(!done){done=true;active.delete(actor)}}
}
