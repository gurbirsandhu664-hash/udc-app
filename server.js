require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;
const MODEL = (process.env.GEMINI_MODEL || 'gemini-3.6-flash').trim();

app.use(cors());
app.use(express.json({limit:'1mb'}));

const MAIN_CLASSES={
'0':'Science and knowledge. Computer science. Information. Librarianship',
'1':'Philosophy. Psychology',
'2':'Religion. Theology',
'3':'Social sciences',
'4':'Vacant',
'5':'Mathematics. Natural sciences',
'6':'Applied sciences. Medicine. Technology',
'7':'Arts. Entertainment. Sport',
'8':'Language. Linguistics. Literature',
'9':'Geography. Biography. History'
};

const SYSTEM=`You are a careful Universal Decimal Classification (UDC) cataloguing assistant.
Use UDC ONLY, never DDC.
Do not invent a UDC number. Clearly mark uncertainty.
Distinguish subject from form, place, language, time and other auxiliaries.
Use + for coordination, / for consecutive extension, : for relation, :: for order-fixing, [] for grouping only when justified.
Do not add auxiliaries merely because they are possible.
If the title is too ambiguous for a defensible number, return MORE_INFO_NEEDED.
For literature distinguish 81 language/linguistics from 82 literature.
For history/geography identify the actual geographic or historical subject.
Return concise cataloguer-style reasoning, not hidden chain-of-thought.`;

function normalize(r){
return{
status:r?.status||'SUCCESS',
finalUdc:r?.finalUdc||'',
mainClass:r?.mainClass||'',
mainSubject:r?.mainSubject||'',
subSubject:r?.subSubject||'',
auxiliaries:Array.isArray(r?.auxiliaries)?r.auxiliaries:[],
notation:Array.isArray(r?.notation)?r.notation:[],
explanation:r?.explanation||'',
confidence:r?.confidence||'Low',
infoNeeded:r?.infoNeeded||'',
alternatives:Array.isArray(r?.alternatives)?r.alternatives:[],
verificationNote:r?.verificationNote||'Verify the final notation against the authoritative UDC schedules before cataloguing.'
};}


async function classifyWithGroq(prompt) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY is not configured.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: prompt }
        ],
        temperature: 0.05,
        response_format: { type: 'json_object' }
      }),
      signal: controller.signal
    });
    const raw = await response.text();
    if (!response.ok) {
      let message = raw;
      try { const j = JSON.parse(raw); message = j?.error?.message || raw; } catch (_) {}
      throw new Error(`Groq API error (${response.status}): ${message}`);
    }
    const data = JSON.parse(raw);
    const text = data?.choices?.[0]?.message?.content || '';
    if (!text) throw new Error('Groq returned an empty response.');
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

app.get('/api/health',(req,res)=>res.json({
ok:true,
geminiConfigured:Boolean(process.env.GEMINI_API_KEY),
model:MODEL,
runtime:process.version
}));

app.get('/api/classes',(req,res)=>res.json(MAIN_CLASSES));

app.post('/api/classify', async (req,res) => {
  try {
    const { title, author='', keywords='', description='' } = req.body || {};
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'Book title is required.' });
    }

    const prompt = `Classify this bibliographic item using UDC ONLY.
Title: ${JSON.stringify(String(title).trim())}
Author: ${JSON.stringify(author)}
Keywords: ${JSON.stringify(keywords)}
Description: ${JSON.stringify(description)}

Top-level UDC classes for orientation only:
${Object.entries(MAIN_CLASSES).map(([k,v]) => `${k} — ${v}`).join('\n')}

Return a defensible classification. If the supplied information is insufficient for a specific number, use MORE_INFO_NEEDED rather than guessing.`;

    // Primary: Gemini
    if (process.env.GEMINI_API_KEY) {
      try {
        const client = getAI();
        const response = await client.models.generateContent({
          model: MODEL,
          contents: prompt,
          config: {
            systemInstruction: SYSTEM,
            temperature: 0.05,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                status: { type: Type.STRING, enum: ['SUCCESS','MORE_INFO_NEEDED'] },
                finalUdc: { type: Type.STRING },
                mainClass: { type: Type.STRING },
                mainSubject: { type: Type.STRING },
                subSubject: { type: Type.STRING },
                auxiliaries: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { notation:{type:Type.STRING}, purpose:{type:Type.STRING} }, required:['notation','purpose'] } },
                notation: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { symbol:{type:Type.STRING}, meaning:{type:Type.STRING} }, required:['symbol','meaning'] } },
                explanation: { type: Type.STRING },
                confidence: { type: Type.STRING, enum:['High','Medium','Low'] },
                infoNeeded: { type: Type.STRING },
                alternatives: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { udc:{type:Type.STRING}, whenToUse:{type:Type.STRING} }, required:['udc','whenToUse'] } },
                verificationNote: { type: Type.STRING }
              },
              required: ['status','finalUdc','mainClass','mainSubject','explanation','confidence','verificationNote']
            }
          }
        });
        const text = (response.text || '').trim();
        if (!text) throw new Error('Gemini returned an empty response.');
        return res.json(normalizeResult(JSON.parse(text)));
      } catch (e) {
        console.error('Gemini failed; trying Groq:', e.message || e);
      }
    }

    // Backup: Groq
    if (process.env.GROQ_API_KEY) {
      try {
        const result = normalizeResult(await classifyWithGroq(prompt));
        result.verificationNote = `${result.verificationNote} Groq was used as the backup provider.`;
        return res.json(result);
      } catch (e) {
        console.error('Groq fallback failed:', e.message || e);
      }
    }

    return res.status(503).json({
      error: 'Both AI providers are unavailable. Check the API keys, model names, and provider quotas.'
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Classification failed.' });
  }
});

app.get('/',(req,res)=>res.type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#07111f">
<title>UDC Classifier Pro</title>
<style>
body{margin:0;background:#07111f;color:#edf5ff;font:15px system-ui,sans-serif}.wrap{max-width:980px;margin:auto;padding:22px}.hero{padding:22px 0}.eyebrow{color:#55b7ff;font-weight:800;letter-spacing:.12em;font-size:12px}h1{font-size:34px;margin:6px 0}.hero p,.muted{color:#9db0c7}.card{background:#0e1b2d;border:1px solid #29415e;border-radius:18px;padding:18px;margin-top:16px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:760px){.grid{grid-template-columns:1fr}h1{font-size:28px}}label{display:block;color:#c7d6e8;font-size:13px;font-weight:700;margin-bottom:6px}input,textarea{width:100%;border:1px solid #29415e;background:#091626;color:#edf5ff;border-radius:11px;padding:12px;font:inherit;outline:none;box-sizing:border-box}textarea{min-height:90px;resize:vertical}button{border:0;border-radius:11px;padding:12px 15px;font-weight:800;cursor:pointer}.primary{width:100%;background:#55b7ff;color:#04111d}.secondary{background:#172b44;color:#edf5ff}button:disabled{opacity:.6}.num{font:800 38px monospace;color:#55b7ff;word-break:break-all}.row{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}.pill{padding:5px 9px;border-radius:99px;background:#18324c;color:#bfe3ff;font-size:12px;font-weight:800}.section{margin-top:15px;padding-top:15px;border-top:1px solid #29415e}ul{padding-left:20px}.hist{padding:10px;border:1px solid #29415e;border-radius:10px;background:#0a1727;margin-top:8px}.small{font-size:12px}.error{color:#ffaaaa;background:#3b1d24;border:1px solid #68313b;padding:11px;border-radius:10px}.success{color:#9bf2bc;background:#123523;border:1px solid #245f3e;padding:11px;border-radius:10px}.loading{color:#55b7ff;padding:12px 0}
</style></head><body><main class="wrap">
<header class="hero"><div class="eyebrow">UNIVERSAL DECIMAL CLASSIFICATION</div><h1>UDC Classifier Pro</h1><p>Gemini-assisted cataloguing with explicit notation and uncertainty handling.</p></header>
<section class="card"><h2>Book details</h2><form id="form">
<label>Book title *</label><input id="title" required placeholder="e.g. History of India">
<div class="grid"><div><label>Author</label><input id="author" placeholder="Optional"></div><div><label>Keywords</label><input id="keywords" placeholder="Optional"></div></div>
<label>Description / subject scope</label><textarea id="description" placeholder="Optional — useful for ambiguous titles"></textarea>
<button class="primary" id="go">CLASSIFY WITH UDC</button></form><div id="msg"></div></section>
<section id="result" class="card" style="display:none"></section>
<section class="card"><div class="row"><h2 style="margin:0">Recent classifications</h2><button class="secondary small" id="clear">Clear</button></div><div id="history"></div></section>
</main><script>
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function renderHistory(){let a=[];try{a=JSON.parse(localStorage.udcHistory||'[]')}catch(_){}$('history').innerHTML=a.length?a.map(x=>'<div class="hist"><b>'+esc(x.u||'—')+'</b><div>'+esc(x.t)+'</div><div class="muted small">'+esc(x.at)+'</div></div>').join(''):'<div class="muted">No classifications yet.</div>'}
function saveHistory(t,u){let a=[];try{a=JSON.parse(localStorage.udcHistory||'[]')}catch(_){}a.unshift({t,u,at:new Date().toLocaleString()});localStorage.udcHistory=JSON.stringify(a.slice(0,20));renderHistory()}
$('clear').onclick=()=>{localStorage.removeItem('udcHistory');renderHistory()};
$('form').onsubmit=async e=>{e.preventDefault();$('go').disabled=true;$('go').textContent='CLASSIFYING…';$('msg').innerHTML='<div class="loading">Connecting to Gemini…</div>';$('result').style.display='none';
try{const r=await fetch('/api/classify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:$('title').value,author:$('author').value,keywords:$('keywords').value,description:$('description').value})});const d=await r.json().catch(()=>({error:'Server returned invalid JSON.'}));if(!r.ok)throw new Error(d.error||('HTTP '+r.status));show(d);saveHistory($('title').value,d.finalUdc);$('msg').innerHTML='<div class="success">Classification received.</div>'}
catch(err){$('msg').innerHTML='<div class="error"><b>Error:</b> '+esc(err.message)+'</div>'}finally{$('go').disabled=false;$('go').textContent='CLASSIFY WITH UDC'}};
function show(d){const aux=(d.auxiliaries||[]).map(x=>'<li><b>'+esc(x.notation)+'</b> — '+esc(x.purpose)+'</li>').join(''),notes=(d.notation||[]).map(x=>'<li><b>'+esc(x.symbol)+'</b> — '+esc(x.meaning)+'</li>').join(''),alts=(d.alternatives||[]).map(x=>'<li><b>'+esc(x.udc)+'</b> — '+esc(x.whenToUse)+'</li>').join('');
$('result').innerHTML='<div class="row"><div><div class="muted small">PROPOSED UDC NUMBER</div><div class="num">'+esc(d.finalUdc||'—')+'</div></div><span class="pill">'+esc(d.confidence)+'</span></div><div class="section"><b>Main class:</b> '+esc(d.mainClass||'—')+'<br><b>Subject:</b> '+esc(d.mainSubject||'—')+(d.subSubject?'<br><b>Sub-subject:</b> '+esc(d.subSubject):'')+'</div><div class="section"><b>Cataloguer explanation</b><p>'+esc(d.explanation||'—')+'</p></div>'+(aux?'<div class="section"><b>Auxiliaries</b><ul>'+aux+'</ul></div>':'')+(notes?'<div class="section"><b>Notation used</b><ul>'+notes+'</ul></div>':'')+(alts?'<div class="section"><b>Possible alternatives</b><ul>'+alts+'</ul></div>':'')+(d.infoNeeded?'<div class="section"><b>Information needed</b><p>'+esc(d.infoNeeded)+'</p></div>':'')+'<div class="section"><b>Verification:</b> '+esc(d.verificationNote)+'</div><div style="margin-top:14px"><button class="secondary" id="copy">Copy UDC</button></div>';
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(d.finalUdc||'');$('copy').textContent='Copied'}catch(_){$('copy').textContent='Copy failed'}};$('result').style.display='block';$('result').scrollIntoView({behavior:'smooth',block:'start'})}
renderHistory();
</script></body></html>`));

app.listen(PORT,'0.0.0.0',()=>console.log(`UDC Classifier Pro running on port ${PORT}`));
