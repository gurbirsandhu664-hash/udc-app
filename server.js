import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "96kb" }));
app.use(express.static(__dirname));

const port = Number(process.env.PORT || 10000);
const geminiModels = [...new Set((process.env.GEMINI_MODELS || process.env.GEMINI_MODEL || "gemini-2.5-flash,gemini-2.5-flash-lite")
  .split(",").map(x => x.trim()).filter(Boolean))];
const groqModel = process.env.GROQ_MODEL || "groq/compound";

function keys(primary, plural) {
  return [...new Set([process.env[plural] || "", process.env[primary] || ""])
    .flatMap(v => v.split(",")).map(v => v.trim()).filter(Boolean)];
}
const geminiKeys = () => keys("GEMINI_API_KEY", "GEMINI_API_KEYS");
const groqKeys = () => keys("GROQ_API_KEY", "GROQ_API_KEYS");

function normalizeRecord(x, fallbackTitle = "") {
  if (!x || typeof x !== "object") return null;
  const title = String(x.title ?? x.bookTitle ?? x.name ?? fallbackTitle).trim();
  const udc = String(x.udc ?? x.number ?? x.classification ?? x.classificationNumber ?? "").trim();
  if (!title || !udc || ["0", "-", "—"].includes(udc)) return null;
  return {
    title, udc,
    mainSubject: String(x.mainSubject ?? x.subject ?? x.main_subject ?? ""),
    subSubject: String(x.subSubject ?? x.sub_subject ?? ""),
    explanation: String(x.explanation ?? x.breakdown ?? x.notes ?? ""),
    confidence: x.confidence || "High",
    verified: x.verified !== false
  };
}

function loadLocal() {
  for (const name of ["udc-2700-key.json", "udc-key.json", "udc-2600-key.json"]) {
    const p = path.join(__dirname, name);
    if (!fs.existsSync(p)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(p, "utf8"));
      let arr = Array.isArray(raw) ? raw : (raw.records || raw.entries || raw.data || []);
      if (!Array.isArray(arr) && raw && typeof raw === "object") {
        arr = Object.entries(raw).map(([k, v]) => typeof v === "object" ? { ...v, title: v.title || k } : { title: k, udc: v });
      }
      const loaded = arr.map(x => normalizeRecord(x)).filter(Boolean);
      if (loaded.length) return { records: loaded, file: name };
    } catch (e) { console.error(`${name} load error:`, e.message); }
  }
  return { records: [], file: null };
}
const localState = loadLocal();
const local = localState.records;

function norm(s) {
  return String(s || "").toLowerCase().normalize("NFKD")
    .replace(/[“”"'`’]/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

// High-confidence built-ins for common titles used by the app. These are
// deterministic test/lookup records and never depend on an API quota.
const CORE = [
  ["Education", "37", "Education", "", "37 = Education in UDC."],
  ["History of India", "94(540)", "History of India", "India", "94 = History; (540) = India."],
  ["Geography of India", "91(540)", "Geography of India", "India", "91 = Geography; (540) = India."],
  ["Indian Constitution", "342(540)", "Law — constitutional law", "India", "342 = Constitutional law; (540) = India."],
  ["Economy of India", "330(540)", "Economics", "India", "330 = Economics; (540) = India."],
  ["Indian Philosophy", "1(540)", "Philosophy", "India", "1 = Philosophy; (540) = India."],
  ["Indian Art", "7(540)", "Arts", "India", "7 = Arts; (540) = India."],
  ["Indian Literature", "821.21(540)", "Indian literature", "India", "821.21 = Indian literature; (540) = India."],
  ["English Drama", "821.111-2", "English literature", "Drama", "821.111 = English literature; -2 = drama literary form."],
  ["Drama in English", "821.111-2", "English literature", "Drama", "821.111 = English literature; -2 = drama literary form."],
  ["Hindi Language", "811.214.21", "Hindi language", "Language", "811.214.21 = Hindi language."],
  ["Hindi Literature", "821.214.21", "Hindi literature", "Literature", "821.214.21 = Hindi literature."],
  ["Hindi Drama", "821.214.21-2", "Hindi literature", "Drama", "821.214.21 = Hindi literature; -2 = drama literary form."],
  ["Science and Technology", "5/6", "Mathematics and natural sciences / applied sciences and technology", "", "5 = mathematics and natural sciences; 6 = applied sciences, medicine and technology; / joins consecutive classes."],
  ["Library Classification", "025.42", "Library and information science — classification", "", "025.42 = library classification."],
  ["Classification of Books", "025.42", "Library and information science — classification", "", "025.42 = library classification."],
  ["Library Classification: A Practice Manual", "025.42(035)", "Library and information science — classification", "Handbooks / manuals", "025.42 = library classification; (035) = handbook/manual form."],
].map(([title, udc, mainSubject, subSubject, explanation]) => ({title, udc, mainSubject, subSubject, explanation, confidence:"High", verified:true}));

const directRecords = [...CORE, ...local];

const STOP = new Set(["the","a","an","of","for","and","in","on","to","with","by","from","about"]);
const GENERIC = new Set(["book","books","textbook","textbooks","study","studies","guide","guides","manual","handbook","workbook","introduction","introductory","edition","revised","volume","vol","part","course","notes","practice"]);

function words(s) { return norm(s).split(" ").filter(Boolean); }
function canonical(s) {
  return words(s).filter(w => !STOP.has(w)).join(" ");
}
function stripped(s) {
  return words(s).filter(w => !GENERIC.has(w)).join(" ");
}
function aliases(r) {
  const n = norm(r.title);
  const out = new Set([n, canonical(r.title), stripped(r.title)]);
  // Safe punctuation/article variants only. Never invent subject synonyms.
  out.add(n.replace(/\bthe\b/g, " ").replace(/\s+/g, " ").trim());
  return [...out].filter(Boolean);
}

const directIndex = new Map();
for (const r of directRecords) for (const a of aliases(r)) if (!directIndex.has(a)) directIndex.set(a, r);

function directMatch(title) {
  const q = norm(title);
  if (!q) return null;
  return directIndex.get(q) || directIndex.get(canonical(title)) || directIndex.get(stripped(title)) || null;
}

// Conservative fuzzy matching: only accept a local record when the wording is
// nearly identical and there is no close competing record. This increases hit
// rate without turning a merely related title into a fake classification.
function fuzzyLocal(title, limit = 7) {
  const q = words(title);
  if (!q.length) return [];
  const qs = new Set(q);
  const scored = directRecords.map(r => {
    const rw = words(r.title), rs = new Set(rw);
    let inter = 0; for (const w of qs) if (rs.has(w)) inter++;
    const precision = inter / qs.size;
    const recall = inter / (rw.length || 1);
    const contain = norm(r.title).includes(norm(title)) || norm(title).includes(norm(r.title));
    const score = (precision * 0.55) + (recall * 0.35) + (contain ? 0.10 : 0);
    return {r, score, precision, recall};
  }).sort((a,b)=>b.score-a.score);
  return scored.filter(x => x.score >= 0.88 && x.precision >= 0.80).slice(0, limit);
}

function localCandidates(title, limit = 8) {
  return fuzzyLocal(title, limit).map(x => ({title:x.r.title, udc:x.r.udc, subject:x.r.mainSubject, score:Number(x.score.toFixed(3))}));
}

const SYSTEM = `
You are the FINAL UDC classification engine for a professional library application.
UDC ONLY. NEVER DDC.

Goal: classify the meaning of a BOOK TITLE, not merely keywords.
Priority of evidence: exact/direct UDC data > authoritative UDC Summary/UDC Consortium evidence > reputable library/catalogue evidence > model reasoning.

Rules:
1. The FINAL answer must be a UDC number. Never use DDC.
2. Never output 0, -, or a fabricated placeholder as a classification.
3. Prefer the most specific defensible UDC number supported by evidence.
4. Apply common and special auxiliaries only when supported. Handle language, form, place, time, literary form, and relations correctly.
5. Correctly distinguish language, literature, literary form, subject, geography, history, religion, social sciences, science, technology and library/information science.
6. For a title that exactly matches a supplied direct UDC record, preserve that record exactly.
7. If research is supplied by another model, treat it only as evidence. You make the final decision.
8. If evidence is incomplete, you may still provide a Gemini FINAL classification when it is a defensible UDC classification, but label confidence honestly and do not call it independently verified unless grounding/evidence exists.
9. Return JSON only.

JSON:
{"verified":true,"udc":"...","title":"...","mainSubject":"...","subSubject":"...","explanation":"...","confidence":"High|Medium|Low","evidence":"...","sources":[{"title":"...","url":"https://..."}]}
`;

function extractJSON(text) {
  const s = String(text || "").trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(s); } catch {}
  const a=s.indexOf("{"), b=s.lastIndexOf("}");
  if(a>=0 && b>a) { try { return JSON.parse(s.slice(a,b+1)); } catch {} }
  return null;
}
function groundingSources(resp) {
  const out=[];
  const chunks=resp?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  for(const c of chunks){ const w=c?.web; if(w?.uri) out.push({title:w.title||w.uri,url:w.uri}); }
  return [...new Map(out.map(x=>[x.url,x])).values()].slice(0,8);
}
function groqSources(msg) {
  const out=[];
  for(const tool of (msg?.executed_tools||[])){
    for(const r of (tool?.search_results||[])){ const u=r?.url||r?.link||r?.source_url; if(u) out.push({title:r?.title||u,url:u}); }
    if(typeof tool?.output === "string") for(const u of tool.output.match(/https?:\/\/[^\s"'<>]+/g)||[]) out.push({title:"Groq research",url:u.replace(/[),.;]+$/g,"")});
  }
  return [...new Map(out.map(x=>[x.url,x])).values()].slice(0,8);
}
function isQuotaError(e){ return /quota|rate.?limit|resource.?exhausted|429|too many requests|billing/i.test(String(e?.message||e||"")); }
function validShape(r){ const u=String(r?.udc||"").trim(); return !!r && r.verified===true && !!u && !["0","-","—"].includes(u); }

async function geminiAttempt(key, title, research=null) {
  let lastErr;
  for(const model of geminiModels){
    try{
      const ai=new GoogleGenAI({apiKey:key});
      const candidates=localCandidates(title,8);
      const prompt=`${SYSTEM}\nTITLE: ${title}\n\nDIRECT-KEY CANDIDATES (reference only; exact matches were already handled):\n${JSON.stringify(candidates)}\n\n${research?`SECONDARY RESEARCH (not final authority):\n${JSON.stringify(research)}\n`:""}\nUse Google Search grounding to verify UDC evidence where possible. Search for the exact UDC subject/notation and prefer UDC Consortium / UDC Summary or reputable library sources. Then make the FINAL Gemini decision. Return JSON only.`;
      const resp=await ai.models.generateContent({model,contents:prompt,config:{tools:[{googleSearch:{}}]}});
      const parsed=extractJSON(resp.text);
      if(!parsed) throw new Error("Gemini returned non-JSON");
      const sources=groundingSources(resp);
      if(validShape(parsed)) return {...parsed,verified:true,udc:String(parsed.udc).trim(),sources};
      return {...parsed,verified:false,udc:"",sources,confidence:"Not verified"};
    }catch(e){ lastErr=e; if(!isQuotaError(e)) console.error("Gemini:",e.message); }
  }
  throw lastErr || new Error("Gemini unavailable");
}

async function groqResearch(key,title){
  const groq=new Groq({apiKey:key,defaultHeaders:{"Groq-Model-Version":"latest"}});
  const r=await groq.chat.completions.create({
    model:groqModel,
    messages:[{role:"system",content:SYSTEM},{role:"user",content:`Find supporting UDC evidence for this title. Research only; do NOT act as final classifier. TITLE: ${title}. Return concise JSON.`}],
    temperature:0.1,
    compound_custom:{tools:{enabled_tools:["web_search","visit_website"]}}
  });
  const msg=r?.choices?.[0]?.message;
  return {content:msg?.content||"", sources:groqSources(msg)};
}

function clean(r,title,provider,grounded=false){
  const u=String(r?.udc||"").trim();
  if(!r || !r.verified || !u || ["0","-","—"].includes(u)) return {
    verified:false,title,message:"No usable UDC number was produced. No number was invented.",providerStatus:"NOT VERIFIED",verificationLabel:"VERIFICATION REQUIRED",sources:r?.sources||[]
  };
  let label="Gemini FINAL";
  if(provider==="local") label="✓ Direct UDC key match";
  else if(provider==="gemini") label=grounded?"✓ Gemini FINAL · Google grounded":"✓ Gemini FINAL · AI";
  else label="Gemini FINAL";
  return {verified:true,title:r.title||title,udc:u,mainSubject:r.mainSubject||"",subSubject:r.subSubject||"",explanation:r.explanation||r.evidence||"",confidence:r.confidence||"Medium",verificationLabel:label,providerStatus:provider==="local"?"DIRECT UDC MATCH · 2701-TITLE KEY":grounded?"GEMINI FINAL · GOOGLE GROUNDED":"GEMINI FINAL · AI",sources:r.sources||[]};
}

app.get("/api/health",(req,res)=>res.json({ok:true,version:"V26.0",localKeyRecords:local.length,coreRecords:CORE.length,totalDirectRecords:directRecords.length,localKeyFile:localState.file,geminiKeys:geminiKeys().length,groqKeys:groqKeys().length,googleGrounding:"Gemini Google Search"}));

app.post("/api/classify",async(req,res)=>{
  const title=String(req.body?.title||req.body?.bookTitle||req.body?.query||"").trim();
  const aiEnabled=req.body?.ai!==false;
  const useGroqResearch=req.body?.groqResearch!==false;
  if(!title) return res.status(400).json({verified:false,message:"Enter a book title."});

  // 1) Exact/direct match: quota-free and deterministic.
  const hit=directMatch(title);
  if(hit) return res.json({...clean(hit,title,"local"),matchType:"direct"});

  // 2) Very-close local match: only accept if wording is nearly identical.
  const near=fuzzyLocal(title,2);
  if(near.length===1 && near[0].score>=0.94 && near[0].precision>=0.88){
    return res.json({...clean(near[0].r,title,"local"),matchType:"direct-near",providerStatus:"DIRECT UDC MATCH · CLOSE TITLE KEY"});
  }

  if(!aiEnabled) return res.json({verified:false,title,message:"No direct UDC-key match for this wording. AI fallback is OFF.",providerStatus:"DIRECT KEY ONLY · NO MATCH",verificationLabel:"DIRECT MATCH NOT FOUND",suggestions:localCandidates(title),sources:[]});

  // 3) Gemini is always the only AI FINAL publisher.
  let quota=false;
  for(const key of geminiKeys()){
    try{
      const r=await geminiAttempt(key,title);
      if(validShape(r)) return res.json({...clean(r,title,"gemini",(r.sources||[]).length>0),matchType:"gemini-final"});
    }catch(e){ quota ||= isQuotaError(e); }
  }

  // 4) Optional Groq research, followed by Gemini FINAL. Groq output is never
  // exposed as a classification result.
  if(useGroqResearch && groqKeys().length && geminiKeys().length){
    let research=null;
    for(const key of groqKeys()){
      try{ research=await groqResearch(key,title); if(research?.sources?.length || research?.content) break; }
      catch(e){ console.error("Groq research:",e.message); }
    }
    if(research){
      for(const key of geminiKeys()){
        try{
          const r=await geminiAttempt(key,title,research);
          if(validShape(r)) return res.json({...clean(r,title,"gemini",(r.sources||[]).length>0),matchType:"gemini-after-research"});
        }catch(e){ quota ||= isQuotaError(e); }
      }
    }
  }

  // 5) Clear status, never a fake number. Show close direct-key candidates.
  return res.json({verified:false,title,message:quota?"Gemini API quota/rate limit prevented a final AI answer. No Groq number was used as the final answer.":"No reliable UDC final answer was produced for this title.",providerStatus:quota?"GEMINI QUOTA LIMIT · NO FINAL ANSWER":"NOT VERIFIED",verificationLabel:"VERIFICATION REQUIRED",suggestions:localCandidates(title,8),sources:[]});
});

app.use((req,res)=>res.sendFile(path.join(__dirname,"index.html")));
app.listen(port,()=>console.log(`UDC Ultimate V26.0 running on port ${port}`));
