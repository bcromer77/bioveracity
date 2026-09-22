import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSeasonalBrief, ownerSeasonalBrief, planSeasonalDigest, type SeasonalSignal } from '../lib/seasonal-discovery/briefing'
const now = new Date('2026-09-21T12:00:00Z')
const venue = { id: 'venue-a', ownerId: 'alice', county: 'cambridgeshire', name: 'Fictional café' }
const signal = (changes: Partial<SeasonalSignal> = {}): SeasonalSignal => ({
 id:'guide', revision:'1', title:'A seasonal listening prompt', guidance:'Pause and record what you hear.', topic:'sounds', basis:'seasonal_guidance',
 scope:{kind:'county',id:'cambridgeshire',label:'Cambridgeshire'}, validFrom:'2026-09-01',validUntil:'2026-09-30',observedOn:null,
 review:'approved',visibility:'public',source:{recordId:'source-1',url:'https://example.org/guide',publisher:'Fictional fixture',locator:'Section 2',reuseAllowed:true},...changes,
})
test('county context is not silently promoted to a venue sighting', () => {
 const result=buildSeasonalBrief(venue,[signal()],now)
 assert.equal(result.cards.length,1)
 assert.match(result.cards[0].scopeLabel,/not a sighting/)
 assert.equal(result.cards[0].label,'Worth looking for this season')
 assert.equal(result.cards[0].observedOn,null)
})
test('private, sensitive, withdrawn, unreviewed and out-of-scope sources cannot enter a brief', () => {
 for(const s of [signal({visibility:'private'}),signal({visibility:'sensitive'}),signal({review:'pending'}),signal({review:'withdrawn'}),signal({scope:{kind:'place',id:'venue-b',label:'Other venue'}}),signal({scope:{kind:'county',id:'down',label:'Down'}})]) assert.equal(buildSeasonalBrief(venue,[s],now).cards.length,0)
})
test('invalid or expired dates and unlicensed sources are withheld', () => {
 for(const s of [signal({validUntil:'2026-09-20'}),signal({validFrom:'2026-09-22'}),signal({validFrom:'2026-02-30'}),signal({source:{...signal().source,reuseAllowed:false}}),signal({source:{...signal().source,locator:''}})]) assert.equal(buildSeasonalBrief(venue,[s],now).cards.length,0)
})
test('reported observations require a real date, never an inferred date or future sighting', () => {
 for(const observedOn of [null,'2026-09','2026-09-22']) assert.equal(buildSeasonalBrief(venue,[signal({basis:'reported_observation',observedOn})],now).cards.length,0)
 assert.equal(buildSeasonalBrief(venue,[signal({basis:'reported_observation',observedOn:'2026-09-18'})],now).cards[0].label,'Reported observation')
})
test('conflicting revisions and withdrawal suppress old copies', () => {
 assert.equal(buildSeasonalBrief(venue,[signal(),signal({revision:'2'})],now).cards.length,0)
 assert.equal(buildSeasonalBrief(venue,[signal(),signal({review:'withdrawn'})],now).cards.length,0)
})
test('duplicate records do not repeat; digest respects opt-in and delivered keys', () => {
 const brief=buildSeasonalBrief(venue,[signal(),signal()],now)
 assert.equal(brief.cards.length,1)
 assert.equal(planSeasonalDigest(brief,false,new Set()).length,0)
 assert.equal(planSeasonalDigest(brief,true,new Set([brief.cards[0].key])).length,0)
 assert.equal(planSeasonalDigest(brief,true,new Set()).length,1)
 assert.notEqual(buildSeasonalBrief({...venue,id:'venue-b'},[signal()],now).cards[0].key,brief.cards[0].key)
})
test('ownership is checked before any source access', async () => {
 let reads=0
 await assert.rejects(ownerSeasonalBrief('bob',venue.id,async()=>venue,async()=>{reads++;return [signal()]},now),/Venue not found/)
 assert.equal(reads,0)
 await assert.rejects(ownerSeasonalBrief('',venue.id,async()=>venue,async()=>[],now),/sign in/)
})
test('source failure is not an empty successful survey or a stale success', async () => {
 const brief=await ownerSeasonalBrief('alice',venue.id,async()=>venue,async()=>{throw Error('upstream')},now)
 assert.equal(brief.coverage,'unavailable');assert.deepEqual(brief.cards,[])
 assert.equal(planSeasonalDigest(brief,true,new Set()).length,0)
})

 test('regional scoping works for UK and Irish venues without mixing their evidence', () => {
  for (const county of ['cambridgeshire', 'down', 'kilkenny', 'highland', 'gwynedd']) {
   const local = signal({scope:{kind:'county',id:county,label:county}})
   const brief = buildSeasonalBrief({...venue,county},[local],now)
   assert.equal(brief.cards.length,1)
   assert.equal(buildSeasonalBrief({...venue,county:county+'-other'},[local],now).cards.length,0)
  }
 })
