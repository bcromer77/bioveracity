import {test} from 'node:test'
import assert from 'node:assert/strict'
import {personalDestination} from '../lib/personal-destination'
import {authReturnPath} from '../lib/auth-return-path'
test('empty, venue-only, professional and mixed accounts have distinct destinations',()=>{
 assert.equal(personalDestination([],0),null)
 assert.equal(personalDestination([],1),'/wild/studio')
 assert.equal(personalDestination([],2),'/wild/studio')
 assert.equal(personalDestination([{id:'w'}],0),'/workspace/w')
 assert.equal(personalDestination([{id:'w'}],0,[{id:'c'}]),'/workspace/w?case=c')
 assert.equal(personalDestination([{id:'w'}],0,[{id:'c'},{id:'d'}]),'/workspace/w')
 assert.equal(personalDestination([{id:'w'}],1),null)
 assert.equal(personalDestination([{id:'w'},{id:'x'}],0),null)
})
test('safe continuation does not confer access or allow off-site redirects',()=>{
 for(const p of ['/wild/studio','/workspace','/join/synthetic-token','/workspace/w?case=c&doc=d&cite=p'])assert.equal(authReturnPath(p),p)
 for(const p of [null,'https://evil.example','//evil.example','/\\evil.example','/\nevil'])assert.equal(authReturnPath(p),'/start')
})
