import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from '../scripts/validate.mjs';
const {validator}=await load();
const date='2026-01-01T00:00:00.000Z';
const session='at://did:plc:abcdefghijklmnopqrstuvwx/at.ellich.agent.session/3mabc';
const examples={
 document:{content:'# Notes',format:'text/markdown',createdAt:date,updatedAt:date},
 memory:{kind:'factual',scope:'project',content:'A fact',metadata:{source:'test'},createdAt:date,updatedAt:date},
 session:{title:'Test',createdAt:date},
 message:{session,role:'assistant',content:'[{"type":"text","text":"hello"}]',contentFormat:'application/json',createdAt:date},
 summary:{session,content:'hello',createdAt:date,covers:[{uri:session.replace('.session/','.message/'),cid:'bafyreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku'}]},
};
for(const [name,value] of Object.entries(examples)) {
 const id=`at.ellich.agent.${name}`;
 test(`${name}: accepts portable record and rejects missing required fields`,()=>{
  validator.assertValidRecord(id,{$type:id,...value});
  assert.throws(()=>validator.assertValidRecord(id,{$type:id}));
 });
}
test('oversize content rejected without truncation',()=>assert.throws(()=>validator.assertValidRecord('at.ellich.agent.document',{$type:'at.ellich.agent.document',...examples.document,content:'x'.repeat(131073)})));
test('message session must be an AT URI',()=>assert.throws(()=>validator.assertValidRecord('at.ellich.agent.message',{$type:'at.ellich.agent.message',...examples.message,session:'local:123'})));
