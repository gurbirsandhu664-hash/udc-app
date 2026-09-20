import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({limit:"1mb"}));
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
const GROQ_KEY = process.env.GROQ_API_KEY || "";

const GEMINI_MODELS = [
  process.env.GEMINI_MODEL || "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash"
];

const schema = {
  type: "object",
  properties: {
    title: {type:"string"},
    udc_number: {type:"string"},
    main_subject: {type:"string"},
    sub_subject: {type:"string"},
    explanation: {type:"string"},
    breakdown: {type:"string"},
    confidence: {type:"string"},
    evidence_summary: {type:"string"},
    sources: {type:"array", items:{type:"string"}}
  },
  required:["title","udc_number","main_subject","sub_subject","explanation","breakdown","confidence","evidence_summary","sources"]
};

const systemInstruction = `
You are the UDC classification engine for a professional library classifier.
Use UNIVERSAL DECIMAL CLASSIFICATION (UDC), NOT Dewey Decimal Classification.
The target is the UDC Abridged Edition where the requested subject is covered.
Interpret the whole title semantically. Do not classify from one keyword only.

Workflow:
1) Search the web when Google Search grounding is available.
2) Prefer authoritative UDC-related evidence and reputable library/catalogue records.
3) Reconstruct notation using UDC hierarchy and standard auxiliaries only when supported.
4) Consider common auxiliaries, place auxiliaries, language auxiliaries, form auxiliaries,
   time auxiliaries, point-of-view auxiliaries, relation/extension signs, colon, plus,
   slash, brackets and other UDC syntax when genuinely applicable.
5) Do NOT use DDC numbers.
6) Give one best final UDC number. Never output "0", blank, null, or "unknown".
7) If an exact official UDC Abridged entry cannot be verified online, still give the
   most defensible UDC candidate based on UDC structure, but clearly lower confidence
   and explain that it is a reasoned classification rather than an official catalogue match.
8) Never invent a fake citation. Sources must be real URLs returned/known from the search.
9) Keep the final number concise and valid UDC notation.
10) For literature, distinguish language/literature class and literary form where title
    supports it. For a translation, use language auxiliaries only when justified.
Return JSON only matching the schema.
`;

function cleanJson(text) {
  if (!text) throw new Error("Empty model response");
  let s = text.trim().replace(/^```json\s*/i,"").replace(/^```\s*/,"").replace(/```$/,"").trim();
  const first = s.indexOf("{"), last = s.lastIndexOf("}");
  if (first >= 0 && last > first) s = s.slice(first,last+1);
  return JSON.parse(s);
}

function normalizeResult(r, title, meta={}) {
  const out = {
    title: r?.title || title,
    udc_number: String(r?.udc_number || "").trim(),
    main_subject: r?.main_subject || "Subject classification",
    sub_subject: r?.sub_subject || "General",
    explanation: r?.explanation || "Classified from the title using UDC principles.",
    breakdown: r?.breakdown || "",
    confidence: r?.confidence || "Model assessed",
    evidence_summary: r?.evidence_summary || "",
    sources: Array.isArray(r?.sources) ? r.sources.filter(Boolean).slice(0,8) : [],
    engine: meta.engine || "Gemini",
    model: meta.model || "",
    grounded: !!meta.grounded
  };
  // Never let a malformed model response become a fake zero.
  if (!out.udc_number || out.udc_number === "0" || out.udc_number.toLowerCase()==="null") {
    throw new Error("Model returned no usable UDC notation");
  }
  return out;
}

async function geminiInteraction(ai, model, title, grounded=true) {
  const input = `${systemInstruction}

BOOK TITLE:
${title}

Return the single best UDC classification. The user needs an answer, not a refusal.`;

  const opts = {
    model,
    input,
    system_instruction: systemInstruction,
    response_format: {type:"text", mime_type:"application/json", schema},
    generation_config: {max_output_tokens:1200}
  };
  if (grounded) opts.tools = [{type:"google_search"}];

  const interaction = await ai.interactions.create(opts);
  if (interaction.status && ["failed","cancelled"].includes(interaction.status))
    throw new Error(`Gemini interaction ${interaction.status}`);
  return {data: cleanJson(interaction.output_text), grounded};
}

async function geminiLegacy(ai, model, title, grounded=true) {
  const config = {
    responseMimeType:"application/json",
    responseSchema:schema,
    systemInstruction
  };
  if (grounded) config.tools = [{googleSearch:{}}];
  const response = await ai.models.generateContent({
    model,
    contents: `${systemInstruction}\n\nBOOK TITLE:\n${title}`,
    config
  });
  return {data: cleanJson(response.text), grounded};
}

async function callGemini(title) {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY is not configured");
  const ai = new GoogleGenAI({apiKey:GEMINI_KEY});
  const errors = [];

  // Primary: current Interactions API + Google Search grounding.
  for (const model of GEMINI_MODELS) {
    try {
      const x = await geminiInteraction(ai, model, title, true);
      return normalizeResult(x.data,title,{engine:"Gemini + Google Search",model,grounded:true});
    } catch(e) { errors.push(`${model}/search: ${e.message}`); }
  }

  // Fallback: current Interactions API without search.
  for (const model of GEMINI_MODELS) {
    try {
      const x = await geminiInteraction(ai, model, title, false);
      return normalizeResult(x.data,title,{engine:"Gemini fallback",model,grounded:false});
    } catch(e) { errors.push(`${model}/no-search: ${e.message}`); }
  }

  // Compatibility fallback for transient Interactions API failures.
  for (const model of GEMINI_MODELS) {
    try {
      const x = await geminiLegacy(ai, model, title, true);
      return normalizeResult(x.data,title,{engine:"Gemini legacy + Google Search",model,grounded:true});
    } catch(e) { errors.push(`${model}/legacy-search: ${e.message}`); }
  }

  for (const model of GEMINI_MODELS) {
    try {
      const x = await geminiLegacy(ai, model, title, false);
      return normalizeResult(x.data,title,{engine:"Gemini legacy fallback",model,grounded:false});
    } catch(e) { errors.push(`${model}/legacy: ${e.message}`); }
  }

  throw new Error(errors.slice(-6).join(" | "));
}

async function callGroq(title) {
  if (!GROQ_KEY) throw new Error("GROQ_API_KEY is not configured");
  const prompt = `Research this book title for Universal Decimal Classification (UDC), not DDC:
"${title}"
Find likely UDC notation, authoritative/reputable web evidence, and explain the relevant UDC hierarchy.
Do not invent sources. This is research support for a separate final classifier.`;
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":`Bearer ${GROQ_KEY}`},
    body:JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      messages:[{role:"system",content:"You are a UDC research assistant. UDC only, never DDC."},{role:"user",content:prompt}],
      temperature:0.1,
      max_tokens:1200
    })
  });
  if (!r.ok) throw new Error(`Groq HTTP ${r.status}`);
  const j = await r.json();
  return j?.choices?.[0]?.message?.content || "";
}

app.get("/", (_req,res)=>res.sendFile(path.join(__dirname,"index.html")));
app.get("/api/health", (_req,res)=>res.json({
  ok:true, version:"V38", gemini:!!GEMINI_KEY, groq:!!GROQ_KEY,
  models:GEMINI_MODELS
}));

app.post("/api/classify", async (req,res)=>{
  const title = String(req.body?.title || "").trim();
  if (!title) return res.status(400).json({error:"Enter a book title."});

  let research = "";
  let groqStatus = "not configured";
  if (GROQ_KEY) {
    try { research = await callGroq(title); groqStatus="available"; }
    catch(e) { groqStatus="fallback unavailable"; }
  }

  try {
    // Add Groq research as non-authoritative context to Gemini.
    const old = globalThis.__unused;
    const result = await callGemini(title);
    result.groq = groqStatus;
    result.research_used = !!research;
    // We intentionally do not splice unverified Groq output into the final result.
    return res.json(result);
  } catch(e) {
    return res.status(502).json({
      error:"All configured Gemini classification paths failed.",
      detail:e.message,
      groq:groqStatus,
      hint:"Check GEMINI_API_KEY in Render Environment Variables and redeploy."
    });
  }
});

app.listen(PORT,()=>console.log(`UDC One-Click V38 listening on ${PORT}`));
