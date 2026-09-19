const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;
const ROOT = __dirname;

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9=:.()\-+\/\"& ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// -------------------- Local UDC sources --------------------
let rules = { exact: [], countries: {}, languages: [], forms: [], subjects: [], places: [] };
try {
  const p = path.join(ROOT, 'udc-rules.json');
  if (fs.existsSync(p)) {
    const loaded = JSON.parse(fs.readFileSync(p, 'utf8'));
    rules = { ...rules, ...loaded };
    for (const k of ['exact','languages','forms','subjects','places']) if (!Array.isArray(rules[k])) rules[k] = [];
    if (!rules.countries || typeof rules.countries !== 'object') rules.countries = {};
  }
} catch (e) { console.error('udc-rules.json:', e.message); }

function collectRecords(node, out = []) {
  if (!node) return out;
  if (Array.isArray(node)) {
    for (const x of node) {
      if (x && typeof x === 'object') {
        const title = x.title || x.bookTitle || x.name || x.query || x.pattern;
        const udc = x.udc || x.UDC || x.finalUdcNumber || x.final_udc || x.classification;
        if (title && udc) out.push({ title: String(title), udc: String(udc), subject: x.subject || x.mainSubject || '', subSubject: x.subSubject || '', explanation: x.explanation || x.note || '', confidence: x.confidence || 'High', aux: x.aux || [] });
        collectRecords(x, out);
      }
    }
  } else if (typeof node === 'object') {
    const title = node.title || node.bookTitle || node.name || node.query || node.pattern;
    const udc = node.udc || node.UDC || node.finalUdcNumber || node.final_udc || node.classification;
    if (title && udc) out.push({ title: String(title), udc: String(udc), subject: node.subject || node.mainSubject || '', subSubject: node.subSubject || '', explanation: node.explanation || node.note || '', confidence: node.confidence || 'High', aux: node.aux || [] });
    for (const v of Object.values(node)) if (v && typeof v === 'object') collectRecords(v, out);
  }
  return out;
}

const keyRecords = [];
for (const file of fs.readdirSync(ROOT)) {
  if (/^udc-\d+-key\.json$/i.test(file)) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
      keyRecords.push(...collectRecords(data));
      console.log(`Loaded ${file}: ${collectRecords(data).length} records`);
    } catch (e) { console.error(`Key load ${file}:`, e.message); }
  }
}
const localMap = new Map();
for (const r of keyRecords) localMap.set(norm(r.title), r);
// Also use exact entries from udc-rules.json as a local source.
for (const r of rules.exact) {
  if (r && (r.pattern || r.title) && (r.udc || r.finalUdcNumber)) {
    localMap.set(norm(r.pattern || r.title), { title: r.pattern || r.title, udc: r.udc || r.finalUdcNumber, subject: r.subject || r.mainSubject || '', subSubject: r.subSubject || '', explanation: r.explanation || '', confidence: r.confidence || 'High', aux: r.aux || [] });
  }
}

function localLookup(title) {
  const t = norm(title);
  if (!t) return null;
  if (localMap.has(t)) return localMap.get(t);
  // Conservative fuzzy lookup: only when a full stored title is contained.
  let best = null;
  for (const [k, r] of localMap.entries()) {
    if (k.length >= 5 && (t.includes(k) || k.includes(t))) {
      if (!best || k.length > best._len) best = { ...r, _len: k.length };
    }
  }
  if (best) { delete best._len; return best; }
  return null;
}

function baseResult(title, r, confidence = 'Medium', source = 'UDC local key') {
  const udc = String(r.udc || r.finalUdcNumber || '0');
  return {
    title, bookTitle: title, udc, finalUdcNumber: udc, proposedUdcNumber: udc,
    baseClass: String(udc).split(/[.(="'\-+/:]/)[0] || '0',
    mainClass: String(udc).split(/[.(="'\-+/:]/)[0] || '0',
    subject: r.subject || r.mainSubject || 'Unresolved title',
    mainSubject: r.mainSubject || r.subject || 'Unresolved title',
    subSubject: r.subSubject || '',
    confidence: confidence || r.confidence || 'Medium',
    explanation: r.explanation || `UDC ${udc}.`,
    cataloguerExplanation: r.explanation || `UDC ${udc}.`,
    alternatives: Array.isArray(r.alternatives) ? r.alternatives : [],
    aux: Array.isArray(r.aux) ? r.aux : [],
    verifiedRule: source === '2700-title key' || source === '2600-title key' || source === 'UDC local key',
    source
  };
}

function localClassify(title) {
  const r = localLookup(title);
  if (r) {
    const source = keyRecords.some(x => norm(x.title) === norm(r.title)) ? 'UDC title key' : 'UDC local rule';
    return baseResult(title, r, r.confidence || 'High', source);
  }
  return null;
}

// -------------------- AI provider handling --------------------
function getKeys(prefix) {
  const keys = [];
  for (let i = 1; i <= 10; i++) {
    const name = i === 1 ? prefix : `${prefix}_${i}`;
    const v = String(process.env[name] || '').trim();
    if (v && !keys.includes(v)) keys.push(v);
  }
  return keys;
}

const GEMINI_KEYS = getKeys('GEMINI_API_KEY');
const GROQ_KEYS = getKeys('GROQ_API_KEY');
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const UDC_SYSTEM = `You are a strict Universal Decimal Classification (UDC) cataloguing assistant. UDC ONLY; never DDC. Analyze the complete book title semantically, not isolated keywords. Prefer the most specific defensible UDC notation. Use auxiliaries only when the title supports them. Respect UDC notation symbols and their meaning: + coordination, / consecutive extension, : relation, [ ] grouping, = language auxiliary, (0...) form auxiliaries, (1/9...) place auxiliaries, and time auxiliaries in quotes. For literature, distinguish language, literature, and literary form such as drama/poetry/fiction. Do not invent a precise number when evidence is insufficient. If uncertain, return confidence Low and explain what must be verified in the licensed/current UDC schedule. Return ONLY valid JSON with keys: udc, mainSubject, subSubject, explanation, confidence, aux. No markdown.`;

function extractJson(text) {
  const s = String(text || '').trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('Provider returned non-JSON');
  return JSON.parse(s.slice(a, b + 1));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isRetryable(status, text) {
  const s = `${status} ${text || ''}`.toLowerCase();
  return status === 429 || status === 408 || status >= 500 || /quota|rate.?limit|resource.?exhausted|too many requests|temporarily unavailable/.test(s);
}

async function gemini(title) {
  if (!GEMINI_KEYS.length) throw new Error('Gemini API key not configured');
  let last;
  for (let i = 0; i < GEMINI_KEYS.length; i++) {
    const key = GEMINI_KEYS[i];
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(key)}`;
        const body = { systemInstruction: { parts: [{ text: UDC_SYSTEM }] }, contents: [{ role: 'user', parts: [{ text: `Classify this book title: ${title}` }] }], generationConfig: { temperature: 0.05, responseMimeType: 'application/json', maxOutputTokens: 500 } };
        const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const txt = await resp.text();
        if (!resp.ok) {
          last = new Error(`Gemini ${resp.status}: ${txt.slice(0, 300)}`);
          if (isRetryable(resp.status, txt)) { if (attempt === 0) await sleep(500); else continue; }
          else break;
          continue;
        }
        const data = JSON.parse(txt);
        const out = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
        const j = extractJson(out);
        if (!j.udc) throw new Error('Gemini returned no UDC number');
        return baseResult(title, { udc: j.udc, mainSubject: j.mainSubject, subSubject: j.subSubject, explanation: j.explanation, aux: j.aux }, j.confidence || 'Medium', 'Gemini AI');
      } catch (e) { last = e; if (attempt === 0) await sleep(400); }
    }
  }
  throw last || new Error('Gemini unavailable');
}

async function groq(title) {
  if (!GROQ_KEYS.length) throw new Error('Groq API key not configured');
  let last;
  for (let i = 0; i < GROQ_KEYS.length; i++) {
    const key = GROQ_KEYS[i];
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model: GROQ_MODEL, temperature: 0.05, max_tokens: 500, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: UDC_SYSTEM }, { role: 'user', content: `Classify this book title: ${title}` }] })
        });
        const txt = await resp.text();
        if (!resp.ok) {
          last = new Error(`Groq ${resp.status}: ${txt.slice(0, 300)}`);
          if (isRetryable(resp.status, txt)) { if (attempt === 0) await sleep(500); else continue; }
          else break;
          continue;
        }
        const data = JSON.parse(txt);
        const out = data?.choices?.[0]?.message?.content || '';
        const j = extractJson(out);
        if (!j.udc) throw new Error('Groq returned no UDC number');
        return baseResult(title, { udc: j.udc, mainSubject: j.mainSubject, subSubject: j.subSubject, explanation: j.explanation, aux: j.aux }, j.confidence || 'Medium', 'Groq AI');
      } catch (e) { last = e; if (attempt === 0) await sleep(400); }
    }
  }
  throw last || new Error('Groq unavailable');
}

function safeFallback(title, errors) {
  return baseResult(title, {
    udc: '0', mainSubject: 'Unresolved title', subSubject: 'Verification required',
    explanation: 'No local title-key match was found and the AI providers were unavailable. No specific UDC number was invented. ' + errors.join(' | '),
    aux: []
  }, 'Low', 'Verification required');
}

async function classify(title) {
  const raw = String(title || '').trim();
  if (!raw) return safeFallback('', ['Enter a book title.']);

  // 1) Exact/local key always wins. This protects known answers from AI variation.
  const local = localClassify(raw);
  if (local) return local;

  const errors = [];
  // 2) Gemini first.
  try { return await gemini(raw); }
  catch (e) { errors.push(e.message); }
  // 3) Groq fallback. Gemini quota errors never reach the browser.
  try { return await groq(raw); }
  catch (e) { errors.push(e.message); }
  // 4) Safe local fallback, never a fake specific classification.
  return safeFallback(raw, errors);
}

app.get('/health', (req, res) => res.json({
  ok: true, service: 'UDC Ultimate', version: 'V20-Gemini-Groq-Stable',
  localTitleRecords: localMap.size,
  providers: { gemini: GEMINI_KEYS.length > 0, groq: GROQ_KEYS.length > 0 },
  models: { gemini: GEMINI_MODEL, groq: GROQ_MODEL }
}));

app.post('/api/classify', async (req, res) => {
  try {
    const title = req.body?.title ?? req.body?.bookTitle ?? req.body?.query ?? '';
    const result = await classify(title);
    res.status(200).json(result);
  } catch (e) {
    console.error('classify error:', e);
    res.status(200).json(safeFallback(String(req.body?.title || ''), [e.message]));
  }
});
app.post('/classify', async (req, res) => {
  try { res.status(200).json(await classify(req.body?.title ?? req.body?.bookTitle ?? req.body?.query ?? '')); }
  catch (e) { res.status(200).json(safeFallback(String(req.body?.title || ''), [e.message])); }
});

app.listen(PORT, () => console.log(`UDC Ultimate V20 listening on ${PORT}`));
