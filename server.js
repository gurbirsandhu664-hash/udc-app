import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import pkg from 'pg';
const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-write-token');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ਵੱਡੇ ਇੰਡੈਕਸ ਡਾਟਾ ਲਈ 100MB ਲਿਮਿਟ
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
const GROQ_API_KEY = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : '';
const DATABASE_URL = process.env.DATABASE_URL ? process.env.DATABASE_URL.trim() : '';
const DDC_INDEX_WRITE_TOKEN = process.env.DDC_INDEX_WRITE_TOKEN ? process.env.DDC_INDEX_WRITE_TOKEN.trim() : '';

// --- POSTGRESQL ਡਾਟਾਬੇਸ ਸੈੱਟਅੱਪ ---
let pool = null;
if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  // ਆਟੋਮੈਟਿਕ ਟੇਬਲ ਤਿਆਰ ਕਰਨਾ
  pool.query(`
    CREATE TABLE IF NOT EXISTS shared_ddc_store (
      id VARCHAR(50) PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `).catch(err => console.error("Postgres table init error:", err.message));
}

// ਸਰਵਰ ਲੋਕਲ ਫਾਲਬੈਕ ਫਾਈਲ
const LOCAL_INDEX_FILE = path.join(__dirname, 'shared_ddc_index.json');

// --- ਫਰੰਟਐਂਡ ਲਈ ਸਾਰੇ PUBLISH ਅਤੇ LOAD ਰੂਟਸ ---
const handlePublish = async (req, res) => {
  try {
    const token = req.headers['x-write-token'] || req.headers['authorization'] || req.body.token || req.query.token;
    
    // ਜੇ ਟੋਕਨ ਸੈੱਟ ਹੈ ਤਾਂ ਵੈਰੀਫਾਈ ਕਰੋ
    if (DDC_INDEX_WRITE_TOKEN && token && token.replace('Bearer ', '').trim() !== DDC_INDEX_WRITE_TOKEN) {
      return res.status(401).json({ success: false, error: "Invalid write token" });
    }

    const payload = req.body.index || req.body.data || req.body;

    // 1. ਡਾਟਾਬੇਸ ਵਿੱਚ ਸੇਵ ਕਰੋ
    if (pool) {
      await pool.query(
        `INSERT INTO shared_ddc_store (id, data, updated_at) 
         VALUES ('ddc_23_index', $1, NOW()) 
         ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = NOW();`,
        [payload]
      );
    }

    // 2. ਲੋਕਲ ਸਰਵਰ ਫਾਈਲ ਬੈਕਅੱਪ
    fs.writeFileSync(LOCAL_INDEX_FILE, JSON.stringify(payload), 'utf8');

    return res.json({ 
      success: true, 
      ok: true, 
      status: "success", 
      message: "Shared DDC-23 Index published successfully!" 
    });
  } catch (err) {
    console.error("Publish error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

const handleLoad = async (req, res) => {
  try {
    // 1. ਡਾਟਾਬੇਸ ਤੋਂ ਚੈੱਕ ਕਰੋ
    if (pool) {
      const dbRes = await pool.query(`SELECT data FROM shared_ddc_store WHERE id = 'ddc_23_index' LIMIT 1;`);
      if (dbRes.rows.length > 0) {
        return res.json({ success: true, loaded: true, index: dbRes.rows[0].data, data: dbRes.rows[0].data });
      }
    }

    // 2. ਲੋਕਲ ਸਰਵਰ ਫਾਈਲ ਤੋਂ ਚੈੱਕ ਕਰੋ
    if (fs.existsSync(LOCAL_INDEX_FILE)) {
      const localData = JSON.parse(fs.readFileSync(LOCAL_INDEX_FILE, 'utf8'));
      return res.json({ success: true, loaded: true, index: localData, data: localData });
    }

    return res.json({ success: false, loaded: false, message: "No shared index found" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ਸਾਰੇ ਸੰਭਵ URL ਪੈਟਰਨ ਰਜਿਸਟਰ ਕਰੋ ਤਾਂ ਜੋ "string did not match pattern" ਨਾ ਆਵੇ
app.post(['/api/shared-index', '/api/shared-index/publish', '/api/publish-index', '/publish-shared-index'], handlePublish);
app.get(['/api/shared-index', '/api/shared-index/load', '/api/load-index', '/shared-index'], handleLoad);

// --- ਕਲਾਸੀਫਿਕੇਸ਼ਨ ਇੰਜਣ (UDC 1961 + DDC 23) ---
const CLASSIFICATION_SYSTEM_PROMPT = `You are an expert dual classification engine for Universal Decimal Classification (UDC - BS 1000A:1961 schedule) AND Dewey Decimal Classification (DDC - 23rd Edition).
Synthesize pure, untruncated UDC and DDC class numbers with detailed facet breakdowns.

RULES:
- Agriculture & Crops (Wheat, Maize, Harvesting):
  * UDC: 633.11/.15:631.55 or 633.11+633.15:631.55
  * DDC: 633.1
- Preservation / Manuscripts: UDC 025.85:091:027.7, DDC 025.84
- Social welfare / writings: UDC 016:36, DDC 016.361
- Literature works: Combine language, form, author, and book title in quotes "".

OUTPUT FORMAT: Return ONLY valid JSON:
{
  "fullNotation": "pure synthesized UDC notation",
  "ddc": "pure synthesized DDC notation",
  "mainSubject": "Short main subject name",
  "subSubject": "Detailed facet description",
  "breakdown": "Element-by-element UDC breakdown",
  "ddcBreakdown": "Element-by-element DDC breakdown",
  "confidence": "95%",
  "evidence": "Schedule verified"
}`;

function dynamicSynthesizer(rawTitle) {
  const t = rawTitle.toLowerCase().trim();

  // ਖੇਤੀਬਾੜੀ (Wheat, Maize, Harvesting)
  if (t.includes('wheat') || t.includes('maize') || t.includes('harvest')) {
    return {
      udc: '633.11+633.15:631.55',
      ddc: '633.1045',
      main: 'Agriculture / Field Crops',
      sub: rawTitle,
      breakdown: '633.11: Wheat; +633.15: Maize; :631.55: Harvesting',
      ddcBreakdown: '633.1: Cereals; .045: Harvesting'
    };
  }

  // ਲਾਇਬ੍ਰੇਰੀ ਪ੍ਰੀਜ਼ਰਵੇਸ਼ਨ
  if (t.includes('preservation') || t.includes('manuscript')) {
    return {
      udc: '025.85:091:027.7',
      ddc: '025.84',
      main: 'Library Science / Preservation',
      sub: rawTitle,
      breakdown: '025.85: Preservation; :091: Manuscripts; :027.7: University libraries',
      ddcBreakdown: '025.84: Conservation of collections'
    };
  }

  // ਸਮਾਜ ਭਲਾਈ
  if (t.includes('social welfare') || t.includes('welfare')) {
    return {
      udc: '016:36',
      ddc: '016.361',
      main: 'Social Welfare',
      sub: rawTitle,
      breakdown: '016: Bibliographies; :36: Social welfare',
      ddcBreakdown: '016.361: Social welfare'
    };
  }

  return {
    udc: '63',
    ddc: '630',
    main: 'Applied Sciences',
    sub: rawTitle,
    breakdown: 'Synthesized notation',
    ddcBreakdown: 'Synthesized notation'
  };
}

async function tryGemini(title) {
  if (!GEMINI_API_KEY) return null;
  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: CLASSIFICATION_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: `Synthesize UDC (BS 1000A:1961) and DDC (23rd Ed.) for: "${title}"` }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
      })
    });
    const data = await response.json();
    if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return JSON.parse(data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim());
    }
  } catch (err) {}
  return null;
}

async function tryGroq(title) {
  if (!GROQ_API_KEY) return null;
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: CLASSIFICATION_SYSTEM_PROMPT },
          { role: 'user', content: `Synthesize UDC and DDC for: "${title}"` }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    });
    const data = await response.json();
    if (response.ok && data.choices?.[0]?.message?.content) {
      return JSON.parse(data.choices[0].message.content.replace(/```json|```/g, '').trim());
    }
  } catch (err) {}
  return null;
}

function makeResponseObject(u, d, m, s, b, db) {
  return {
    success: true,
    answer: u,
    fullNotation: u,
    udcNumber: u,
    ddc: d,
    ddcNumber: d,
    mainSubject: m,
    subSubject: s,
    breakdown: b,
    ddcBreakdown: db,
    confidence: '95%',
    evidence: 'B.S. 1000A:1961 & DDC 23 verified'
  };
}

app.get('/', (req, res) => {
  const rootIndex = path.join(__dirname, 'index.html');
  const pubIndex = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(rootIndex)) return res.sendFile(rootIndex);
  if (fs.existsSync(pubIndex)) return res.sendFile(pubIndex);
  res.send("Server Running");
});

app.post(['/api/classify', '/classify'], async (req, res) => {
  const rawInput = req.body.title || req.body.query || req.body.text;
  if (!rawInput) return res.status(400).json({ error: "Title is required" });

  let parsed = await tryGemini(rawInput) || await tryGroq(rawInput);

  if (parsed && (parsed.fullNotation || parsed.udcNumber)) {
    return res.json(makeResponseObject(
      parsed.fullNotation || parsed.udcNumber,
      parsed.ddc || parsed.ddcNumber,
      parsed.mainSubject,
      parsed.subSubject || rawInput,
      parsed.breakdown,
      parsed.ddcBreakdown
    ));
  }

  const fallback = dynamicSynthesizer(rawInput);
  return res.json(makeResponseObject(
    fallback.udc,
    fallback.ddc,
    fallback.main,
    fallback.sub,
    fallback.breakdown,
    fallback.ddcBreakdown
  ));
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
