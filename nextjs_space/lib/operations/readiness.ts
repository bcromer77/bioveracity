import { revolutConfig } from '../billing/revolut'
type Env=Record<string,string|undefined>
export function readiness(env:Env){
 const missing:string[]=[]
 const need=(key:string)=>{if(!env[key]?.trim())missing.push(key)}
 for(const key of ['APP_BASE_URL','DATABASE_URL','AUTH_SECRET','TRANSACTIONAL_EMAIL_PROVIDER','TRANSACTIONAL_EMAIL_FROM','PRIVACY_OPERATOR_EMAIL','PRIVACY_DEPUTY_EMAIL','OPERATIONS_MONITOR_TOKEN'])need(key)
 for(const key of ['AUTH_REQUIRE_VERIFIED_EMAIL','AUTH_ADMIN_EMAIL_STEP_UP','DATA_RIGHTS_ENABLED','OPERATIONS_SEND_ENABLED'])if(env[key]!=='true')missing.push(key+' must be true')
 if((env.OPERATIONS_MONITOR_TOKEN||'').length<32)missing.push('OPERATIONS_MONITOR_TOKEN needs at least 32 characters')
 if(env.TRANSACTIONAL_EMAIL_PROVIDER==='resend')need('RESEND_API_KEY')
 else if(env.TRANSACTIONAL_EMAIL_PROVIDER==='abacus'){for(const key of ['ABACUSAI_API_KEY','WEB_APP_ID','NOTIF_ID_TRANSACTIONAL_EMAIL'])need(key)}
 else missing.push('Supported transactional email provider required')
 if(env.NEXT_PUBLIC_ASK_ENABLED==='true'&&env.ASK_SERVER_ENABLED!=='true')missing.push('Ask advertised but server disabled')
 if(env.BIOVERACITY_BILLING_ENABLED==='true'){
  if(env.BILLING_PROVIDER==='revolut'){try{revolutConfig(env)}catch{missing.push('Revolut plan, tax wording, environment and payment credentials must be configured; live payments require both launch gates')} }
  else if(env.BILLING_PROVIDER==='stripe'){need('STRIPE_SECRET_KEY');need('STRIPE_WEBHOOK_SECRET')}
  else missing.push('Select an implemented billing provider: stripe or revolut')
 }
 if(env.CLUB_LAUNCH_ENABLED==='true'){
  for(const key of ['WILD_HUBS_ENABLED','WILD_PHOTO_JOURNAL_ENABLED','CLUB_SOURCE_REFRESH_ENABLED','REVOLUT_RECONCILE_ENABLED','WILD_PHOTO_DIGEST_SEND_ENABLED'])if(env[key]!=='true')missing.push(key+' must be true for the club launch')
  if(env.BILLING_PROVIDER!=='revolut'||env.BIOVERACITY_BILLING_ENABLED!=='true')missing.push('Club launch requires configured Revolut billing')
  if(env.TRANSACTIONAL_EMAIL_PROVIDER!=='resend')missing.push('Club weekly email requires Resend delivery confirmation')
 }
 return {configurationReady:missing.length===0,missing,notice:'Configuration checks only. Does not certify delivery, restore, legal approval, tenant isolation or deployment.'}
}
