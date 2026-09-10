import type { ConnectorResult } from '../connectors-scotland'
export async function scrapeEastAngliaObjections():Promise<ConnectorResult>{
 return {source:'east-anglia-comments',status:'blocked',records:[],rejected:0,nextOffset:null,
  coverage:'No comments collected or published.',
  error:'Requires verified council portals, acquisition permissions and tested contextual anonymisation. Removing names alone does not anonymise a planning representation; the supplied CPCA portal is unverified.'}
}
