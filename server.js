import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import Groq from "groq-sdk";

dotenv.config();

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

const PORT = Number(process.env.PORT || 10000);
const geminiModels = (process.env.GEMINI_MODELS || "gemini-3.8-flash,gemini-3.6-flash")
  .split(",").map(s => s.trim()).filter(Boolean);

const outputSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    udcNumber: { type: Type.STRING },
    mainSubject: { type: Type.STRING },
    subSubject: { type: Type.STRING },
    explanation: { type: Type.STRING },
    notationBreakdown: { type: Type.STRING },
    confidence: { type: Type.STRING, enum: ["High", "Medium", "Low", "Unverified"] },
    verification: { type: Type.STRING, enum: ["Verified", "Supported", "Unverified"] },
    evidenceSummary: { type: Type.STRING },
    sources: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          url: { type: Type.STRING },
          relevance: { type: Type.STRING }
        },
        required: ["title", "url", "relevance"]
      }
    }
  },
  required: [
    "title","udcNumber","mainSubject","subSubject","explanation",
    "notationBreakdown","confidence","verification","evidenceSummary","sources"
  ]
};

const SYSTEM = `
You are the FINAL UDC classification engine for a professional Universal Decimal Classification
(UDC) title classifier.

NON-NEGOTIABLE:
1. UDC ONLY. Never use DDC, LCC, NLM or another scheme.
2. Gemini is the final decision-maker. Do not mention Groq as the final answer.
3. Use Google Search grounding when useful. Search for authoritative/public UDC evidence and
   reputable library/catalogue evidence. Prefer UDC Consortium or authorized UDC material when
   publicly available, then reputable library/catalogue records and institutional sources.
4. Do not pretend that a proprietary UDC Master Reference File or licensed Abridged Edition was
   accessed if it was not.
5. Understand the whole title, not isolated keywords.
6. Apply UDC main classes, common auxiliaries, special auxiliaries, language, form, place, time,
   point of view, relation/extension symbols and other notation only when justified by evidence.
7. Do not invent a UDC number merely to avoid an empty result. If evidence is insufficient, return
   verification="Unverified" and udcNumber="" rather than fabricating.
8. When an exact number is supported, give the exact notation and a short breakdown.
9. If several plausible numbers exist, choose only when evidence and UDC logic support one; otherwise
   explain the ambiguity and mark Unverified.
10. "Abridged" means use the abridged-compatible level when evidence supports it. Do not claim an
    exact Abridged Edition entry unless a source actually supports that claim.
11. Return ONLY the requested JSON object. No markdown fences.
`;

function cleanJson(text) {
  let t = String(text || "").trim();
  t = t.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  return JSON.parse(t);
}

async function groqResearch(title) {
  if (!process.env.GROQ_API_KEY) return "";
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const r = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || "groq/compound",
      messages: [{
        role: "system",
        content: "Research UDC classification evidence only. Do not make the final classification. Return concise candidate notation, reasoning, and source names/URLs if available."
      }, {
        role: "user",
        content: `Research this book title for UDC classification: ${title}`
      }]
    });
    return r.choices?.[0]?.message?.content || "";
  } catch {
    return "";
  }
}

async function geminiClassify(title, research) {
  if (!process.env.GEMINI_API_KEY) {
    const e = new Error("GEMINI_API_KEY is missing");
    e.code = "GEMINI_KEY_MISSING";
    throw e;
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  let lastError;

  for (const model of geminiModels) {
    try {
      const prompt = `
Book title to classify:
"${title}"

Optional research-only notes (do not trust blindly; verify independently):
${research || "(none)"}

Perform the UDC classification now. Search the web when useful. Return JSON only.
`;
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM,
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: outputSchema,
          temperature: 0.1,
          maxOutputTokens: 1800
        }
      });

      const result = cleanJson(response.text);
      const gm = response.candidates?.[0]?.groundingMetadata;
      const chunks = gm?.groundingChunks || [];
      const groundedSources = chunks
        .map(c => c.web)
        .filter(Boolean)
        .map(w => ({ title: w.title || "Web source", url: w.uri || "", relevance: "Gemini Google Search grounding source" }))
        .filter(x => x.url);

      // Prefer actual grounding sources over model-invented source URLs.
      result.sources = groundedSources.length ? groundedSources.slice(0, 8) : (result.sources || []);
      result.model = model;
      result.grounded = groundedSources.length > 0;
      result.geminiFinal = true;
      return result;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("Gemini request failed");
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    groqConfigured: Boolean(process.env.GROQ_API_KEY),
    finalEngine: "Gemini",
    googleGrounding: true,
    localTitleKey: false
  });
});

app.post("/api/classify", async (req, res) => {
  const title = String(req.body?.title || "").trim();
  if (!title) return res.status(400).json({ error: "Enter a book title." });
  if (title.length > 500) return res.status(400).json({ error: "Title is too long." });

  try {
    const research = await groqResearch(title);
    const result = await geminiClassify(title, research);
    res.json({
      ok: true,
      result,
      engine: {
        final: "Gemini",
        research: research ? "Groq" : "None",
        googleGrounding: Boolean(result.grounded)
      }
    });
  } catch (err) {
    const code = err?.code || "";
    const msg = code === "GEMINI_KEY_MISSING"
      ? "Google AI Studio/Gemini API key is not configured on the server."
      : "Gemini could not complete the classification. Check the Gemini key, model access, quota, or Render logs.";
    res.status(502).json({ ok: false, code, error: msg });
  }
});

app.listen(PORT, () => console.log(`UDC One-Click V39 running on ${PORT}`));
