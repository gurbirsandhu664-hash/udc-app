import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON requests and serving static assets
app.use(express.json());
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
      console.log(`[Cache] DDC Index successfully loaded: ${ddcIndex.length} records`);
    } else {
      console.warn(`[Warning] File not found: ${ddcPath}`);
    }

    const udcPath = path.join(__dirname, 'udc-1961-reference-index.json');
    if (fs.existsSync(udcPath)) {
      udcIndex = JSON.parse(fs.readFileSync(udcPath, 'utf-8'));
      console.log(`[Cache] UDC Index successfully loaded: ${udcIndex.length} records`);
    } else {
      console.warn(`[Warning] File not found: ${udcPath}`);
    }
  } catch (error) {
    console.error('[Error] Failed to load reference JSON files:', error.message);
  }
}

// Initial cache population on startup
loadIndices();

// ============================================================
// 2. Input Tolerance & Normalization Helpers
// ============================================================
function normalizeCode(input) {
  if (!input) return '';
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ''); // Strips dots, slashes, spaces, and punctuation
}

function cleanText(input) {
  if (!input) return '';
  return String(input).trim().toLowerCase();
}

function extractRecordCode(item) {
  return normalizeCode(
    item.code ||
    item.class ||
    item.number ||
    item.id ||
    item.notation ||
    ''
  );
}

function extractRecordTitle(item) {
  return cleanText(
    item.title ||
    item.description ||
    item.heading ||
    item.name ||
    item.caption ||
    ''
  );
}

// ============================================================
// 3. Deterministic Tiered Search Engine
// ============================================================
function searchReferenceData(query, system = 'all') {
  const normQuery = normalizeCode(query);
  const textQuery = cleanText(query);

  if (!normQuery && !textQuery) {
    return [];
  }

  // Select target dataset
  let pool = [];
  if (system === 'ddc') {
    pool = ddcIndex;
  } else if (system === 'udc') {
    pool = udcIndex;
  } else {
    pool = [...ddcIndex, ...udcIndex];
  }

  // Tier 1: Exact Code Match (Highest Accuracy)
  const exactMatches = pool.filter((item) => extractRecordCode(item) === normQuery);
  if (exactMatches.length > 0) {
    return exactMatches.map((record) => ({
      ...record,
      matchType: 'exact_code',
      confidence: 1.0,
    }));
  }

  // Tier 2: Code Prefix / Hierarchy Match (e.g., matching 004 to 004.1)
  if (normQuery.length >= 2) {
    const prefixMatches = pool.filter((item) => {
      const code = extractRecordCode(item);
      return code.startsWith(normQuery) || normQuery.startsWith(code);
    });

    if (prefixMatches.length > 0) {
      return prefixMatches.slice(0, 10).map((record) => ({
        ...record,
        matchType: 'code_hierarchy',
        confidence: 0.85,
      }));
    }
  }

  // Tier 3: Text / Description Search
  const textMatches = pool.filter((item) => {
    const title = extractRecordTitle(item);
    return title.includes(textQuery);
  });

  if (textMatches.length > 0) {
    return textMatches.slice(0, 10).map((record) => ({
      ...record,
      matchType: 'text_description',
      confidence: 0.7,
    }));
  }

  return [];
}

// ============================================================
// 4. REST API Routes
// ============================================================

// Main Search API endpoint
app.get('/api/search', (req, res) => {
  const query = req.query.q || req.query.query;
  const system = (req.query.system || 'all').toLowerCase();

  if (!query || String(query).trim() === '') {
    return res.status(400).json({
      success: false,
      error: 'Query parameter "q" is required.',
    });
  }

  const results = searchReferenceData(query, system);

  if (results.length === 0) {
    return res.json({
      success: true,
      found: false,
      message: 'No matching records found.',
      results: [],
    });
  }

  return res.json({
    success: true,
    found: true,
    count: results.length,
    results: results,
  });
});

// Cache Refresh endpoint
app.post('/api/reload-cache', (req, res) => {
  loadIndices();
  res.json({
    success: true,
    message: 'Reference cache reloaded successfully.',
    ddcRecords: ddcIndex.length,
    udcRecords: udcIndex.length,
  });
});

// Serve the web interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================================
// 5. Server Initialization
// ============================================================
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`Server running at: http://localhost:${PORT}`);
  console.log(`Accuracy Search Engine is ready.`);
  console.log(`===============================================`);
});
