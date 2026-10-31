import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const port=19000+Math.floor(Math.random()*1000),base=`http://127.0.0.1:${port}`;
let child;
before(async()=>{child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),GEMINI_API_KEY:'',GOOGLE_API_KEY:''},stdio:'ignore'});for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok)return}catch{}await new Promise(r=>setTimeout(r,50))}throw Error('Startup failed')});
after(()=>child?.kill());
const post=(body)=>fetch(base+'/api/classify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
test('health and public page',async()=>{const r=await fetch(base);assert.equal(r.status,200);assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.match(await r.text(),/CLASSIFY/);const h=await(await fetch(base+'/api/health')).json();assert.ok(h.bundledUDCReferencePages>0);assert.ok(h.bundledDdcReferencePages>0)});
test('private files are inaccessible',async()=>{for(const p of ['server.js','package.json','README.md','node_modules/express/package.json','.env','inline-1.js'])assert.equal((await fetch(base+'/'+p)).status,404,p)});
test('input validation',async()=>{for(const title of ['',{},[],123,null])assert.equal((await post({title})).status,400);assert.equal((await post({title:'a'.repeat(1001)})).status,413);const r=await fetch(base+'/api/classify',{method:'POST',headers:{'Content-Type':'application/json'},body:'{bad'});assert.equal(r.status,400);assert.ok((await r.json()).error)});
test('body limit',async()=>assert.equal((await post({title:'a',extra:'x'.repeat(70000)})).status,413));
test('classification preserves titles and separates output',async()=>{for(const title of ['Library classification','History of India','National anthem of India','Social History of the United States in the 20th Century','Indian Library Association','Quantum biology and education','ਪੰਜਾਬ ਦਾ ਇਤਿਹਾਸ','Dictionary of the doctrines of Eastern Churches','Sobha Singh','A bibliography of writings on social welfare','Unknown subject xyzabc','<script>alert(1)</script>']){const r=await post({title});assert.equal(r.status,200,title);const j=await r.json();assert.equal(j.full_title,title);assert.equal(typeof j.udc_number,'string');assert.equal(typeof j.ddc_number,'string');assert.ok(j.title_coverage_audit,title)}});
test('repeat requests are deterministic',async()=>{const a=await(await post({title:'History of India'})).json(),b=await(await post({title:'History of India'})).json();assert.equal(a.udc_number,b.udc_number);assert.equal(a.ddc_number,b.ddc_number)});
test('browser scripts parse and have one server classification path',()=>{const html=readFileSync('index.html','utf8');for(const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);assert.equal((html.match(/fetch\('\/api\/classify'/g)||[]).length,1);assert.ok(html.includes('signal:controller.signal'))});

test('page displays V148 release labels',()=>{const html=readFileSync('index.html','utf8');assert.match(html,/<title>UDC One-Click V148/);assert.match(html,/<span class="v">V148/);assert.match(html,/<div class="lead">V148/)});

test('bus repair returns complete independent numbers',async()=>{for(const title of ['Repair of buses','Bus repair','Repairs of buses','Buses repair and maintenance','Maintenance and repair of buses','  REPAIR OF BUSES.  ']){const j=await(await post({title})).json();assert.equal(j.udc_number,'629.114.5.004.67',title);assert.equal(j.ddc_number,'629.287233',title);assert.equal(j.full_title,title.trim());assert.equal(j.verified_by_schedule,false);assert.equal(j.rule_id,'road-vehicle-maintenance-v147')}});
test('vehicle maintenance rules distinguish types and operations',async()=>{for(const [title,u,d] of [['Maintenance of buses','629.114.5.004.5','629.287233'],['Repair of cars','629.114.6.004.67','629.2872'],['Repair of trucks','629.114.4.004.67','629.2874']]){const j=await(await post({title})).json();assert.equal(j.udc_number,u);assert.equal(j.ddc_number,d)}});
test('vehicle rules do not discard unrelated qualifiers',async()=>{for(const title of ['Repair of computer buses','Bus repair in India','Repair of bus engines','History of buses','Repair of buses and trains']){const j=await(await post({title})).json();assert.notEqual(j.rule_id,'road-vehicle-maintenance-v147',title)}});

test('new interdisciplinary titles offer independent alternatives',async()=>{
 for(const title of ['Quantum biology: a new approach','Artificial intelligence in rural schools in India, 2020-2025','Medical ethics in hospitals','Economic history of Punjab']){
  const j=await(await post({title})).json();
  assert.ok(j.subject_analysis.interdisciplinary,title);
  assert.ok(j.subject_candidates.length>=2,title);
  assert.equal(j.full_title,title);
  for(const candidate of j.subject_candidates){assert.ok(candidate.udc);assert.ok(candidate.ddc);assert.ok(candidate.udc_evidence.length);assert.ok(candidate.ddc_evidence.length)}
 }
});
test('explicit main subject resolves ambiguous title priority',async()=>{
 const title='Artificial intelligence in rural schools in India, 2020-2025';
 const unresolved=await(await post({title})).json();assert.equal(unresolved.status,'needs_subject_selection');assert.equal(unresolved.udc_number,'');
 const j=await(await post({title,main_subject:'education'})).json();assert.equal(j.udc_number,'37');assert.equal(j.ddc_number,'370');assert.equal(j.selected_main_subject,'education');assert.ok(j.subject_analysis.places.includes('India'));assert.ok(j.subject_analysis.periods.includes('2020-2025'));assert.equal(j.verified_by_schedule,false);
});
test('opaque titles use reader summary rather than guessing from title',async()=>{
 const title='The Silent Horizon';const j=await(await post({title,description:'A book on astronomy and galaxies.'})).json();assert.equal(j.full_title,title);assert.equal(j.udc_number,'52');assert.equal(j.ddc_number,'520');assert.ok(j.subject_analysis.description_provided);
 const none=await(await post({title})).json();assert.equal(none.subject_analysis.subjects.length,0);assert.ok(none.subject_analysis.questions.length);
});
test('Punjabi title subjects are detected',async()=>{
 const j=await(await post({title:'ਪੰਜਾਬ ਵਿੱਚ ਖੇਤੀ ਅਤੇ ਸਿੱਖਿਆ'})).json();assert.ok(j.subject_analysis.subjects.some(s=>s.id==='agriculture'));assert.ok(j.subject_analysis.subjects.some(s=>s.id==='education'));assert.ok(j.subject_analysis.places.includes('ਪੰਜਾਬ'));
});
test('summary and focus validation',async()=>{
 for(const body of [{title:'Astronomy',description:{}},{title:'Astronomy',description:'x'.repeat(4001)},{title:'Astronomy',main_subject:'medicine'},{title:'Astronomy',main_subject:[]}])assert.equal((await post(body)).status,400);
});
test('new subject files are not served publicly',async()=>{for(const name of ['subject-engine.js','vehicle-classification.js'])assert.equal((await fetch(base+'/'+name)).status,404)});

test('unseen technical titles receive ranked reference passages',async()=>{const j=await(await post({title:'Electroplating of nickel'})).json();assert.ok(j.title_evidence.udc.length);assert.ok(j.title_evidence.ddc.length);for(const hit of [...j.title_evidence.udc,...j.title_evidence.ddc]){assert.ok(hit.page);assert.ok(hit.excerpt);assert.ok(hit.matched_terms.length)}});
