import { body } from './request-body'
import { WorkspaceError, type Database } from './service'
import { caseFiles } from './case-files'
import { admit } from './admission'
import { checkFormatAllowed, MAX_EVAL_BYTES } from './parser'
import type { ParsedFile } from './parser'
export const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff' }
type Dependencies={getActor:()=>Promise<string|null>;db:Database;env:Record<string,string|undefined>;scan:(bytes:Buffer,apiKey:string)=>Promise<void>;parse:(bytes:Buffer,name:string)=>Promise<ParsedFile>;render:(manifest:Record<string,unknown>)=>Promise<Buffer>;reserveScan:()=>Promise<void>}
type Context={params:Promise<{workspaceId:string;caseId:string}>}
export function createCaseEndpoint(deps: Dependencies) {
return async function handle(request:Request,context:Context,write:boolean) {
  let release:(()=>void)|undefined
  try {
    const actor=await deps.getActor();if(!actor)throw new WorkspaceError(401,'Authentication required')
    if(deps.env.PRIVATE_WORKSPACES_ENABLED!=='true'||deps.env.PRIVATE_EVIDENCE_ENABLED!=='true'||deps.env.PRIVATE_EVIDENCE_RUNTIME_APPROVED!=='true')throw new WorkspaceError(503,'Private evidence is not enabled on this deployment')
    const {workspaceId:w,caseId:c}=await context.params
    const service=caseFiles(deps.db,actor,deps.env.PRIVATE_EVIDENCE_KEY??'')
    const query=new URL(request.url).searchParams
    let result:unknown
    if(write) {
      // Enforce membership before buffering file bytes.
      await service.check(w,c)
      release=admit(actor)
      const raw=await body(request,8*1024*1024)
      if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new WorkspaceError(400,'Expected object')
      const input=raw as Record<string,unknown>
      switch(input.action) {
        case 'import': {
          await service.check(w,c,'write')
          if(typeof input.name!=='string'||input.name.length>180||typeof input.bytes!=='string'||! /^[A-Za-z0-9+/]+={0,2}$/.test(input.bytes))throw new WorkspaceError(400,'Invalid file')
          // §4: Enforce evaluation byte cap (3,000,000) on the server.
          const bytes=Buffer.from(input.bytes,'base64');if(!bytes.length||bytes.length>MAX_EVAL_BYTES)throw new WorkspaceError(413,`Maximum ${(MAX_EVAL_BYTES/1_000_000).toFixed(0)} MB per file during this evaluation.`)
          // §6: Block formats whose embedded content the scanner cannot fully verify.
          checkFormatAllowed(input.name)
          // §4: Reserve a monthly quota slot before calling the scanner.
          await deps.reserveScan()
          // §3: Scan before parsing; only a clean verdict proceeds.
          const apiKey = deps.env.CLOUDMERSIVE_API_KEY ?? ''
          await deps.scan(bytes, apiKey)
          const parsed=await deps.parse(bytes,input.name)
          result=await service.import(w,c,parsed,{sourceUrl:typeof input.sourceUrl==='string'?input.sourceUrl:undefined,publicationDate:typeof input.publicationDate==='string'?input.publicationDate:undefined,supersedesId:typeof input.supersedesId==='string'?input.supersedesId:undefined});break
        }
        case 'review':result=await service.review(w,c,String(input.eventId),input);break
        case 'exportPermission':if(typeof input.enabled!=='boolean')throw new WorkspaceError(400,'Invalid permission');result=await service.setExport(w,c,input.enabled);break
        case 'export':{const rt=typeof input.reportTitle==='string'&&input.reportTitle.trim()?input.reportTitle.trim().slice(0,160):undefined;result=await service.export(w,c,deps.render,rt);break}
        default:throw new WorkspaceError(400,'Unsupported operation')
      }
    } else {
      switch(query.get('action')) {
        case 'passage':result=await service.passage(w,c,query.get('id')??'');break
        case 'context':{const radius=Math.min(Math.max(parseInt(query.get('radius')??'3',10)||3,0),5);result=await service.context(w,c,query.get('id')??'',radius);break}
        case 'history':result={revisions:await service.history(w,c,query.get('id')??'')};break
        case 'exports':{const limit=Math.min(Math.max(parseInt(query.get('limit')??'20',10)||20,1),50);const offset=Math.max(parseInt(query.get('offset')??'0',10)||0,0);result=await service.listExports(w,c,limit,offset);break}
        case 'search':result={results:await service.search(w,c,query.get('q')??'',query.get('earlier')==='true'),mode:'Exact text search; authorised cases only'};break
        case 'original':{const x=await service.original(w,c,query.get('id')??'');return new Response(new Uint8Array(x.bytes),{headers:{...privateHeaders,'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="original-${(query.get('id')??'').replace(/[^a-z0-9-]/gi,'')}.bin"`,'Content-Security-Policy':"sandbox; default-src 'none'"}})}
        case 'export':{const manifest=query.get('format')==='json';const x=await service.downloadExport(w,c,query.get('id')??'',manifest);return new Response(new Uint8Array(x.bytes),{headers:{...privateHeaders,'Content-Type':manifest?'application/json':'application/pdf','Content-Disposition':`attachment; filename="case-timeline.${manifest?'json':'pdf'}"`}})}
        default:result=await service.list(w,c)
      }
    }
    return Response.json(result,{headers:privateHeaders})
  } catch(error) {return Response.json({error:error instanceof WorkspaceError?error.message:'Private evidence request failed. Reload before retrying.'},{status:error instanceof WorkspaceError?error.status:500,headers:privateHeaders})}
  finally {release?.()}
}}
