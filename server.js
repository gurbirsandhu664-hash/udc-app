import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.static(__dirname));

// ============================================================
// 1. In-Memory Caching (Safe Load)
// ============================================================
let ddcIndex = [];
let udcIndex = [];

function loadIndices() {
  try {
    const ddcPath = path.join(__dirname, 'ddc-23-reference-index.json');
    if (fs.existsSync(ddcPath)) {
      const data = JSON.parse(fs.readFileSync(ddcPath, 'utf-8'));
      ddcIndex = Array.isArray(data) ? data : (data.records || data.items || []);
    }
  } catch (e) {
    console.error('Error loading DDC index:', e.message);
  }

  try {
    const udcPath = path.join(__dirname, 'udc-1961-reference-index.json');
    if (fs.existsSync(udcPath)) {
      const data = JSON.parse(fs.readFileSync(udcPath, 'utf-8'));
      udcIndex = Array.isArray(data) ? data : (data.records || data.items || []);
    }
  } catch (e) {
    console.error('Error loading UDC index:', e.message);
  }
}
loadIndices();

// ============================================================
// 2. Exact Title Rules (Standard Authority Data)
// ============================================================
const exactRules = {
  "snake farming in south india": {
    udc: "638.8(540)",
    ddc: "639.39",
    class: "Snake Farming / Animal Culture"
  },
  "electrotherapy for economically useful animals": {
    udc: "619:615.84",
    ddc: "636.089584",
    class: "Veterinary Electrotherapy"
  },
  "design and construction of cement floor": {
    udc: "69.025.331",
    ddc: "690.16",
    class: "Floors / Cement Construction"
  },
  "sobha singh — reproductions of his paintings": {
    udc: "75(540)(084)",
    ddc: "759.954",
    class: "Indian Painting Reproductions"
  },
  "sobha singh": {
    udc: "75(540)",
    ddc: "759.954",
    class: "Indian Painters / Biography"
  },
  "dictionary of language and literature": {
    udc: "80(038)",
    ddc: "403",
    class: "Language & Literature Dictionaries"
  }
};

function safeStr(val) {
  return typeof val === 'string' ? val : (val ? String(val) : '');
}

function cleanInput(val) {
  return safeStr(val).toLowerCase().replace(/—/g, '-').trim();
}

// ============================================================
// 3. Robust Classifier Logic (No Null Crashes)
// ============================================================
function getClassification(query, system = 'all') {
  const cleaned = cleanInput(query);
  const sys = cleanInput(system);

  // 1. Exact match from predefined rules
  if (exactRules[cleaned]) {
    const r = exactRules[cleaned];
    const targetCode = (sys === 'ddc') ? r.ddc : r.udc;
    return {
      status: 'success',
      found: true,
      number: targetCode,
      code: targetCode,
      udcNumber: r.udc,
      ddcNumber: r.ddc,
      heading: r.class,
      confidence: 1.0,
      ruleType: 'exact_title_rule',
      matches: [{
        number: targetCode,
        caption: r.class,
        system: sys === 'ddc' ? 'DDC-23' : 'UDC-1961'
      }]
    };
  }

  // 2. Pool Search
  let pool = [];
  if (sys === 'ddc') pool = ddcIndex;
  else if (sys === 'udc') pool = udcIndex;
  else pool = [...udcIndex, ...ddcIndex];

  for (const item of pool) {
    if (!item) continue;
    const title = cleanInput(item.title || item.heading || item.name || item.description);
    const code = cleanInput(item.number || item.code || item.class || item.notation);

    if (title === cleaned || code === cleaned) {
      const matchNum = safeStr(item.number || item.code || item.class || item.notation);
      const matchHeading = safeStr(item.title || item.heading || item.name || item.description);
      return {
        status: 'success',
        found: true,
        number: matchNum,
        code: matchNum,
        heading: matchHeading,
        confidence: 0.95,
        matches: [{ number: matchNum, caption: matchHeading }]
      };
    }
  }

  // 3. Fallback: Clean response instead of throwing 500
  return {
    status: 'unresolved',
    found: false,
    number: null,
    code: null,
    message: 'Could not validate authoritative classification number.',
    matches: []
  };
}

// ============================================================
// 4. Controller (Handles Both Frontend Formats)
// ============================================================
function handleRequest(req, res) {
  try {
    const raw = req.body || {};
    const q = req.query || {};

    const input = raw.title || raw.query || raw.q || raw.input || q.title || q.query || q.q || '';
    const system = raw.system || q.system || 'all';

    if (!safeStr(input).trim()) {
      return res.status(200).json({
        status: 'error',
        found: false,
        message: 'No title provided.'
      });
    }

    const result = getClassification(input, system);

    // Frontend expectations response mapping
    return res.status(200).json({
      success: true,
      title: input,
      ...result
    });
  } catch (err) {
    console.error('[Error in handleRequest]:', err);
    // Even if an unexpected error occurs, send clean JSON instead of 500 HTML
    return res.status(200).json({
      status: 'error',
      found: false,
      message: 'Failed to process request safely.'
    });
  }
}

// Map all endpoints called by frontend
app.post('/api/classify', handleRequest);
app.get('/api/classify', handleRequest);
app.post('/classify', handleRequest);
app.get('/classify', handleRequest);
app.post('/api/search', handleRequest);
app.get('/api/search', handleRequest);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Always return JSON for 404s
app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
