export type WildEnquiryInput={venue:string,email:string,website:string,message:string,requestId:string}
export function parseWildEnquiry(raw:unknown):WildEnquiryInput{
 if(!raw||typeof raw!=='object')throw new Error('Please check the enquiry details.')
 const data=raw as Record<string,unknown>
 const string=(key:string,max:number)=>{const v=data[key];if(v!==undefined&&v!==null&&typeof v!=='string')throw new Error('Please check the enquiry details.');const result=typeof v==='string'?v.trim():'';if(result.length>max)throw new Error('One of the fields is too long.');return result}
 const venue=string('venue',160),email=string('email',254).toLowerCase(),website=string('website',500),message=string('message',2000),requestId=string('requestId',36)
 if(!venue||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Please add your venue name and a valid email address.')
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))throw new Error('Please refresh the page and try again.')
 if(string('company',500))throw new Error('Unable to accept this enquiry.')
 if(website){let u:URL;try{u=new URL(website)}catch{throw new Error('Please enter a full website address beginning with https://.')}if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw new Error('Please enter a public http or https website address.')}
 return {venue,email,website,message,requestId}
}
export function wildLeadData(input:WildEnquiryInput){return {id:`wild_${input.requestId}`,name:input.venue,email:input.email,organisation:input.venue,role:'Wild community enquiry',assetName:input.venue,issue:`BioVeracity Wild membership enquiry\nWebsite: ${input.website||'Not supplied'}\n${input.message||'Please contact me about signage and monthly membership.'}`}}
