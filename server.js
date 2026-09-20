const express = require("express");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

const app = express();
app.use(express.json({limit:"64kb"}));
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 10000;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const SYSTEM = `
You are the UDC Classification Engine for a professional library classifier.
Your task is to classify book titles using UNIVERSAL DECIMAL CLASSIFICATION (UDC), never DDC.

IMPORTANT ACCURACY RULES:
1. Analyze the complete meaning of the title, not isolated keywords.
2. Determine the principal subject first.
3. Consider language, literature form, place, time, document form, materials, persons, processes, relations and other UDC facets only when supported by the title.
4. UDC is analytico-synthetic. Respect UDC syntax and notation signs such as +, /, :, ::, [], *, A/Z and auxiliary notation.
5. Common auxiliaries include language =..., form (0...), place (1/9), ethnicity/nationality (=...), time "..." and general characteristics -0...; special auxiliaries may apply only within their authorized subject area.
6. Do NOT use DDC numbers.
7. Do NOT invent a number merely because it looks plausible.
8. Google Search grounding is evidence, not permission to copy an unrelated number.
9. Prefer UDC Consortium sources and authorized/licensed UDC material. If an exact UDC classmark cannot be verified from reliable evidence, return udc as "REQUIRES VERIFICATION" rather than hallucinating.
10. The included JSON must be valid and must contain exactly these keys:
title, udc, subject, sub_subject, context, breakdown, explanation, confidence, status
breakdown must be an array of short strings.
confidence must be one of: High, Medium, Low, Requires verification.
status must clearly say whether the answer is reference-supported, search-supported, or requires verification.
11. If sources are available, cite their URLs in a separate sources array. Never claim a source says a number unless the source actually supports it.
12. For a title with insufficient detail, explain what information is missing rather than guessing.

Return JSON only.
`;

app.post("/api/classify", async (req,res)=>{
  const title = String(req.body?.title || "").trim();
  if(!title) return res.status(400).json({error:"Book title is required."});
  if(!process.env.GEMINI_API_KEY) {
    return res.status(500).json({error:"GEMINI_API_KEY is not configured on the Render server."});
  }
  try {
    const ai = new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
    const prompt = `${SYSTEM}

CLASSIFY THIS BOOK TITLE:
"${title}"

Use Google Search grounding when it can improve verification. Prefer searches around:
- UDC Consortium official notation/structure pages
- the exact title/subject plus UDC
- reliable library/catalogue records where they explicitly show UDC
Do not treat a random search snippet as authoritative.

Return JSON only.`;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        tools: [{googleSearch: {}}],
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    });

    let text = response.text || "";
    text = text.replace(/^```json\s*/i,"").replace(/```\s*$/,"").trim();
    let out;
    try { out = JSON.parse(text); }
    catch (_) {
      return res.status(502).json({error:"Gemini returned a non-JSON answer.", raw:text.slice(0,1000)});
    }

    out.title = title;
    out.breakdown = Array.isArray(out.breakdown) ? out.breakdown : [];
    out.sources = Array.isArray(out.sources) ? out.sources : [];
    if(!out.udc) out.udc = "REQUIRES VERIFICATION";
    if(!out.status) out.status = "Requires verification";
    if(!out.confidence) out.confidence = "Requires verification";
    return res.json(out);
  } catch(err) {
    console.error(err);
    return res.status(500).json({error:"Gemini classification failed.", detail:String(err.message || err)});
  }
});

app.get("/api/health",(req,res)=>res.json({ok:true, model:MODEL, geminiConfigured:Boolean(process.env.GEMINI_API_KEY)}));
app.listen(PORT,()=>console.log(`UDC AI Classifier v48 running on ${PORT}`));
