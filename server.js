require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenAI, Type } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const MAIN_CLASSES = {
  '0': 'Science and knowledge. Computer science. Information. Librarianship',
  '1': 'Philosophy. Psychology',
  '2': 'Religion. Theology',
  '3': 'Social sciences',
  '4': 'Vacant',
  '5': 'Mathematics. Natural sciences',
  '6': 'Applied sciences. Medicine. Technology',
  '7': 'Arts. Entertainment. Sport',
  '8': 'Language. Linguistics. Literature',
  '9': 'Geography. Biography. History'
};

let ai;
function getAI() {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!ai) ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return ai;
}

const SYSTEM = `You are a careful Universal Decimal Classification (UDC) cataloguing assistant.
Use UDC ONLY, never DDC or another classification scheme.
Do not invent a UDC number. Base the proposed number on known UDC structure and clearly mark uncertainty.
Distinguish the subject from form, place, language, time and other auxiliary concepts.
Use notation operators only when justified: + coordination, / consecutive extension, : relation, :: order-fixing, [] grouping.
Common auxiliary concepts may be appended only when their use is justified by the title/description.
Do not add an auxiliary merely because it is possible.
If the title is too ambiguous to determine a defensible number, return MORE_INFO_NEEDED instead of guessing.
For literary works, distinguish literature (82) from language/linguistics (81) and identify genre when justified.
For history/geography, identify the actual geographic or historical subject before selecting a detailed number.
Return concise cataloguer-style reasoning, not hidden chain-of-thought.`;

function normalizeResult(r) {
  return {
    status: r.status || 'SUCCESS',
    finalUdc: r.finalUdc || '',
    mainClass: r.mainClass || '',
    mainSubject: r.mainSubject || '',
    subSubject: r.subSubject || '',
    auxiliaries: Array.isArray(r.auxiliaries) ? r.auxiliaries : [],
    notation: Array.isArray(r.notation) ? r.notation : [],
    explanation: r.explanation || '',
    confidence: r.confidence || 'Low',
    infoNeeded: r.infoNeeded || '',
    alternatives: Array.isArray(r.alternatives) ? r.alternatives : [],
    verificationNote: r.verificationNote || 'Verify the final notation against the authoritative UDC schedules before cataloguing.'
  };
}

app.get('/api/health', (req,res) => res.json({
  ok: true,
  geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  model: MODEL,
  googleSearchConfigured: Boolean(process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_CSE_ID)
}));

app.get('/api/classes', (req,res) => res.json(MAIN_CLASSES));

app.post('/api/classify', async (req,res) => {
  try {
    const { title, author='', keywords='', description='' } = req.body || {};
    if (!title || !String(title).trim()) return res.status(400).json({ error: 'Book title is required.' });
    const client = getAI();
    if (!client) return res.status(503).json({ error: 'Gemini API is not configured. Add GEMINI_API_KEY in Render Environment.' });

    const prompt = `Classify this bibliographic item using UDC ONLY.
Title: ${JSON.stringify(String(title).trim())}
Author: ${JSON.stringify(author)}
Keywords: ${JSON.stringify(keywords)}
Description: ${JSON.stringify(description)}

Top-level UDC classes for orientation only:
${Object.entries(MAIN_CLASSES).map(([k,v]) => `${k} — ${v}`).join('\n')}

Return a defensible classification. If the supplied information is insufficient for a specific number, use MORE_INFO_NEEDED rather than guessing.`;

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

    let result;
    try { result = JSON.parse((response.text || '').trim()); }
    catch { return res.status(502).json({ error: 'Gemini returned an invalid classification response. Please try again.' }); }
    res.json(normalizeResult(result));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Classification failed.' });
  }
});

app.get('/', (req,res) => res.send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0b1220"><title>UDC Classifier Pro</title>
<style>
:root{--bg:#07111f;--card:#0e1b2d;--card2:#12243a;--line:#233955;--text:#edf5ff;--muted:#9db0c7;--accent:#55b7ff;--good:#58d68d;--warn:#ffd166;--bad:#ff7b7b}*{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#06101d,#091827 55%,#07111f);color:var(--text);font:15px system-ui,-apple-system,Segoe UI,Roboto,sans-serif}.wrap{max-width:980px;margin:auto;padding:22px}.hero{padding:22px 0}.eyebrow{color:var(--accent);font-weight:800;letter-spacing:.12em;font-size:12px}.hero h1{font-size:34px;margin:6px 0}.hero p{color:var(--muted);margin:0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:760px){.grid{grid-template-columns:1fr}.hero h1{font-size:28px}}.card{background:rgba(14,27,45,.94);border:1px solid var(--line);border-radius:18px;padding:18px;box-shadow:0 14px 40px #0003}.card h2{font-size:16px;margin:0 0 14px}.field{margin:0 0 12px}label{display:block;color:#c7d6e8;font-size:13px;font-weight:700;margin-bottom:6px}input,textarea{width:100%;border:1px solid var(--line);background:#091626;color:var(--text);border-radius:11px;padding:12px;font:inherit;outline:none}textarea{min-height:90px;resize:vertical}input:focus,textarea:focus{border-color:var(--accent)}button{border:0;border-radius:11px;padding:12px 15px;font-weight:800;cursor:pointer}.primary{width:100%;background:var(--accent);color:#04111d}.secondary{background:#172b44;color:var(--text)}button:disabled{opacity:.6;cursor:wait}.result{margin-top:16px}.num{font:800 38px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--accent);word-break:break-all}.row{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}.pill{display:inline-block;padding:5px 9px;border-radius:99px;background:#18324c;color:#bfe3ff;font-size:12px;font-weight:800}.pill.High{background:#123b2a;color:#8ff0b9}.pill.Medium{background:#4a3c10;color:#ffe28c}.pill.Low{background:#452020;color:#ffabab}.muted{color:var(--muted)}.section{margin-top:15px;padding-top:15px;border-top:1px solid var(--line)}ul{margin:8px 0 0;padding-left:20px}.history{display:flex;flex-direction:column;gap:8px}.hist{padding:10px;border:1px solid var(--line);border-radius:10px;background:#0a1727}.small{font-size:12px}.error{color:#ffaaaa;background:#3b1d24;border:1px solid #68313b;padding:11px;border-radius:10px}.notice{color:#ffe29b;background:#342b13;border:1px solid #5c4b1d;padding:11px;border-radius:10px}.loading{color:var(--accent);padding:12px 0}
</style></head><body><main class="wrap"><header class="hero"><div class="eyebrow">UNIVERSAL DECIMAL CLASSIFICATION</div><h1>UDC Classifier Pro</h1><p>Gemini-assisted cataloguing with explicit notation and uncertainty handling.</p></header>
<section class="card"><h2>Book details</h2><form id="form"><div class="field"><label>Book title *</label><input id="title" required placeholder="e.g. History of India" autofocus></div><div class="grid"><div class="field"><label>Author</label><input id="author" placeholder="Optional"></div><div class="field"><label>Keywords</label><input id="keywords" placeholder="Optional"></div></div><div class="field"><label>Description / subject scope</label><textarea id="description" placeholder="Optional — useful when the title is ambiguous"></textarea></div><button class="primary" id="go">CLASSIFY WITH UDC</button></form><div id="msg"></div></section>
<section id="result" class="card result" style="display:none"></section>
<section class="card" style="margin-top:16px"><div class="row"><h2 style="margin:0">Recent classifications</h2><button class="secondary small" onclick="clearHistory()">Clear</button></div><div id="history" class="history" style="margin-top:12px"></div></section>
</main><script>
const $=id=>document.getElementById(id); renderHistory();
$('form').addEventListener('submit',async e=>{e.preventDefault();$('go').disabled=true;$('go').textContent='CLASSIFYING…';$('msg').innerHTML='<div class="loading">Analyzing subject, notation and auxiliaries…</div>';$('result').style.display='none';try{const r=await fetch('/api/classify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:$('title').value,author:$('author').value,keywords:$('keywords').value,description:$('description').value})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Request failed');show(d);saveHistory($('title').value,d.finalUdc)}catch(err){$('msg').innerHTML='<div class="error">'+esc(err.message)+'</div>'}finally{$('go').disabled=false;$('go').textContent='CLASSIFY WITH UDC'}});
function show(d){$('msg').innerHTML=d.status==='MORE_INFO_NEEDED'?'<div class="notice">More information is needed before a specific UDC number can be defended.</div>':'';const aux=(d.auxiliaries||[]).map(x=>'<li><b>'+esc(x.notation)+'</b> — '+esc(x.purpose)+'</li>').join('');const notes=(d.notation||[]).map(x=>'<li><b>'+esc(x.symbol)+'</b> — '+esc(x.meaning)+'</li>').join('');const alts=(d.alternatives||[]).map(x=>'<li><b>'+esc(x.udc)+'</b> — '+esc(x.whenToUse)+'</li>').join('');$('result').innerHTML='<div class="row"><div><div class="muted small">PROPOSED UDC NUMBER</div><div class="num">'+esc(d.finalUdc||'—')+'</div></div><span class="pill '+esc(d.confidence)+'">'+esc(d.confidence)+' confidence</span></div><div class="section"><b>Main class:</b> '+esc(d.mainClass||'—')+'<br><b>Subject:</b> '+esc(d.mainSubject||'—')+(d.subSubject?'<br><b>Sub-subject:</b> '+esc(d.subSubject):'')+'</div><div class="section"><b>Cataloguer explanation</b><p>'+esc(d.explanation||'—')+'</p></div>'+(aux?'<div class="section"><b>Auxiliaries</b><ul>'+aux+'</ul></div>':'')+(notes?'<div class="section"><b>Notation used</b><ul>'+notes+'</ul></div>':'')+(alts?'<div class="section"><b>Possible alternatives</b><ul>'+alts+'</ul></div>':'')+(d.infoNeeded?'<div class="section"><b>Information needed</b><p>'+esc(d.infoNeeded)+'</p></div>':'')+'<div class="section notice"><b>Verification:</b> '+esc(d.verificationNote)+'</div><div style="margin-top:14px"><button class="secondary" onclick="navigator.clipboard.writeText('+JSON.stringify(d.finalUdc||'')+');this.textContent=\'Copied\'">Copy UDC</button></div>';$('result').style.display='block';window.scrollTo({top:$('result').offsetTop-12,behavior:'smooth'})}
function saveHistory(t,u){let a=JSON.parse(localStorage.udcHistory||'[]');a.unshift({t,u,at:new Date().toLocaleString()});localStorage.udcHistory=JSON.stringify(a.slice(0,20));renderHistory()}function renderHistory(){let a=JSON.parse(localStorage.udcHistory||'[]');$('history').innerHTML=a.length?a.map(x=>'<div class="hist"><b>'+esc(x.u||'—')+'</b><div>'+esc(x.t)+'</div><div class="muted small">'+esc(x.at)+'</div></div>').join(''):'<div class="muted">No classifications yet.</div>'}function clearHistory(){localStorage.removeItem('udcHistory');renderHistory()}function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
</script></body></html>`));

app.listen(PORT, '0.0.0.0', () => console.log(`UDC Classifier Pro running on port ${PORT}`));
