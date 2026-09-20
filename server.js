const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const INDEX = path.join(ROOT, 'index.html');

// Google-only production route. The app never exposes the API key to the browser.
const MODELS = [
  process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  process.env.GEMINI_PRO_MODEL || 'gemini-3.1-pro-preview',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash'
].filter((v,i,a)=>v && a.indexOf(v)===i);

// Optional independent Google projects. If you configure keys from different
// projects, the router can move to another project's quota instead of
// repeatedly hammering one exhausted project.
const GOOGLE_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5
].filter(Boolean);

const OFFICIAL = 'https://udc-hub.com/';

const CORE = `
You are a professional Universal Decimal Classification (UDC) classification assistant.
Use UDC ONLY. Never use DDC, LCC, NLM or another classification system.
The target is the UDC Abridged Edition level where an abridged table is applicable, while preserving valid UDC notation and auxiliaries.
Do not fabricate a classmark. Search the web when a current or exact notation needs verification. Prefer UDC Consortium / UDC Online sources and authoritative library or publisher sources. UDC Online is the authoritative current source when accessible, but it is subscription-based.

CLASSIFICATION METHOD:
1) Read the whole title semantically, not as isolated keywords.
2) Determine the dominant subject and document intent: monograph, textbook, dictionary, handbook, manual, bibliography, statistics, literary work, etc.
3) Select the most specific justified UDC main class.
4) Add only auxiliaries actually supported by the title/content: common auxiliaries of language (=...), form (0...), place (1/9), ethnic/national groups (=...), time ("..."), general characteristics -0...; and appropriate special auxiliaries where the relevant UDC table permits them.
5) Use connecting signs correctly when the title clearly requires a compound subject: +, /, :, ::, [ ] and * / A-Z only when their UDC meaning is justified.
6) For literature, distinguish language/literature from literary form. For a drama, use the language/literature base plus the drama literary-form auxiliary where verified.
7) For dictionaries/encyclopedias/handbooks/manuals, distinguish document form from subject. Do not blindly append a form auxiliary if the UDC schedule's preferred construction is different.
8) Never infer a place, language, time or form auxiliary merely because a country/language word appears unless it is actually a facet of the work.
9) Return one FINAL UDC NUMBER, not a list, when the evidence is sufficient. If evidence is genuinely insufficient, set status to REQUIRES VERIFICATION rather than inventing a number.
10) The answer must explain every notation component in plain language.

Important: the UDC Consortium states that UDC Online contains the complete current scheme and supports searching, parsing, validating and building UDC numbers. The app must therefore treat an exact official UDC hit as stronger evidence than model memory.
`;

const schema = {
  type: 'object',
  properties: {
    title: {type:'string'},
    udc_number: {type:'string'},
    main_subject: {type:'string'},
    sub_subject: {type:'string'},
    document_form: {type:'string'},
    breakdown: {type:'string'},
    explanation: {type:'string'},
    confidence: {type:'string', enum:['High','Medium','Low']},
    status: {type:'string', enum:['VERIFIED','PROVISIONAL','REQUIRES VERIFICATION']},
    verification_basis: {type:'string'},
    sources: {type:'array', items:{type:'string'}},
    search_queries: {type:'array', items:{type:'string'}}
  },
  required:['title','udc_number','main_subject','sub_subject','document_form','breakdown','explanation','confidence','status','verification_basis','sources','search_queries']
};

function cleanText(x){return String(x ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').trim();}
function validUrl(u){try{const x=new URL(u); return /^https?:$/.test(x.protocol)}catch{return false}}
function normalizeModelOutput(raw, title, model){
  let text = raw;
  if (typeof raw === 'object' && raw) text = raw.text || raw.output_text || JSON.stringify(raw);
  text = cleanText(text);
  // Remove accidental markdown fences.
  text = text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  let d;
  try { d = JSON.parse(text); } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('Google returned non-JSON output');
    d = JSON.parse(m[0]);
  }
  d.title = d.title || title;
  d.model = model;
  d.sources = Array.isArray(d.sources) ? d.sources.filter(validUrl).slice(0,8) : [];
  d.search_queries = Array.isArray(d.search_queries) ? d.search_queries.slice(0,8) : [];
  d.udc_number = cleanText(d.udc_number);
  if (!d.udc_number) throw new Error('No UDC number returned');
  if (!/^[0-9.()=:\-+\/\[\]"' ]+[A-Za-z*]*$/.test(d.udc_number)) throw new Error('Invalid UDC notation characters');
  return d;
}

async function callGemini(model, title, candidate=null, key){
  key = key || GOOGLE_KEYS[0];
  if (!key) throw new Error('NO_GOOGLE_KEY');
  const prompt = CORE + `\nTITLE TO CLASSIFY:\n${title}\n` + (candidate ? `\nA first Google-grounded draft is below. Audit it against the evidence and UDC rules; correct it if needed. Do not accept it just because it was generated by another model.\nDRAFT:\n${JSON.stringify(candidate)}\n` : '') + `\nOutput ONLY the requested JSON object. Use Google Search grounding. For web evidence, prioritize searches containing the exact UDC notation/term and official UDC sources.\n`;
  const body = {
    contents:[{role:'user',parts:[{text:prompt}]}],
    tools:[{google_search:{}}],
    generationConfig:{response_mime_type:'application/json',response_schema:schema,temperature:0.1,max_output_tokens:4096}
  };
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), 35000);
  try{
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
      method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key},body:JSON.stringify(body),signal:controller.signal
    });
    const j = await r.json().catch(()=>({}));
    if(!r.ok){
      const msg = j?.error?.message || `HTTP ${r.status}`;
      const e = new Error(msg); e.status=r.status; throw e;
    }
    const text = j?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('') || '';
    const d = normalizeModelOutput(text,title,model);
    const chunks = j?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const grounded = chunks.map(c=>c?.web?.uri).filter(validUrl);
    d.sources = [...new Set([...d.sources,...grounded])].slice(0,8);
    d.grounded = grounded.length>0;
    d.google_searches = j?.candidates?.[0]?.groundingMetadata?.webSearchQueries || d.search_queries;
    return d;
  } finally { clearTimeout(timer); }
}

function syntaxAudit(d){
  const n=d.udc_number;
  const problems=[];
  if(!n || /undefined|null|unknown|not resolved/i.test(n)) problems.push('No usable classmark');
  if(/[{}<>]/.test(n)) problems.push('Unsupported notation character');
  const opens=(n.match(/\(/g)||[]).length, closes=(n.match(/\)/g)||[]).length;
  if(opens!==closes) problems.push('Unbalanced parentheses');
  const sq1=(n.match(/\[/g)||[]).length, sq2=(n.match(/\]/g)||[]).length;
  if(sq1!==sq2) problems.push('Unbalanced brackets');
  const q=(n.match(/"/g)||[]).length;
  if(q%2) problems.push('Unbalanced time auxiliary quotation marks');
  return {ok:problems.length===0, problems};
}


async function classify(title){
  if(!title || title.length<2) throw new Error('Enter a complete book/document title.');
  if(title.length>1000) throw new Error('Title is too long.');

  // Do not spend two requests per title by default. A second verification call
  // is only used when explicitly enabled. This dramatically reduces quota use.
  const errors=[];
  const keys = GOOGLE_KEYS.length ? GOOGLE_KEYS : [null];
  const candidates = [];
  const maxModelsPerKey = Number(process.env.MAX_MODELS_PER_REQUEST || 2);

  for (let ki=0; ki<keys.length; ki++){
    const key=keys[ki];
    let used=0;
    for (const model of MODELS){
      if(used >= maxModelsPerKey) break;
      used++;
      try{
        const first=await callGemini(model,title,null,key);
        const audit=syntaxAudit(first);
        if(!audit.ok){errors.push(`${model}: ${audit.problems.join(', ')}`); continue;}

        // Optional verifier. Off by default to protect quota.
        if(process.env.UDC_VERIFY_PASS === 'true'){
          const auditModel = MODELS.find(m=>m!==model) || model;
          try{
            const checked=await callGemini(auditModel,title,first,key);
            const a2=syntaxAudit(checked);
            if(a2.ok && checked.status !== 'REQUIRES VERIFICATION'){
              checked.engine='Google Gemini Precision';
              checked.audit_model=auditModel;
              checked.provider_errors=errors;
              checked.notation_check='Passed structural UDC notation audit';
              checked.evidence_level=checked.grounded ? 'Google Search grounded' : 'Model analysis only';
              return checked;
            }
          }catch(e){errors.push(`${auditModel}: ${safeError(e)}`)}
        }

        first.engine='Google Gemini Precision';
        first.audit_model='Not run (quota-saving mode)';
        first.provider_errors=errors;
        first.notation_check='Passed structural UDC notation audit';
        first.evidence_level=first.grounded ? 'Google Search grounded' : 'Model analysis only';
        return first;
      }catch(e){
        errors.push(`${model} [key ${ki+1}]: ${safeError(e)}`);
        if(isQuota(e)) break; // move immediately to next independent project key
      }
    }
  }

  // Never expose raw provider/quota errors to the user.
  // Return a machine-readable soft-failure object so the UI can remain healthy.
  return {
    title,
    udc_number:'',
    main_subject:'Not resolved',
    sub_subject:'Google verification temporarily unavailable',
    document_form:'Unknown',
    breakdown:'',
    explanation:'The Google classification service is temporarily unavailable. No unsupported UDC classmark was invented.',
    confidence:'Low',
    status:'REQUIRES VERIFICATION',
    verification_basis:'Google service unavailable; no unverified classmark returned.',
    sources:[],
    search_queries:[],
    engine:'Google Gemini Precision',
    notation_check:'Not run',
    evidence_level:'Unavailable',
    quota_safe:true,
    retryable:true
  };
}

function isQuota(e){
  const st=Number(e?.status||0);
  const m=String(e?.message||'').toLowerCase();
  return st===429 || /quota|resource_exhausted|rate.?limit|too many requests/.test(m);
}
function safeError(e){
  const st=Number(e?.status||0);
  if(st===401 || st===403) return 'Google authentication/permission issue';
  if(st===429) return 'Google quota/rate limit';
  if(st===404) return 'Google model unavailable';
  if(st>=500) return 'Google temporary service issue';
  if(e?.name==='AbortError') return 'Google request timeout';
  return 'Google request failed';
}

function send(res,status,obj,ctype='application/json; charset=utf-8'){
  res.writeHead(status,{'content-type':ctype,'cache-control':'no-store','access-control-allow-origin':'*'});res.end(ctype.startsWith('application/json')?JSON.stringify(obj):obj);
}
function body(req){return new Promise((resolve,reject)=>{let b='';req.on('data',c=>{b+=c;if(b.length>20000){req.destroy();reject(new Error('Request too large'));}});req.on('end',()=>{try{resolve(JSON.parse(b||'{}'))}catch{reject(new Error('Invalid JSON'))}});req.on('error',reject)})}

const server=http.createServer(async(req,res)=>{
  try{
    if(req.method==='GET' && (req.url==='/'||req.url==='/index.html')) return send(res,200,fs.readFileSync(INDEX,'utf8'),'text/html; charset=utf-8');
    if(req.method==='GET' && req.url==='/api/health') return send(res,200,{ok:true,googleConfigured:Boolean(process.env.GEMINI_API_KEY),models:MODELS,googleKeySlots:GOOGLE_KEYS.length,officialSource:OFFICIAL,seedJsonRequired:false,jury:false,searchGrounding:true,quotaSafeMode:true});
    if(req.method==='POST' && req.url==='/api/classify'){
      const b=await body(req);const d=await classify(cleanText(b.title));return send(res,200,d);
    }
    send(res,404,{error:'Not found'});
  }catch(e){send(res,500,{error:'Classification service temporarily unavailable',details:[]});}
});
server.listen(PORT,()=>console.log(`UDC Precision listening on ${PORT}`));
