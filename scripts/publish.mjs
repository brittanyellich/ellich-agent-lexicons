import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {NodeOAuthClient,buildAtprotoLoopbackClientMetadata,requestLocalLock} from '@atproto/oauth-client-node';
import {publicFetch} from './network.mjs';
import {load} from './validate.mjs';
const did=process.argv[2];
if(!/^did:(plc:[a-z2-7]{24}|web:[A-Za-z0-9._:%-]+)$/.test(did??'')) throw new Error('Usage: node scripts/publish.mjs <publisher DID>');
const origin='http://127.0.0.1:8771',scope='atproto repo:com.atproto.lexicon.schema?action=create';
const store=()=>{const map=new Map();return {get:async k=>map.get(k),set:async(k,v)=>{map.set(k,v);},del:async k=>{map.delete(k);}};};
const client=new NodeOAuthClient({fetch:publicFetch,clientMetadata:buildAtprotoLoopbackClientMetadata({scope,redirect_uris:[origin+'/callback']}),stateStore:store(),sessionStore:store(),requestLock:requestLocalLock});
const {schemas}=await load(); const csrf=randomBytes(32).toString('hex');
let session,pending=false,busy=false,done=false,status='Not connected';
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'strict-origin','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; form-action 'self' https:; frame-ancestors 'none'; base-uri 'none'"};
const form=(path,label,disabled=false)=>`<form method="post" action="${path}"><input type="hidden" name="csrf" value="${csrf}"><button ${disabled?'disabled':''}>${label}</button></form>`;
async function revoke(){await client.revoke(did);session=undefined;}
const server=http.createServer(async(req,res)=>{
 const reply=(code,body)=>{res.writeHead(code,headers);res.end(body);};
 try {
  if(req.headers.host!=='127.0.0.1:8771')return reply(403,'Invalid host');
  const url=new URL(req.url,origin);
  if(req.method==='GET'&&url.pathname==='/')return reply(200,`<!doctype html><html lang="en"><meta charset="utf-8"><title>Publish agent lexicons</title><h1>Publish agent lexicons</h1><p>${esc(status)}</p><p>Publisher: ${esc(did)}. Create-only access to com.atproto.lexicon.schema. Credentials stay in memory and are revoked after publication or graceful shutdown.</p><p>Creates these public schemas; existing records are never overwritten. A partial failure can leave some schemas published; rerunning skips identical records and stops on differences.</p><pre>${esc(schemas.map(x=>x.id).join('\n'))}</pre>${form('/connect','1. Sign in as publisher',pending||!!session||done)}${form('/publish','2. Publish the six reviewed schemas',!session||busy||done)}</html>`);
  if(req.method==='GET'&&url.pathname==='/callback'){
   if(!pending)return reply(400,'No sign-in pending');
   try{const result=await client.callback(url.searchParams);if(result.session.did!==did){await client.revoke(result.session.did);throw Error();}session=result.session;status='Publisher verified. Ready to publish.';}finally{pending=false;}
   res.writeHead(303,{...headers,Location:'/'});return res.end();
  }
  if(req.method!=='POST'||!['/connect','/publish'].includes(url.pathname))return reply(404,'Not found');
  if(req.headers.origin!==origin)return reply(403,'Invalid origin');
  let body='';for await(const chunk of req){body+=chunk;if(body.length>1024)return reply(413,'Too large');}
  if(new URLSearchParams(body).get('csrf')!==csrf)return reply(403,'Invalid request');
  if(busy||done)return reply(409,'Unavailable');
  if(url.pathname==='/connect'){
   if(pending||session)return reply(409,'Already connected or pending');pending=true;
   try{const target=await client.authorize(did,{scope});res.writeHead(303,{...headers,Location:target.href});return res.end();}catch(e){pending=false;throw e;}
  }
  if(!session)return reply(401,'Sign in first');busy=true;
  try{
   for(const schema of schemas){
    const params=new URLSearchParams({repo:did,collection:'com.atproto.lexicon.schema',rkey:schema.id});
    const existing=await session.fetchHandler('/xrpc/com.atproto.repo.getRecord?'+params);
    const record={$type:'com.atproto.lexicon.schema',...schema};
    if(existing.ok){const found=await existing.json();if(canonical(found.value)!==canonical(record))throw Error();continue;}
    const error=await existing.json().catch(()=>({}));if(existing.status!==400||error.error!=='RecordNotFound')throw Error();
    const result=await session.fetchHandler('/xrpc/com.atproto.repo.createRecord',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({repo:did,collection:'com.atproto.lexicon.schema',rkey:schema.id,record})});
    if(!result.ok)throw Error();
   }
   await revoke();done=true;status='Six schemas published or already identical. Publishing grant revoked. Verify DNS and public records before use.';
  }finally{busy=false;}
  res.writeHead(303,{...headers,Location:'/'});res.end();
 }catch{let revoked=true;try{if(session)await revoke();}catch{revoked=false;}status='Operation failed. Some records may already exist. Reconnect to retry. '+(revoked?'Publishing grant revoked.':'Grant revocation failed; revoke it at your PDS before restarting.');if(!revoked)done=true;reply(502,`${esc(status)} <a href="/">Return</a>`);}
});
function canonical(x){if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';return JSON.stringify(x);}
server.requestTimeout=30000;
server.listen(8771,'127.0.0.1',()=>console.log('Publishing review: '+origin));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{try{if(session)await revoke();}catch{console.error('Grant revocation failed; revoke it at your PDS.');}server.close(()=>process.exit());});
