import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS headers ensure frontend doesn't get blocked
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Serve frontend assets
app.use(express.static(__dirname));

// ============================================================
// 1. In-Memory Caching (DDC & UDC Reference Indices)
// ============================================================
let ddcIndex = [];
let udcIndex = [];

function loadIndices() {
  try {
    const ddcPath = path.join(__dirname, 'ddc-23-reference-index.json');
    if (fs.existsSync(ddcPath)) {
      ddcIndex = JSON.parse(fs.readFileSync(ddcPath, 'utf-8'));
      console.log(`[Cache] DDC Index loaded: ${ddcIndex.length} records`);
    }

    const udcPath = path.join(__dirname, 'udc-1961-reference-index.json');
    if (fs.existsSync(udcPath)) {
      udcIndex = JSON.parse(fs.readFileSync(udcPath, 'utf-8'));
      console.log(`[Cache] UDC Index loaded: ${udcIndex.length} records`);
    }
  } catch (error) {
    console.error('[Cache Error] Failed to load JSON files:', error.message);
  }
}

loadIndices();

// ============================================================
// 2. Curated Exact Matches (For Standard Authority Titles)
// ============================================================
const exactTitleRules = {
  "snake farming in south india": {
    udc: "638.8(540)",
    ddc: "639.39",
    class: "Snake Farming / Animal Culture",
    authority: "UDC/DDC Exact-Title Rule"
  },
  "electrotherapy for economically useful animals": {
    udc: "619:615.84",
    ddc: "636.089584",
    class: "Veterinary Electrotherapy",
    authority: "UDC/DDC Exact-Title Rule"
  },
  "design and construction of cement floor": {
    udc: "69.025.331",
    ddc: "690.16",
    class: "Floors / Cement Construction",
    authority: "UDC/DDC Exact-Title Rule"
  },
  "sobha singh — reproductions of his paintings": {
    udc: "75(540)(084)",
    ddc: "759.954",
    class: "Indian Painting Reproductions",
    authority: "UDC/DDC Exact-Title Rule"
  },
  "sobha singh": {
    udc: "75(540)",
    ddc: "759.954",
    class: "Indian Painters / Biography",
    authority: "UDC/DDC Exact-Title Rule"
  },
  "dictionary of language and literature": {
    udc: "80(038)",
    ddc: "403",
    class: "Language & Literature Dictionaries",
    authority: "UDC/DDC Exact-Title Rule"
  }
};

// ============================================================
// 3. Normalization & Search Helpers
// ============================================================
function normalize(str) {
  if (!str) return '';
  return String(str).toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

function cleanTitle(str) {
  if (!str) return '';
  return String(str).toLowerCase().trim().replace(/—/g, '-');
}

function classifyQuery(query, system = 'all') {
  const cleaned = cleanTitle(query);
  const normalized = normalize(query);

  // Step 1: Check Configured Exact-Title Authority Rules
  if (exactTitleRules[cleaned]) {
    const item = exactTitleRules[cleaned];
    return [{
      code: system === 'ddc' ? item.ddc : item.udc,
      udc: item.udc,
      ddc: item.ddc,
      title: query,
      heading: item.class,
      matchType: 'exact_rule',
      confidence: 1.0,
      authority: item.authority
    }];
  }

  // Step 2: Pool search across UDC and DDC datasets
  let pool = [];
  if (system === 'ddc') pool = ddcIndex;
  else if (system === 'udc') pool = udcIndex;
  else pool = [...udcIndex, ...ddcIndex];

  // Exact Code Match
  const exactCode = pool.filter(item => {
    const code = normalize(item.code || item.class || item.notation || '');
    return code === normalized;
  });
  if (exactCode.length > 0) {
    return exactCode.map(x => ({ ...x, matchType: 'exact_code', confidence: 1.0 }));
  }

  // Exact Title / Keyword Match
  const exactTitle = pool.filter(item => {
    const heading = (item.title || item.heading || item.description || '').toLowerCase();
    return heading === cleaned || heading.includes(cleaned);
  });
  if (exactTitle.length > 0) {
    return exactTitle.slice(0, 5).map(x => ({ ...x, matchType: 'exact_title', confidence: 0.95 }));
  }

  // Token-based matching
  const tokens = cleaned.split(/\s+/).filter(w => w.length > 2);
  if (tokens.length > 0) {
    const matched = pool.filter(item => {
      const text = (item.title || item.heading || item.description || '').toLowerCase();
      return tokens.some(tok => text.includes(tok));
    });
    if (matched.length > 0) {
      return matched.slice(0, 5).map(x => ({ ...x, matchType: 'token_match', confidence: 0.8 }));
    }
  }

  return [];
}

// ============================================================
// 4. Unified API Endpoint (Guaranteed JSON Response)
// ============================================================
function handleClassification(req, res) {
  // Supports GET query, POST body (JSON & URL-encoded)
  const input = req.body?.title || req.body?.query || req.body?.q ||
                req.query?.title || req.query?.query || req.query?.q || '';
  const system = (req.body?.system || req.query?.system || 'all').toLowerCase();

  if (!input || String(input).trim() === '') {
    return res.status(400).json({
      success: false,
      found: false,
      error: 'Please provide a title or notation code to classify.'
    });
  }

  const results = classifyQuery(input, system);

  if (results.length === 0) {
    return res.json({
      success: true,
      found: false,
      title: input,
      message: 'No exact classification validated for this input.',
      results: []
    });
  }

  return res.json({
    success: true,
    found: true,
    title: input,
    count: results.length,
    classification: results[0],
    results: results
  });
}

// Map ALL possible routes that frontend calls
app.post('/api/classify', handleClassification);
app.get('/api/classify', handleClassification);
app.post('/classify', handleClassification);
app.get('/classify', handleClassification);
app.post('/api/search', handleClassification);
app.get('/api/search', handleClassification);
app.post('/search', handleClassification);
app.get('/search', handleClassification);

// Health check endpoint
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Root route serves UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Fallback: ALWAYS return JSON (prevents "non-JSON response" error on missing routes)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    found: false,
    error: `Endpoint ${req.method} ${req.url} not found on server.`
  });
});

// Error-handling middleware
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]', err);
  res.status(500).json({
    success: false,
    found: false,
    error: 'Internal server error occurred.'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
