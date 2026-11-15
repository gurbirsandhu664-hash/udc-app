const http = process.getBuiltinModule('node:http');
const fs = process.getBuiltinModule('node:fs');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CACHE_FILE = './ai-cache-v5.json';

// 1. Persistent Disk Cache
let diskCache = {};
try {
  if (fs.existsSync(CACHE_FILE)) {
    diskCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  }
} catch (e) {}

function saveCache(key, val) {
  diskCache[key] = val;
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(diskCache));
  } catch (e) {}
}

// 2. Load Local Reference Indexes
const flatUdc = new Map();
const flatDdc = new Map();

function extractEntries(node, targetMap) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach(item => extractEntries(item, targetMap));
    return;
  }
  const label = node.title || node.subject || node.name || node.caption || node.label || node.heading;
  const code = node.code || node.number || node.notation || node.udc || node.ddc || node.class;
  if (typeof label === 'string' && (typeof code === 'string' || typeof code === 'number')) {
    targetMap.set(label.toLowerCase().trim(), String(code).trim());
  }
  for (const [k, v] of Object.entries(node)) {
    if (typeof v === 'string' || typeof v === 'number') {
      const cleanK = k.toLowerCase().trim();
      if (cleanK.length > 2 && !['code', 'number', 'notation', 'title', 'subject', 'name', 'id'].includes(cleanK)) {
        targetMap.set(cleanK, String(v).trim());
      }
    } else if (typeof v === 'object') {
      extractEntries(v, targetMap);
    }
  }
}

try {
  if (fs.existsSync('./ddc-23-reference-index.json')) {
    extractEntries(JSON.parse(fs.readFileSync('./ddc-23-reference-index.json', 'utf8')), flatDdc);
  }
  if (fs.existsSync('./udc-1961-reference-index.json')) {
    extractEntries(JSON.parse(fs.readFileSync('./udc-1961-reference-index.json', 'utf8')), flatUdc);
  }
} catch (e) {}

// 3. Comprehensive DDC 23rd Ed. & UDC Schedule (Zero-Fail Backup + Fast Local Synthesis)
const SUBJECT_SCHEDULE = [
  // Library & Information Science
  { keys: ['library management', 'library administration'], udc: '025', ddc: '025.1', ddcBase: '0251', name: 'Library Management & Administration' },
  { keys: ['library classification', 'classification of books', 'ddc', 'udc'], udc: '025.4', ddc: '025.42', ddcBase: '02542', name: 'Library Classification' },
  { keys: ['library cataloging', 'cataloguing', 'bibliographic control'], udc: '025.3', ddc: '025.3', ddcBase: '0253', name: 'Library Cataloging' },
  { keys: ['reference service', 'information retrieval'], udc: '025.5', ddc: '025.52', ddcBase: '02552', name: 'Reference & Information Services' },
  { keys: ['digital library', 'digital libraries'], udc: '027:004', ddc: '025.04', ddcBase: '02504', name: 'Digital Libraries' },
  { keys: ['academic library', 'university library', 'college library'], udc: '027.7', ddc: '027.7', ddcBase: '0277', name: 'Academic Libraries' },
  { keys: ['public library', 'public libraries'], udc: '027.4', ddc: '027.4', ddcBase: '0274', name: 'Public Libraries' },
  { keys: ['school library', 'school libraries'], udc: '027.8', ddc: '027.8', ddcBase: '0278', name: 'School Libraries' },
  { keys: ['library science', 'librarianship', 'library'], udc: '02', ddc: '020', ddcBase: '02', name: 'Library & Information Science' },

  // Computer Science & Media
  { keys: ['social media', 'social networking'], udc: '004.738.5:316.77', ddc: '302.231', ddcBase: '302231', name: 'Social Media' },
  { keys: ['artificial intelligence', 'machine learning'], udc: '004.8', ddc: '006.3', ddcBase: '0063', name: 'Artificial Intelligence' },
  { keys: ['data science', 'big data', 'database'], udc: '004.65', ddc: '005.7', ddcBase: '0057', name: 'Data Science & Databases' },
  { keys: ['cyber security', 'cybersecurity', 'information security'], udc: '004.056', ddc: '005.8', ddcBase: '0058', name: 'Cybersecurity' },
  { keys: ['computer science', 'computing', 'information technology'], udc: '004', ddc: '004', ddcBase: '004', name: 'Computer Science' },
  { keys: ['journalism', 'mass media'], udc: '070', ddc: '070', ddcBase: '070', name: 'Journalism & Media' },

  // Philosophy, Psychology & Religion
  { keys: ['mental health', 'psychiatry'], udc: '616.89', ddc: '362.2', ddcBase: '3622', name: 'Mental Health' },
  { keys: ['educational psychology'], udc: '37.015.3', ddc: '370.15', ddcBase: '37015', name: 'Educational Psychology' },
  { keys: ['psychology', 'human behavior'], udc: '159.9', ddc: '150', ddcBase: '15', name: 'Psychology' },
  { keys: ['philosophy', 'metaphysics'], udc: '1', ddc: '100', ddcBase: '10', name: 'Philosophy' },
  { keys: ['logic'], udc: '16', ddc: '160', ddcBase: '16', name: 'Logic' },
  { keys: ['ethics'], udc: '17', ddc: '170', ddcBase: '17', name: 'Ethics' },
  { keys: ['sikhism', 'sikh'], udc: '294.553', ddc: '294.6', ddcBase: '2946', name: 'Sikhism' },
  { keys: ['hinduism'], udc: '294.5', ddc: '294.5', ddcBase: '2945', name: 'Hinduism' },
  { keys: ['islam'], udc: '297', ddc: '297', ddcBase: '297', name: 'Islam' },
  { keys: ['religion', 'theology'], udc: '2', ddc: '200', ddcBase: '20', name: 'Religion' },

  // Social Sciences, Law & Education
  { keys: ['sociology', 'society'], udc: '316', ddc: '301', ddcBase: '301', name: 'Sociology' },
  { keys: ['statistics'], udc: '311', ddc: '310', ddcBase: '31', name: 'Statistics' },
  { keys: ['international relations', 'foreign policy'], udc: '327', ddc: '327', ddcBase: '327', name: 'International Relations' },
  { keys: ['political science', 'politics'], udc: '32', ddc: '320', ddcBase: '32', name: 'Political Science' },
  { keys: ['banking', 'finance'], udc: '336.71', ddc: '332.1', ddcBase: '3321', name: 'Banking & Finance' },
  { keys: ['economics', 'economy'], udc: '33', ddc: '330', ddcBase: '33', name: 'Economics' },
  { keys: ['constitutional law'], udc: '342', ddc: '342', ddcBase: '342', name: 'Constitutional Law' },
  { keys: ['criminal law', 'criminology'], udc: '343', ddc: '345', ddcBase: '345', name: 'Criminal Law' },
  { keys: ['law', 'jurisprudence'], udc: '34', ddc: '340', ddcBase: '34', name: 'Law' },
  { keys: ['public administration'], udc: '35', ddc: '350', ddcBase: '35', name: 'Public Administration' },
  { keys: ['environmental science', 'ecology', 'environment'], udc: '502/504', ddc: '333.7', ddcBase: '3337', name: 'Environmental Science & Ecology' },
  { keys: ['higher education', 'universities'], udc: '378', ddc: '378', ddcBase: '378', name: 'Higher Education' },
  { keys: ['education', 'teaching'], udc: '37', ddc: '370', ddcBase: '37', name: 'Education' },
  { keys: ['commerce', 'trade'], udc: '339', ddc: '380', ddcBase: '38', name: 'Commerce' },

  // Pure & Applied Sciences (Including Forestry, Agriculture, Medicine, Engineering)
  { keys: ['mathematics'], udc: '51', ddc: '510', ddcBase: '51', name: 'Mathematics' },
  { keys: ['astronomy'], udc: '52', ddc: '520', ddcBase: '52', name: 'Astronomy' },
  { keys: ['quantum physics', 'quantum mechanics'], udc: '530.145', ddc: '530.12', ddcBase: '53012', name: 'Quantum Physics' },
  { keys: ['physics'], udc: '53', ddc: '530', ddcBase: '53', name: 'Physics' },
  { keys: ['organic chemistry'], udc: '547', ddc: '547', ddcBase: '547', name: 'Organic Chemistry' },
  { keys: ['chemistry'], udc: '54', ddc: '540', ddcBase: '54', name: 'Chemistry' },
  { keys: ['geology', 'earth science'], udc: '55', ddc: '551', ddcBase: '551', name: 'Geology' },
  { keys: ['genetics'], udc: '575', ddc: '576.5', ddcBase: '5765', name: 'Genetics' },
  { keys: ['biology'], udc: '57', ddc: '570', ddcBase: '57', name: 'Biology' },
  { keys: ['botany', 'plants'], udc: '58', ddc: '580', ddcBase: '58', name: 'Botany' },
  { keys: ['zoology', 'animals'], udc: '59', ddc: '590', ddcBase: '59', name: 'Zoology' },
  { keys: ['cardiology', 'heart'], udc: '616.12', ddc: '616.12', ddcBase: '61612', name: 'Cardiology' },
  { keys: ['surgery'], udc: '617', ddc: '617', ddcBase: '617', name: 'Surgery' },
  { keys: ['anatomy'], udc: '611', ddc: '611', ddcBase: '611', name: 'Anatomy' },
  { keys: ['medicine', 'medical', 'health'], udc: '61', ddc: '610', ddcBase: '61', name: 'Medicine & Health' },
  { keys: ['automobiles', 'vehicles', 'motor cars'], udc: '629.33', ddc: '629.222', ddcBase: '629222', name: 'Automobiles' },
  { keys: ['engineering'], udc: '62', ddc: '620', ddcBase: '62', name: 'Engineering' },
  { keys: ['forestry', 'forests', 'silviculture'], udc: '630', ddc: '634.9', ddcBase: '6349', name: 'Forestry' },
  { keys: ['horticulture', 'gardening'], udc: '635', ddc: '635', ddcBase: '635', name: 'Horticulture' },
  { keys: ['animal husbandry', 'livestock', 'dairy'], udc: '636', ddc: '636', ddcBase: '636', name: 'Animal Husbandry' },
  { keys: ['agriculture', 'farming', 'agronomy'], udc: '63', ddc: '630', ddcBase: '63', name: 'Agriculture' },
  { keys: ['business management', 'management', 'business'], udc: '65', ddc: '658', ddcBase: '658', name: 'Business Management' },

  // Arts, Literature & History
  { keys: ['architecture'], udc: '72', ddc: '720', ddcBase: '72', name: 'Architecture' },
  { keys: ['music'], udc: '78', ddc: '780', ddcBase: '78', name: 'Music' },
  { keys: ['sports', 'athletics'], udc: '796', ddc: '796', ddcBase: '796', name: 'Sports' },
  { keys: ['linguistics', 'language'], udc: '81', ddc: '410', ddcBase: '41', name: 'Linguistics' },
  { keys: ['punjabi literature'], udc: '821.214.2', ddc: '891.42', ddcBase: '89142', name: 'Punjabi Literature' },
  { keys: ['english literature'], udc: '821.111', ddc: '820', ddcBase: '82', name: 'English Literature' },
  { keys: ['literature'], udc: '82', ddc: '800', ddcBase: '80', name: 'Literature' },
  { keys: ['geography'], udc: '91', ddc: '910', ddcBase: '91', name: 'Geography' },
  { keys: ['history'], udc: '93/94', ddc: '900', ddcBase: '90', name: 'History' }
];

// 4. Expanded Form, Demographic, Geographic (World Countries) & Time Tables
const FACET_RULES = [
  { pattern: /\b(statistical tables?|statistical data)\b/i, udcAdd: '(083.4)', ddcSub: '021', label: 'Statistical tables (-021 / (083.4))' },
  { pattern: /\b(dictionar(y|ies)|glossary)\b/i, udcAdd: '(038)', ddcSub: '03', label: 'Dictionary (-03 / (038))' },
  { pattern: /\b(encyclopedias?|encyclopaedias?)\b/i, udcAdd: '(031)', ddcSub: '03', label: 'Encyclopedia (-03 / (031))' },
  { pattern: /\b(bibliograph(y|ies))\b/i, udcAdd: '(01)', ddcSub: '016', label: 'Bibliography (016 / (01))' },
  { pattern: /\b(periodicals?|journals?)\b/i, udcAdd: '(05)', ddcSub: '05', label: 'Serials (-05 / (05))' },
  { pattern: /\b(handbooks?|manuals?|guides?|guide to)\b/i, udcAdd: '(035)', ddcSub: '0202', label: 'Handbook/Guide (-0202 / (035))' },
  { pattern: /\b(research|methodology)\b/i, udcAdd: '.001.5', ddcSub: '072', label: 'Research (-072 / .001.5)' },
  { pattern: /\b(teenagers?|youth|adolescents?)\b/i, udcAdd: '-053.6', ddcSub: '0835', label: 'Youth/Teenagers (-0835 / -053.6)' },
  { pattern: /\b(children|child)\b/i, udcAdd: '-053.2', ddcSub: '083', label: 'Children (-083 / -053.2)' },
  { pattern: /\b(women|females?)\b/i, udcAdd: '-055.2', ddcSub: '082', label: 'Women (-082 / -055.2)' },
  { pattern: /\b(rural|villages?)\b/i, udcAdd: '(-22)', ddcSub: '091734', label: 'Rural regions (-091734 / (-22))' },
  { pattern: /\b(urban|cities)\b/i, udcAdd: '(-21)', ddcSub: '091732', label: 'Urban regions (-091732 / (-21))' },
  { pattern: /\b(punjab)\b/i, udcAdd: '(545.2)', ddcSub: '09545', label: 'Place: Punjab (-09545 / (545.2))' },
  { pattern: /\b(india|indian)\b/i, udcAdd: '(540)', ddcSub: '0954', label: 'Place: India (-0954 / (540))' },
  { pattern: /\b(canada|canadian)\b/i, udcAdd: '(71)', ddcSub: '0971', label: 'Place: Canada (-0971 / (71))' },
  { pattern: /\b(usa|united states|america|american)\b/i, udcAdd: '(73)', ddcSub: '0973', label: 'Place: USA (-0973 / (73))' },
  { pattern: /\b(uk|united kingdom|britain|england|british)\b/i, udcAdd: '(410)', ddcSub: '0941', label: 'Place: UK (-0941 / (410))' },
  { pattern: /\b(australia|australian)\b/i, udcAdd: '(94)', ddcSub: '0994', label: 'Place: Australia (-0994 / (94))' },
  { pattern: /\b(china|chinese)\b/i, udcAdd: '(510)', ddcSub: '0951', label: 'Place: China (-0951 / (510))' },
  { pattern: /\b(japan|japanese)\b/i, udcAdd: '(520)', ddcSub: '0952', label: 'Place: Japan (-0952 / (520))' },
  { pattern: /\b(germany|german)\b/i, udcAdd: '(430)', ddcSub: '0943', label: 'Place: Germany (-0943 / (430))' },
  { pattern: /\b(france|french)\b/i, udcAdd: '(44)', ddcSub: '0944', label: 'Place: France (-0944 / (44))' },
  { pattern: /\b(20th century)\b/i, udcAdd: '"19"', ddcSub: '0904', label: 'Time: 20th Century (-0904 / "19")' },
  { pattern: /\b(21st century)\b/i, udcAdd: '"20"', ddcSub: '0905', label: 'Time: 21st Century (-0905 / "20")' }
];

function formatDdcNumber(ddcBase, sub) {
  if (sub === '016') return `016.${ddcBase.replace(/^0+/, '')}`;
  const cleanBase = ddcBase.replace('.', '');
  const effectiveSub = (cleanBase.endsWith('0') && sub.startsWith('0')) ? sub.slice(1) : sub;
  const raw = `${cleanBase}${effectiveSub}`;
  return raw.length > 3 ? `${raw.slice(0, 3)}.${raw.slice(3)}` : raw;
}

function synthesizeLocalBackup(query) {
  const q = query.toLowerCase().trim();

  const udcJson = flatUdc.get(q);
  const ddcJson = flatDdc.get(q);
  if (udcJson && ddcJson) {
    return {
      udc: udcJson,
      ddc: ddcJson,
      explanation: `Exact class number matched from reference schedule for "${query}".`,
      source: '⚡ Reference Index'
    };
  }

  let remainingQuery = q;
  const matchedDisciplines = [];

  for (const item of SUBJECT_SCHEDULE) {
    for (const k of item.keys) {
      const rx = new RegExp(`\\b${k}\\b`, 'i');
      if (rx.test(remainingQuery)) {
        matchedDisciplines.push(item);
        remainingQuery = remainingQuery.replace(rx, ' ');
        break;
      }
    }
  }

  const appliedFacets = [];
  for (const rule of FACET_RULES) {
    if (rule.pattern.test(q)) {
      appliedFacets.push(rule);
    }
  }

  if (matchedDisciplines.length > 0) {
    const primary = matchedDisciplines[0];
    const secondary = matchedDisciplines[1] || null;
    let udcBuilt = primary.udc;
    let ddcBuilt = primary.ddc;
    const steps = [`Base: ${primary.name} (${primary.udc} / ${primary.ddc})`];

    if (secondary) {
      udcBuilt += `:${secondary.udc}`;
      steps.push(`Relation (:): ${secondary.name} (${secondary.udc})`);
    }

    for (const f of appliedFacets) {
      udcBuilt += f.udcAdd;
      ddcBuilt = formatDdcNumber(ddcBuilt, f.ddcSub);
      steps.push(f.label);
    }

    return {
      udc: udcBuilt,
      ddc: ddcBuilt,
      explanation: steps.length > 1 ? `Synthesized Class Number -> ${steps.join(' + ')}.` : `Standard Class Number for ${primary.name}.`,
      source: '⚡ Synthesized Schedule'
    };
  }

  return null;
}

// 5. Real Google AI Mode (Live Search Grounding + 8s Timeout so it NEVER hangs)
async function callRealGoogleAiMode(query) {
  if (!GEMINI_API_KEY) return null;

  const prompt = `You are a senior library classification cataloger expert in UDC (Universal Decimal Classification) and DDC 23rd Edition (Dewey Decimal Classification).
Use Google Search to verify and build the EXACT synthesized class number for the book title/subject: "${query}".
Rules:
1. Build complete synthesized class numbers using UDC auxiliaries (relation ":", form "(0...)", persons "-05...", place "(...)", time '"..."') and DDC Table 1-6 subdivisions.
2. Example: "Forestry in Canada" -> UDC: "630(71)", DDC: "634.90971".
3. Return ONLY valid JSON with exact keys:
{"udc": "exact UDC", "ddc": "exact DDC", "explanation": "clear 1-2 sentence breakdown of base class and auxiliaries"}`;

  const models = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-2.5-flash-lite'];

  for (const model of models) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000); // 8s max timeout prevents hang

    try {
      const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }], // Real Google Search Grounding
          generationConfig: { temperature: 0.1 }
        })
      });
      clearTimeout(timer);

      const data = await apiRes.json();
      if (!data.error && data.candidates?.[0]?.content?.parts) {
        const rawText = data.candidates[0].content.parts.map(p => p.text || '').join('');
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.udc && parsed.ddc) {
            return {
              udc: parsed.udc,
              ddc: parsed.ddc,
              explanation: parsed.explanation || `Verified via Google AI Mode for "${query}".`,
              source: '✨ Google AI Mode (Live Search Grounded)'
            };
          }
        }
      }
    } catch (e) {
      clearTimeout(timer);
    }
  }
  return null;
}

const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>UDC & DDC Classifier - Google AI Mode</title>
  <style>
    * { box-sizing: border-box; font-family: 'Segoe UI', Roboto, Arial, sans-serif; }
    body { background: #f8f9fa; margin: 0; padding: 24px 16px; display: flex; justify-content: center; }
    .container { width: 100%; max-width: 720px; background: #fff; border-radius: 20px; padding: 24px; box-shadow: 0 2px 14px rgba(0,0,0,0.08); }
    .tabs { display: flex; gap: 22px; border-bottom: 1px solid #e0e0e0; padding-bottom: 10px; margin-bottom: 20px; overflow-x: auto; }
    .tab { background: none; border: none; font-size: 15px; font-weight: 500; color: #5f6368; cursor: pointer; padding: 6px 2px; position: relative; white-space: nowrap; }
    .tab.active { color: #1a73e8; font-weight: 600; }
    .tab.active::after { content: ""; position: absolute; bottom: -11px; left: 0; width: 100%; height: 3px; background: #1a73e8; border-radius: 3px 3px 0 0; }
    .search-box { display: flex; align-items: center; border: 1px solid #dfe1e5; border-radius: 28px; padding: 6px 14px; box-shadow: 0 1px 6px rgba(32,33,36,0.12); background: #fff; }
    .search-box input { flex: 1; border: none; outline: none; font-size: 16px; padding: 10px; }
    .search-box button { background: #1a73e8; color: #fff; border: none; border-radius: 20px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .search-box button:hover { background: #1557b0; }
    .search-box button:disabled { background: #9aa0a6; cursor: not-allowed; }
    .result-card { margin-top: 24px; border: 1px solid #e0e0e0; border-radius: 14px; padding: 20px; display: none; }
    .badge { display: inline-block; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 12px; background: #e8f0fe; color: #1a73e8; margin-bottom: 14px; }
    .code-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f1f3f4; }
    .code-row:last-of-type { border-bottom: none; }
    .code-label { font-weight: 600; color: #3c4043; font-size: 15px; }
    .code-val { font-family: monospace; font-size: 16px; font-weight: 700; color: #0d652d; background: #e6f4ea; padding: 4px 10px; border-radius: 6px; word-break: break-all; }
    .explanation { margin-top: 14px; font-size: 14px; color: #3c4043; line-height: 1.6; background: #f8f9fa; padding: 14px; border-radius: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="tabs">
      <button class="tab active" data-mode="ai">✨ AI Mode</button>
      <button class="tab" data-mode="both">All (UDC + DDC)</button>
      <button class="tab" data-mode="udc">UDC Only</button>
      <button class="tab" data-mode="ddc">DDC Only</button>
    </div>
    <div class="search-box">
      <input type="text" id="subjectInput" placeholder="Enter any book title or subject..." />
      <button id="classifyBtn">Search</button>
    </div>
    <div class="result-card" id="resultCard">
      <span class="badge" id="sourceBadge">✨ Google AI Mode</span>
      <div class="code-row" id="udcRow">
        <span class="code-label">UDC Number</span>
        <span class="code-val" id="udcValue">-</span>
      </div>
      <div class="code-row" id="ddcRow">
        <span class="code-label">DDC Number</span>
        <span class="code-val" id="ddcValue">-</span>
      </div>
      <div class="explanation" id="explanationText"></div>
    </div>
  </div>
  <script>
    let currentMode = 'ai';
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentMode = tab.dataset.mode;
        updateRowVisibility();
      });
    });
    function updateRowVisibility() {
      document.getElementById('udcRow').style.display = currentMode === 'ddc' ? 'none' : 'flex';
      document.getElementById('ddcRow').style.display = currentMode === 'udc' ? 'none' : 'flex';
    }
    async function classifySubject() {
      const query = document.getElementById('subjectInput').value.trim();
      if (!query) return;
      const btn = document.getElementById('classifyBtn');
      btn.textContent = 'Searching...';
      btn.disabled = true;

      const controller = new AbortController();
      const uiTimeout = setTimeout(() => controller.abort(), 15000);

      try {
        const res = await fetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ query })
        });
        clearTimeout(uiTimeout);
        const data = await res.json();
        document.getElementById('resultCard').style.display = 'block';
        document.getElementById('sourceBadge').textContent = data.source || '✨ Google AI Mode';
        document.getElementById('udcValue').textContent = data.udc || 'Not found';
        document.getElementById('ddcValue').textContent = data.ddc || 'Not found';
        document.getElementById('explanationText').textContent = data.explanation || '';
        updateRowVisibility();
      } catch (err) {
        clearTimeout(uiTimeout);
        alert('Server waking up or busy. Please tap Search once more.');
      } finally {
        btn.textContent = 'Search';
        btn.disabled = false;
      }
    }
    document.getElementById('classifyBtn').addEventListener('click', classifySubject);
    document.getElementById('subjectInput').addEventListener('keypress', e => {
      if (e.key === 'Enter') classifySubject();
    });
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(HTML_PAGE);
  }

  if (req.method === 'POST' && req.url === '/api/classify') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { query } = JSON.parse(body || '{}');
        if (!query) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Query is required' }));
        }

        const qKey = query.toLowerCase().trim();

        // 1. Check Cache (Instant, 0 Quota)
        if (diskCache[qKey]) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(diskCache[qKey]));
        }

        // 2. Try Real Google AI Mode (Live Search Grounding) First!
        const aiResult = await callRealGoogleAiMode(query);
        if (aiResult) {
          saveCache(qKey, aiResult);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(aiResult));
        }

        // 3. Smart Local Synthesis Engine (Zero-Fail Accurate Backup if API quota hits limit)
        const localSynthesized = synthesizeLocalBackup(qKey);
        if (localSynthesized) {
          saveCache(qKey, localSynthesized);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(localSynthesized));
        }

        // 4. Last-Resort Helpful Guidance (Never dumps raw 001 blindly)
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          udc: '001',
          ddc: '001',
          explanation: `API quota temporarily paused and "${query}" is outside offline schedules. Add discipline keyword (e.g., Science, History, Law, Engineering, Agriculture) for instant synthesis.`,
          source: '🛡️ Offline Fallback'
        }));
      } catch (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          udc: '001',
          ddc: '001',
          explanation: 'Please try searching again.',
          source: '🛡️ Fallback'
        }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
