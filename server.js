const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const PREFERRED_MODEL = process.env.GEMINI_MODEL || "";
const MODEL_CACHE_MS = 10 * 60 * 1000;
let modelCache = { at: 0, names: [] };

const CONFIG = {
  version: "33",
  appTitle: "UDC AI Classifier — 1961 Edition",
  reference: "B.S. 1000A:1961, Abridged English Edition, 3rd Edition Revised 1961",
  rule: "UDC only — never DDC — 1961 edition locked"
};

const UDC_REFERENCE = readText("udc_reference.txt");
const ANSWER_KEYS = loadJson("answer_keys.json")?.keys || {};
const REFERENCE_LINES = UDC_REFERENCE.split(/\r?\n/);

function readText(file) {
  try { return fs.readFileSync(path.join(__dirname, file), "utf8"); }
  catch (e) { console.error(`${file} not found:`, e.message); return ""; }
}
function loadJson(file) {
  try { return JSON.parse(readText(file)); }
  catch (e) { console.error(`${file} invalid:`, e.message); return {}; }
}

function normalizeTitleKey(s) {
  return String(s || "")
    .toLowerCase().normalize("NFKC")
    .replace(/[’‘]/g, "'").replace(/&/g, " and ")
    .replace(/\bvol(?:ume)?\.?\s*\d+\b/g, "")
    .replace(/[^a-z0-9+\/.:()\-\s]/g, " ")
    .replace(/\s+/g, " ").trim();
}

const TITLE_STOP = new Set(["a","an","the","of","and","in","on","for","to","from","by","with","volume","vol"]);
function tokens(s) {
  return new Set(normalizeTitleKey(s).split(" ").filter(x => x.length >= 2 && !TITLE_STOP.has(x)));
}
function jaccard(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0; for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  const score = inter / union;
  // A title containing exactly the key concepts (with harmless title words) is a safe match.
  const containment = inter / Math.min(A.size, B.size);
  return Math.max(score, containment === 1 ? 0.94 : containment * 0.85);
}

function findAnswerKey(title) {
  const exact = ANSWER_KEYS[normalizeTitleKey(title)];
  if (exact) return { key: exact, method: "exact-answer-key", score: 1 };

  let best = null;
  for (const [k, v] of Object.entries(ANSWER_KEYS)) {
    const score = jaccard(title, k);
    if (!best || score > best.score) best = { key: v, matched: k, score, method: "fuzzy-answer-key" };
  }
  // Fuzzy keys are used only when the title is very close; this avoids turning unrelated titles into wrong fixed answers.
  return best && best.score >= 0.94 ? best : null;
}

function normalize(s) {
  return String(s || "").toLowerCase()
    .replace(/[^a-z0-9().:/+=\-\s]/g, " ")
    .replace(/\s+/g, " ").trim();
}

const STOP = new Set([
  "the","a","an","of","and","or","in","on","for","to","with","from","by","about",
  "study","studies","book","books","introduction","general","an","analysis","case","cases",
  "history","use","using","principles","theory"
]);

function referenceSnippets(question, details = "") {
  const q = normalize(`${question} ${details}`);
  const rawWords = q.split(" ").filter(w => w.length >= 3);
  const stop = new Set(["the","and","for","with","from","into","about","book","study","general","introduction","using","use","principles","theory","volume","edition"]);
  const words = [...new Set(rawWords.filter(w => !stop.has(w)))];
  if (!UDC_REFERENCE || !words.length) return "";

  // Phrase-aware retrieval: title phrases receive a large bonus, then individual
  // concepts, so an unfamiliar title still gets the right part of the 1961 index.
  const phrases = [];
  for (let n = Math.min(5, words.length); n >= 2; n--) {
    for (let i = 0; i + n <= words.length; i++) phrases.push(words.slice(i, i+n).join(" "));
  }
  const scored = [];
  for (let i = 0; i < REFERENCE_LINES.length; i++) {
    const lineRaw = REFERENCE_LINES[i];
    const line = normalize(lineRaw);
    if (!line) continue;
    let score = 0;
    for (const w of words) {
      if (line.includes(w)) score += w.length >= 8 ? 5 : w.length >= 6 ? 3 : 1;
    }
    for (const ph of phrases) if (line.includes(ph)) score += Math.min(18, ph.split(" ").length * 5);
    if (/\b(udc|index|history|education|computer|science|literature|language|law|medicine|agriculture)\b/i.test(line)) score += 0.2;
    if (score > 0) {
      const startLine = Math.max(0, i - 2), endLine = Math.min(REFERENCE_LINES.length, i + 4);
      scored.push({ score, block: REFERENCE_LINES.slice(startLine, endLine).join("\n") });
    }
  }
  scored.sort((a,b) => b.score - a.score);
  const out = [], seen = new Set();
  for (const x of scored) {
    const key = x.block.trim();
    if (!seen.has(key)) { seen.add(key); out.push(key); }
    if (out.length >= 40) break;
  }
  return out.join("\n\n");
}

function extractUDC(answer) {
  const text = String(answer || "");
  const m = text.match(/FINAL\s+UDC\s+NUMBER\s*[:\-]?\s*([^\n]+)/i);
  if (m) {
    const candidate = m[1].trim().match(/^[0-9.()=+\/:'\-]+/);
    if (candidate) return candidate[0];
  }
  const fallback = text.match(/\b\d{1,3}(?:\.\d+)*(?:\([^)]*\))?(?:[+/:]\d{1,3}(?:\.\d+)*(?:\([^)]*\))?)*(?:\/\d{1,3}(?:\.\d+)*)?/);
  return fallback ? fallback[0] : "";
}

function classifyProvisional(title, details) {
  const t = normalize(`${title} ${details}`);
  const compound = [
    [/\b(higher education|university|universities|college).{0,35}\b(computer|computers|computing|informatics)\b|\b(computer|computers|computing|informatics)\b.{0,35}\b(higher education|university|universities|college)\b/, "378:681.14", "Higher Education and Computers"],
    [/\b(science)\b.{0,20}\b(and|&)\b.{0,20}\b(art|arts)\b/, "5+7", "Science and Arts"],
    [/\b(knowledge)\b.{0,30}\b(metaphysics)\b.{0,30}\b(logic)\b/, "001+11+16", "Knowledge, Metaphysics and Logic"],
    [/\b(handbook)\b.{0,25}\b(science)\b.{0,25}\b(technology)\b/, "5/6(035)", "Handbook of Science and Technology"]
  ];
  for (const [re, udc, subject] of compound) if (re.test(t)) return {
    udc, subject,
    answer: `FINAL UDC NUMBER: ${udc}\nMAIN SUBJECT: ${subject}\nSHORT EXPLANATION: Compound subject detected and classified using the 1961 UDC answer layer.\nVERIFICATION: REFERENCE-SUPPORTED — exact compound title rule.` ,
    confidence: "High",
    method: "local-compound-1961-rule"
  };
  const rules = [
    [/\b(medicine|medical|clinical|disease|diseases|surgery|nursing|health|pathology|anatomy|physiology|pharmacy|drug|drugs|hospital)\b/, "61", "Medicine and related medical sciences"],
    [/\b(engineering|mechanical|electrical|electronics|telecommunication|civil engineering|construction|technology|manufacturing|machine|machines)\b/, "6", "Applied science and technology"],
    [/\b(computer|computers|computing|programming|software|database|artificial intelligence|ai|informatics|information technology)\b/, "681.3", "Computing and data-processing"],
    [/\b(physics|quantum|mechanics|optics|thermodynamics|electricity|magnetism)\b/, "53", "Physics"],
    [/\b(chemistry|chemical|organic chemistry|inorganic chemistry|biochemistry)\b/, "54", "Chemistry"],
    [/\b(mathematics|algebra|geometry|calculus|statistics|probability)\b/, "51", "Mathematics"],
    [/\b(biology|botany|zoology|ecology|genetics|microbiology|animal|animals|plant|plants)\b/, "57", "Biological sciences"],
    [/\b(agriculture|farming|crop|crops|soil|forestry|fisheries|fishing)\b/, "63", "Agriculture, forestry and fisheries"],
    [/\b(law|legal|constitution|constitutional|jurisprudence|criminal law|civil law)\b/, "34", "Law"],
    [/\b(economics|economy|economic|finance|banking|commerce|business|management|marketing|accounting)\b/, "33", "Economics and related social sciences"],
    [/\b(sociology|society|social|social work|population|demography|education|pedagogy|politics|government|public administration)\b/, "3", "Social sciences"],
    [/\b(philosophy|logic|metaphysics|ethics|epistemology|knowledge)\b/, "1", "Philosophy and psychology"],
    [/\b(religion|religious|christianity|christian|islam|muslim|hinduism|hindu|sikhism|sikh|buddhism|bible|quran|koran)\b/, "2", "Religion and theology"],
    [/\b(language|linguistics|linguistic|grammar|philology|dictionary|lexicon|translation)\b/, "4", "Philology and language"],
    [/\b(literature|literary|poetry|poems|novel|novels|fiction|drama|theatre|theater|plays)\b/, "8", "Literature"],
    [/\b(art|arts|painting|sculpture|music|architecture|photography|cinema|film|sport|sports)\b/, "7", "Arts, entertainment and sport"],
    [/\b(geography|geographical|travel|atlas|maps|mapping|cartography)\b/, "91", "Geography"],
    [/\b(history|historical|biography|biographical|archaeology|civilization|civilisation)\b/, "9", "Geography, biography and history"],
    [/\b(library|libraries|cataloguing|cataloging|bibliography|books|documentation|information science|archives)\b/, "02", "Library science and bibliography"],
    [/\b(science|scientific|natural science)\b/, "5", "Pure science"],
    [/\b(art|arts)\b/, "7", "The arts"]
  ];
  for (const [re, udc, subject] of rules) if (re.test(t)) {
    return {
      udc, subject,
      answer: `FINAL UDC NUMBER: ${udc}\nMAIN SUBJECT: ${subject}\nSHORT EXPLANATION: A provisional broad UDC class was selected from the title/context because the AI reference service was unavailable.\nVERIFICATION: PROVISIONAL — verify the exact notation against the licensed UDC schedule.`,
      confidence: "Low",
      method: "local-provisional-fallback"
    };
  }
  return {
    udc: "0",
    subject: "Generalities — exact subject not resolved",
    answer: `FINAL UDC NUMBER: 0\nMAIN SUBJECT: Generalities — exact subject not resolved\nSHORT EXPLANATION: The title is unfamiliar to the local 1961 rules and no exact source-backed notation was available. The application still returns a valid broad UDC starting class instead of an error.\nVERIFICATION: PROVISIONAL — exact 1961 notation needs the book description, contents, or a verified 1961 schedule entry.`,
    confidence: "Low",
    method: "local-1961-fallback"
  };
}

function answerFromKey(key, method) {
  const verification = method === "exact-answer-key" ? "VERIFIED — exact answer-key match." : "VERIFIED — close title matched to an answer key.";
  return {
    udc: key.udc,
    subject: key.subject,
    answer: `FINAL UDC NUMBER: ${key.udc}\nMAIN SUBJECT: ${key.subject}\nSHORT EXPLANATION: ${key.udc} is the fixed UDC answer stored for this title in the deterministic 1961 answer-key layer. Source: ${key.source || '1961 UDC reference'}.\nVERIFICATION: ${verification}`,
    confidence: method === "exact-answer-key" ? "High" : "Medium-High",
    method
  };
}

function page() {
return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0b1220"><title>UDC AI Classifier V33</title>
<style>
:root{--bg:#f3f6fb;--card:#fff;--ink:#0b1220;--muted:#64748b;--line:#e5eaf1;--accent:#1d4ed8;--accent2:#0f172a;--ok:#0f766e;--warn:#92400e}*{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#eef4ff 0,#f7f9fc 42%,#eef2f7 100%);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}.shell{max-width:1080px;margin:auto;padding:24px 16px 60px}.hero{padding:30px;border-radius:28px;background:linear-gradient(135deg,#0b1220,#172554);color:#fff;box-shadow:0 20px 55px rgba(15,23,42,.18)}.tag{display:inline-flex;padding:7px 11px;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(255,255,255,.08);font-size:12px;font-weight:800;letter-spacing:.04em}.hero h1{font-size:clamp(30px,5vw,52px);line-height:1.02;margin:16px 0 10px}.hero p{margin:0;color:#dbeafe;max-width:760px;line-height:1.6}.grid{display:grid;grid-template-columns:1.45fr .75fr;gap:18px;margin-top:18px}.card{background:rgba(255,255,255,.96);border:1px solid var(--line);border-radius:22px;padding:22px;box-shadow:0 10px 30px rgba(15,23,42,.06)}.card h2{margin:0 0 7px;font-size:20px}.small{color:var(--muted);font-size:13px;line-height:1.5}.label{display:flex;justify-content:space-between;align-items:center;margin:18px 0 8px;font-weight:800;font-size:14px}textarea{width:100%;border:1px solid #cbd5e1;border-radius:15px;padding:15px;font:inherit;font-size:17px;outline:none;min-height:105px;resize:vertical}textarea:focus{border-color:#60a5fa;box-shadow:0 0 0 4px rgba(96,165,250,.16)}button{border:0;border-radius:14px;padding:15px 18px;background:var(--accent2);color:#fff;font-weight:800;font-size:16px;cursor:pointer;width:100%;margin-top:13px}button:hover{transform:translateY(-1px)}button:disabled{opacity:.55;cursor:wait}.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.chip{border:1px solid #dbe2ec;background:#f8fafc;color:#334155;padding:8px 10px;border-radius:999px;cursor:pointer;font-size:12px;font-weight:700}.feature{display:flex;gap:11px;padding:12px 0;border-bottom:1px solid var(--line)}.feature:last-child{border-bottom:0}.dot{width:9px;height:9px;border-radius:50%;background:#2563eb;margin-top:6px;flex:0 0 auto}.status{display:none;margin-top:14px;padding:12px 14px;border-radius:13px;background:#eff6ff;color:#1e3a8a;font-size:13px}.error{display:none;margin-top:14px;padding:12px 14px;border-radius:13px;background:#fff1f2;color:#9f1239;font-size:13px}.result{display:none;margin-top:18px}.resultHead{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.pill{padding:6px 9px;border-radius:999px;font-size:11px;font-weight:900;background:#ecfeff;color:#155e75}.udc{font-size:clamp(38px,7vw,64px);font-weight:900;letter-spacing:-.03em;margin:8px 0}.box{border-top:1px solid var(--line);padding:15px 0}.answer{white-space:pre-wrap;line-height:1.6;font-size:15px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:10px}.meta div{background:#f8fafc;border:1px solid var(--line);border-radius:13px;padding:12px}.meta b{display:block;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px}.footer{margin-top:18px;color:#64748b;font-size:12px;line-height:1.6}.kbd{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#eef2f7;padding:2px 5px;border-radius:5px}.spinner{display:inline-block;width:14px;height:14px;border:2px solid #bfdbfe;border-top-color:#2563eb;border-radius:50%;animation:spin .8s linear infinite;vertical-align:-2px;margin-right:6px}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:820px){.grid{grid-template-columns:1fr}.hero{padding:24px}.card{padding:18px}.meta{grid-template-columns:1fr}}
</style></head><body><main class="shell"><section class="hero"><span class="tag">VERSION 33 • UDC ONLY</span><h1>Universal Decimal Classification AI</h1><p>Enter an English book title. The classifier checks deterministic UDC answer keys first, searches the supplied 1961 UDC reference, then uses an available Gemini model for semantic classification. It is designed to return a result rather than simply failing on unfamiliar titles.</p></section>
<div class="grid"><section class="card"><h2>Classify a Book</h2><div class="small">Best results come from the full title. For an ambiguous title, add a short description or subject.</div><div class="label"><span>Book title</span><span class="small">English</span></div><textarea id="title" placeholder="e.g. History of India"></textarea><div class="label"><span>Optional subject / description</span><span class="small">Recommended for vague titles</span></div><textarea id="details" style="min-height:80px" placeholder="e.g. A study of India's political and social history after independence"></textarea><div class="chips"><button class="chip" type="button" onclick="sample('History of India')">History of India</button><button class="chip" type="button" onclick="sample('Handbook of Systematic Zoology')">Systematic Zoology</button><button class="chip" type="button" onclick="sample('Knowledge, Metaphysics and Logic')">Knowledge &amp; Logic</button><button class="chip" type="button" onclick="sample('Principles of Quantum Computing')">Quantum Computing</button></div><button id="go" onclick="classify()">CLASSIFY BOOK</button><div id="status" class="status"><span class="spinner"></span><span id="statusText">Searching the UDC reference…</span></div><div id="error" class="error"></div><section id="result" class="result"><div class="resultHead"><div><div class="small">FINAL UDC NUMBER</div><div id="udc" class="udc">—</div></div><span id="pill" class="pill">—</span></div><div class="box"><div class="small">MAIN SUBJECT</div><div id="subject" style="font-weight:800;font-size:19px;margin-top:4px">—</div></div><div class="meta"><div><b>Confidence</b><span id="confidence">—</span></div><div><b>Method</b><span id="method">—</span></div></div><div class="box"><div class="small">CLASSIFICATION REPORT</div><div id="answer" class="answer">—</div></div></section></section>
<aside class="card"><h2>How V33 works</h2><div class="feature"><span class="dot"></span><div><b>1. Exact keys</b><div class="small">Known titles are answered deterministically before AI.</div></div></div><div class="feature"><span class="dot"></span><div><b>2. Close-title matching</b><div class="small">Small punctuation/spelling changes can still match a verified key.</div></div></div><div class="feature"><span class="dot"></span><div><b>3. Reference retrieval</b><div class="small">Relevant lines from the supplied UDC reference are sent with the title.</div></div></div><div class="feature"><span class="dot"></span><div><b>4. Semantic AI</b><div class="small">The AI is instructed to classify meaning, not keywords alone.</div></div></div><div class="feature"><span class="dot"></span><div><b>5. No-error fallback</b><div class="small">If Gemini is unavailable, a provisional broad class is returned instead of a server error.</div></div></div><div class="footer"><b>Reference basis:</b> B.S. 1000A:1961, Abridged English Edition, 3rd Edition Revised 1961. For current UDC, use properly licensed current schedules. UDC schedules are copyright/licence-controlled by the UDC Consortium.</div></aside></div></main>
<script>
const $=id=>document.getElementById(id);
function sample(x){$('title').value=x;$('title').focus()}
async function classify(){const title=$('title').value.trim(),details=$('details').value.trim();if(!title){$('error').textContent='Please enter an English book title.';$('error').style.display='block';return}$('error').style.display='none';$('result').style.display='none';$('status').style.display='block';$('go').disabled=true;let timer=setInterval(()=>{const s=['Checking exact answer keys…','Searching the UDC reference…','Understanding the book subject…','Selecting the most specific supported notation…'];$('statusText').textContent=s[Math.floor(Date.now()/1400)%s.length]},700);try{const r=await fetch('/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:title,details})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Classification service failed');$('udc').textContent=d.udc||'—';$('subject').textContent=d.subject||'—';$('confidence').textContent=d.confidence||'—';$('method').textContent=d.method||'—';$('pill').textContent=d.verification||'RESULT';$('answer').textContent=d.answer||'No classification report returned.';$('result').style.display='block'}catch(e){$('error').textContent='The app could not complete this request: '+e.message;$('error').style.display='block'}finally{clearInterval(timer);$('status').style.display='none';$('go').disabled=false}}
$('title').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')classify()});
</script></body></html>`;
}

app.get('/', (req,res)=>res.send(page()));
app.get('/health',(req,res)=>res.json({status:'ok',version:CONFIG.version,referenceLoaded:Boolean(UDC_REFERENCE),answerKeys:Object.keys(ANSWER_KEYS).length,geminiConfigured:Boolean(GEMINI_API_KEY)}));
app.get('/api/config',(req,res)=>res.json({...CONFIG,answerKeys:Object.keys(ANSWER_KEYS).length}));

app.post('/api/ask', async (req,res)=>{
  try {
    const question=String(req.body?.question||'').trim();
    const details=String(req.body?.details||'').trim();
    if(!question) return res.status(400).json({error:'Question required'});

    const keyed=findAnswerKey(question);
    if(keyed){
      const out=answerFromKey(keyed.key,keyed.method);
      return res.json({...out,version:CONFIG.version,verification:keyed.method==='exact-answer-key'?'VERIFIED':'CLOSE KEY MATCH'});
    }

    if(!GEMINI_API_KEY){
      const out=classifyProvisional(question,details);
      return res.json({...out,version:CONFIG.version,verification:'PROVISIONAL'});
    }

    const snippets=referenceSnippets(question,details);
    const prompt=`You are a professional library classifier specializing in Universal Decimal Classification (UDC).\n\nSOURCE BASIS: ${CONFIG.reference}.\n\nCRITICAL RULES:\n- Use UDC only. NEVER output Dewey Decimal Classification (DDC).\n- Classify the intellectual subject of the book, not isolated keywords.\n- Consider the complete title and optional description.\n- Search and use the supplied reference extracts as evidence.\n- Prefer the most specific notation that is actually supported by the supplied reference.\n- Do not invent a plausible-looking number.\n- Apply place, language, form and other auxiliaries only when supported and appropriate.\n- If the exact notation is not established by the supplied source, return the closest supported class and clearly label it as not fully verified.\n- Do not return an error just because the title is unfamiliar. Make the best evidence-based classification possible.\n\nBOOK TITLE:\n${question}\n\nOPTIONAL BOOK DESCRIPTION:\n${details||'(none)'}\n\nRELEVANT REFERENCE EXTRACTS:\n${snippets||'(No direct extract found.)'}\n\nReturn exactly:\nFINAL UDC NUMBER: ...\nMAIN SUBJECT: ...\nSHORT EXPLANATION: ...\nVERIFICATION: VERIFIED / REFERENCE-SUPPORTED / EXACT NOTATION NOT VERIFIED`;

    const body={systemInstruction:{parts:[{text:'You classify books using ONLY the B.S. 1000A:1961 Abridged English UDC edition supplied with this application. Never use DDC and never silently substitute modern UDC/MRF notation. For unfamiliar titles, return the best supported 1961 class rather than an error.'}]},contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.08,maxOutputTokens:800}};

    const available=await listGenerateContentModels().catch(()=>[]);
    const fallback=['gemini-3.8-flash','gemini-3.7-flash','gemini-3.6-flash','gemini-3.5-flash','gemini-2.5-flash-lite'];
    let candidates=[PREFERRED_MODEL,...available,...fallback].filter(Boolean);
    candidates=[...new Set(candidates)].filter(m=>!available.length||available.includes(m));
    if(!candidates.length) candidates=fallback;

    let result=null,lastError='Gemini unavailable';
    for(const model of candidates){
      const attempt=await generateWithModel(model,body,2);
      if(attempt?.response?.ok){result=attempt;break}
      lastError=attempt?.data?.error?.message||`HTTP ${attempt?.response?.status||500}`;
      if([400,401,402,403].includes(attempt?.response?.status)) break;
    }

    if(!result){
      const out=classifyProvisional(question,details);
      return res.json({...out,version:CONFIG.version,verification:'PROVISIONAL',serviceNote:'AI service unavailable; returned local best-effort result instead of an error.'});
    }

    const answer=result.data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('\n')||'';
    const udc=extractUDC(answer);
    return res.json({answer,udc,subject:extractField(answer,'MAIN SUBJECT'),subSubject:extractField(answer,'SUB SUBJECT'),confidence:answer.toLowerCase().includes('not verified')?'Medium':'High',method:'gemini-reference-classification',verification:answer.toLowerCase().includes('not verified')?'REFERENCE-SUPPORTED':'AI CLASSIFICATION',version:CONFIG.version});
  }catch(error){
    console.error(error);
    const out=classifyProvisional(String(req.body?.question||''),String(req.body?.details||''));
    return res.status(200).json({...out,version:CONFIG.version,verification:'PROVISIONAL',serviceNote:'Recovered with local fallback after a service exception.'});
  }
});

function extractField(text,label){const m=String(text||'').match(new RegExp(label+'\\s*[:\\-]\\s*([^\\n]+)','i'));return m?m[1].trim():''}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function isRetryable(s){return [408,429,500,502,503,504].includes(s)}
async function listGenerateContentModels(){
  const now=Date.now();if(modelCache.names.length&&now-modelCache.at<MODEL_CACHE_MS)return modelCache.names;
  if(!GEMINI_API_KEY) return [];
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models',{headers:{'x-goog-api-key':GEMINI_API_KEY}});const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d?.error?.message||`Model list failed (${r.status})`);
  const names=(d.models||[]).filter(m=>Array.isArray(m.supportedGenerationMethods)&&m.supportedGenerationMethods.includes('generateContent')).map(m=>String(m.name||'').replace(/^models\//,'')).filter(Boolean);
  modelCache={at:now,names};return names;
}
async function generateWithModel(model,body,maxRetries=2){
  const url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent';let last=null;
  for(let attempt=0;attempt<=maxRetries;attempt++){
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':GEMINI_API_KEY},body:JSON.stringify(body)});const data=await response.json().catch(()=>({}));
    if(response.ok)return{response,data};last={response,data};if(!isRetryable(response.status)||attempt===maxRetries)break;await sleep(Math.min(7000,1000*2**attempt));
  }return last;
}

app.listen(PORT,()=>console.log(`UDC AI Classifier V${CONFIG.version} running on port ${PORT}; keys=${Object.keys(ANSWER_KEYS).length}`));
