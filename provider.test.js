import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
async function run(fail,action){
 const port=21000+Math.floor(Math.random()*1000),base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['--import','./tests/mock-provider.mjs','server.js'],{env:{...process.env,PORT:String(port),GEMINI_API_KEY:'test-fixture-not-a-secret',GOOGLE_API_KEY:'',GEMINI_MODEL:'gemini-2.5-flash',MOCK_PROVIDER_FAIL:fail?'1':'0'},stdio:'ignore'});
 try{let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch(base+'/api/health')).ok;if(ready)break}catch{}await new Promise(r=>setTimeout(r,50))}assert.ok(ready);await action(base);}finally{child.kill()}
}
test('actual provider request succeeds with mocked Gemini 2.5 structured response',async()=>run(false,async base=>{
 const r=await fetch(base+'/api/classify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Anatomy of the heart'})});assert.equal(r.status,200);const j=await r.json();assert.equal(j.model,'gemini-2.5-flash');assert.equal(j.udc_number,'611.12');assert.equal(j.ddc_number,'611.12');assert.match(j.engine,/structured output/);
}));
test('provider outage preserves a marked local candidate without exposing raw provider errors',async()=>run(true,async base=>{
 const j=await(await fetch(base+'/api/classify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Anatomy of the heart'})})).json();assert.equal(j.recovery_mode,true);assert.ok(j.provider_failures>0);assert.ok(!JSON.stringify(j).includes('test-fixture-not-a-secret'));assert.ok(!JSON.stringify(j).includes('Simulated outage'));assert.equal(j.verified_by_schedule,false);
}));
