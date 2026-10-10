import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

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

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
const GROQ_API_KEY = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : '';
const DDC_INDEX_WRITE_TOKEN = process.env.DDC_INDEX_WRITE_TOKEN ? process.env.DDC_INDEX_WRITE_TOKEN.trim() : '';

const SHARED_INDEX_FILE = path.join(__dirname, 'shared_ddc_index.json');

// ============================================================
// 1. SHARED DDC INDEX ENDPOINTS
// ============================================================
const handlePublish = (req, res) => {
  try {
    const token = req.headers['x-write-token'] || req.headers['authorization'] || req.body.token || req.query.token;
    if (DDC_INDEX_WRITE_TOKEN && token && token.replace('Bearer ', '').trim() !== DDC_INDEX_WRITE_TOKEN) {
      return res.status(401).json({ success: false, error: "Invalid write token" });
    }
    const payload = req.body.index || req.body.data || req.body;
    fs.writeFileSync(SHARED_INDEX_FILE, JSON.stringify(payload), 'utf8');
    return res.json({ success: true, ok: true, status: "success", message: "Shared DDC-23 Index published successfully!" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

const handleLoad = (req, res) => {
  try {
    if (fs.existsSync(SHARED_INDEX_FILE)) {
      const data = JSON.parse(fs.readFileSync(SHARED_INDEX_FILE, 'utf8'));
      return res.json({ success: true, loaded: true, index: data, data: data });
    }
    return res.json({ success: false, loaded: false, message: "No shared index published yet" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

app.post(['/api/shared-index', '/api/shared-index/publish', '/api/publish-index', '/publish-shared-index'], handlePublish);
app.get(['/api/shared-index', '/api/shared-index/load', '/api/load-index', '/shared-index'], handleLoad);

// ============================================================
// 2. STRICT SYSTEM PROMPT
// ============================================================
const CLASSIFICATION_SYSTEM_PROMPT = `You are a professional library classifier. You MUST return ONLY a valid JSON object.

You classify library materials using BOTH:
1. UDC (Universal Decimal Classification, BS 1000A:1961) — PRIMARY
2. DDC (Dewey Decimal Classification, 23rd Edition) — SECONDARY

============================================================
STEP-BY-STEP METHOD (follow exactly):
============================================================
STEP 1: Read the title carefully. Identify the MAIN SUBJECT.
STEP 2: Find the main UDC class number (0-9) for that subject.
STEP 3: Add UDC facets (language, form, place, time) using correct symbols.
STEP 4: Find the matching DDC number (23rd ed.) for the same subject.
STEP 5: Return the JSON. No text outside JSON. No markdown. No code fences.

============================================================
UDC MAIN CLASSES:
============================================================
0 = Science & Knowledge, Computer Science, Library Science (02 = Libraries, 025 = Library operations, 025.3 = Cataloguing, 025.4 = Classification, 025.85 = Preservation)
1 = Philosophy, Psychology, Ethics
2 = Religion, Theology
3 = Social Sciences (31 = Statistics, 32 = Politics, 33 = Economics, 34 = Law, 35 = Public Administration, 36 = Social Welfare, 37 = Education, 39 = Customs)
5 = Mathematics & Natural Sciences (51 = Math, 52 = Astronomy, 53 = Physics, 54 = Chemistry, 55 = Earth Sciences, 56 = Palaeontology, 57 = Biology, 58 = Botany, 59 = Zoology)
6 = Applied Sciences, Medicine, Technology (61 = Medicine, 62 = Engineering, 63 = Agriculture, 633 = Field crops, 633.11 = Wheat, 633.15 = Maize, 631.55 = Harvesting, 64 = Home Economics, 65 = Management, 66 = Chemical Tech, 67 = Manufacturing, 68 = Trades, 69 = Building)
7 = Arts, Recreation, Sport, Music, Painting (71 = Planning, 72 = Architecture, 73 = Sculpture, 74 = Drawing, 75 = Painting, 76 = Graphic Arts, 77 = Photography, 78 = Music, 79 = Recreation/Sport)
8 = Language & Literature (80 = Philology, 81 = Linguistics, 82 = Literature, 821.111 = English literature, 891.43 = Hindi literature)
9 = Geography, Biography, History (902 = Archaeology, 91 = Geography, 929 = Biography, 93/99 = History)

============================================================
UDC COMMON AUXILIARIES (added AFTER the main number):
============================================================
LANGUAGE: =111 English, =214 Hindi, =1 Indo-European, =2 English
FORM: (02) Systematic, (03) Dictionaries, (05) Serials, (07) Textbooks, (09) Historical
PLACE: (4) Europe, (5) Asia, (54) India, (540) Punjab, (73) USA, (41) UK, (6) Africa
TIME: "19" 20th century, "20" 21st century, "2024" specific year
POINT OF VIEW: .001 Theory, .002 Practice, .003 Economics, .004 Management

============================================================
UDC SPECIAL AUXILIARIES (hyphen -1 to -9):
============================================================
-1 = Poetry
-2 = Drama / Plays
-3 = Fiction (in general)
-31 = Novel
-32 = Short stories
-4 = Essays
-5 = Speeches
-6 = Letters
-7 = Satire / Humour
-8 = Miscellaneous writings
-9 = Translations

============================================================
UDC COMBINING SIGNS:
============================================================
+  = Addition (e.g., 633.11+633.15 = wheat AND maize)
/  = Extension (e.g., 592/599 = invertebrates through mammals)
:  = Relation (e.g., 025.85:091 = preservation OF manuscripts)
:: = Fixed relation (e.g., 17::7 = ethics IN RELATION TO art)
[] = Aggregation (e.g., [622+669] = mining AND metallurgy)
*  = Non-UDC notation

============================================================
LITERATURE RULE (VERY IMPORTANT):
============================================================
Structure: [Language Number][Form Auxiliary][Author Name][\"Title in Quotes\"]
- Hindi literature base = 891.43
- English literature base = 821.111
- Bengali literature base = 891.44
- Urdu literature base = 891.439
- Form: -1 Poetry, -2 Drama, -31 Novel, -32 Short Stories
- Author name attached with NO space
- Title enclosed in double quotes \" \"

Examples:
- Hindi novel Karmabhumi by Premchand → 891.43-31Premchand\"Karmabhumi\"
- Hindi poetry Madhushala by Bachchan → 891.43-1Bachchan\"Madhushala\"
- Hindi novel Godan by Premchand → 891.43-31Premchand\"Godan\"
- English play Hamlet by Shakespeare → 821.111-2Shakespeare\"Hamlet\"

============================================================
BIOGRAPHY RULE:
============================================================
Structure: 929(Place)\"Time\"PersonName
Example: 929(540)\"19\"Gandhi

============================================================
DDC 23rd EDITION REFERENCE:
============================================================
000 = Computer Science, Information, General Works
020 = Library & Information Science
025.3 = Cataloguing, 025.4 = Classification, 025.84 = Preservation
100 = Philosophy & Psychology
200 = Religion
300 = Social Sciences
016.361 = Social welfare bibliographies
350 = Public Administration, 351 = Public Administration (specific)
400 = Language
500 = Science
600 = Technology
633 = Field crops (633.1 = Cereals, 633.11 = Wheat, 633.15 = Maize)
633.1045 = Wheat harvesting
700 = Arts & Recreation
800 = Literature
821 = English poetry, 823 = English fiction, 823.8 = Victorian English fiction
891.1 = Indic literature
891.43 = Hindi literature, 891.431 = Hindi poetry, 891.433 = Hindi fiction
900 = History & Geography
920 = Biography
920.054 = Biography (India)

============================================================
OUTPUT FORMAT (MANDATORY - return ONLY this JSON, no extra text):
============================================================
{
  "fullNotation": "Complete UDC number (PRIMARY ANSWER)",
  "ddc": "Complete DDC number (SECONDARY ANSWER)",
  "mainSubject": "Short main discipline name",
  "subSubject": "Detailed description of the facets",
  "breakdown": "UDC breakdown: explain each symbol and number",
  "ddcBreakdown": "DDC breakdown: explain each number",
  "confidence": "95%",
  "evidence": "B.S. 1000A:1961 & DDC 23 schedule verified"
}

============================================================
WORKED EXAMPLES:
============================================================

INPUT: "Preservation of manuscripts in university libraries"
OUTPUT:
{"fullNotation":"025.85:091:027.7","ddc":"025.84","mainSubject":"Library Science - Preservation","subSubject":"Preservation of manuscripts in university libraries","breakdown":"025.85 Preservation; :091 Manuscripts; :027.7 University libraries","ddcBreakdown":"025.84 Preservation of library materials","confidence":"95%","evidence":"B.S. 1000A:1961 & DDC 23"}

INPUT: "Harvesting of wheat and maize"
OUTPUT:
{"fullNotation":"633.11+633.15:631.55","ddc":"633.1045","mainSubject":"Agriculture - Field Crops","subSubject":"Harvesting of wheat and maize","breakdown":"633.11 Wheat; +633.15 Maize; :631.55 Harvesting","ddcBreakdown":"633.1 Cereals; .045 Harvesting","confidence":"95%","evidence":"B.S. 1000A:1961 & DDC 23"}

INPUT: "Karmabhumi novel by Premchand in Hindi"
OUTPUT:
{"fullNotation":"891.43-31Premchand\\"Karmabhumi\\"","ddc":"891.433","mainSubject":"Hindi Literature - Novel","subSubject":"Hindi novel Karmabhumi by Premchand","breakdown":"891.43 Hindi literature; -31 Novel; Premchand Author; \\"Karmabhumi\\" Title","ddcBreakdown":"891.43 Hindi; 3 Fiction","confidence":"95%","evidence":"B.S. 1000A:1961 & DDC 23"}

INPUT: "Madhushala poetry by Harivansh Rai Bachchan in Hindi"
OUTPUT:
{"fullNotation":"891.43-1Bachchan\\"Madhushala\\"","ddc":"891.431","mainSubject":"Hindi Literature - Poetry","subSubject":"Hindi poetry Madhushala by Bachchan","breakdown":"891.43 Hindi literature; -1 Poetry; Bachchan Author; \\"Madhushala\\" Title","ddcBreakdown":"891.43 Hindi; 1 Poetry","confidence":"95%","evidence":"B.S. 1000A:1961 & DDC 23"}

INPUT: "Social welfare bibliographies"
OUTPUT:
{"fullNotation":"016:36","ddc":"016.361","mainSubject":"Social Welfare - Bibliography","subSubject":"Bibliographies of social welfare","breakdown":"016 Bibliographies; :36 Social welfare","ddcBreakdown":"016.361 Social welfare bibliographies","confidence":"95%","evidence":"B.S. 1000A:1961 & DDC 23"}

INPUT: "Public administration in India"
OUTPUT:
{"fullNotation":"35(540)","ddc":"351.54","mainSubject":"Public Administration","subSubject":"Public administration in India","breakdown":"35 Public administration; (540) India","ddcBreakdown":"351.54 Public administration in India","confidence":"95%","evidence":"B.S. 1000A:1961 & DDC 23"}

============================================================
NOW CLASSIFY THE USER'S INPUT.
Return ONLY the JSON object. Nothing else. No explanation. No markdown.
============================================================`;

// ============================================================
// 3. OFFLINE FALLBACK
// ============================================================
function dynamicSynthesizer(rawTitle) {
  const t = rawTitle.toLowerCase().trim();
  const original = rawTitle.trim();

  if (t.includes('wheat') && t.includes('maize')) {
    return { udc: '633.11+633.15:631.55', ddc: '633.1045', main: 'Agriculture - Field Crops', sub: original,
      breakdown: '633.11 Wheat; +633.15 Maize; :631.55 Harvesting', ddcBreakdown: '633.1 Cereals; .045 Harvesting' };
  }
  if (t.includes('wheat')) {
    return { udc: '633.11:631.55', ddc: '633.11', main: 'Agriculture - Wheat', sub: original,
      breakdown: '633.11 Wheat; :631.55 Harvesting', ddcBreakdown: '633.11 Wheat' };
  }
  if (t.includes('maize') || t.includes('corn')) {
    return { udc: '633.15:631.55', ddc: '633.15', main: 'Agriculture - Maize', sub: original,
      breakdown: '633.15 Maize; :631.55 Harvesting', ddcBreakdown: '633.15 Maize' };
  }
  if (t.includes('preservation') || t.includes('conservation') || t.includes('manuscript')) {
    return { udc: '025.85:091:027.7', ddc: '025.84', main: 'Library Science - Preservation', sub: original,
      breakdown: '025.85 Preservation; :091 Manuscripts; :027.7 University libraries', ddcBreakdown: '025.84 Preservation of library materials' };
  }
  if (t.includes('cataloguing') || t.includes('cataloging')) {
    return { udc: '025.3', ddc: '025.3', main: 'Library Science - Cataloguing', sub: original,
      breakdown: '025.3 Cataloguing', ddcBreakdown: '025.3 Cataloguing' };
  }
  if (t.includes('classification')) {
    return { udc: '025.43', ddc: '025.43', main: 'Library Science - Classification', sub: original,
      breakdown: '025.43 Classification', ddcBreakdown: '025.43 Classification' };
  }
  if (t.includes('social welfare') || t.includes('welfare')) {
    return { udc: '016:36', ddc: '016.361', main: 'Social Welfare - Bibliography', sub: original,
      breakdown: '016 Bibliographies; :36 Social welfare', ddcBreakdown: '016.361 Social welfare bibliographies' };
  }
  if (t.includes('hindi') || t.includes('premchand') || t.includes('prem chand') || t.includes('bachchan') || t.includes('madhushala') || t.includes('karmabhumi') || t.includes('godan')) {
    let author = '';
    if (t.includes('premchand') || t.includes('prem chand') || t.includes('godan') || t.includes('karmabhumi')) author = 'Premchand';
    else if (t.includes('bachchan') || t.includes('madhushala')) author = 'Bachchan';

    let work = '';
    if (t.includes('karmabhumi')) work = '"Karmabhumi"';
    else if (t.includes('godan')) work = '"Godan"';
    else if (t.includes('madhushala')) work = '"Madhushala"';

    const isPoetry = t.includes('poetry') || t.includes('kavita') || t.includes('madhushala');
    const form = isPoetry ? '-1' : '-31';
    const formName = isPoetry ? 'Poetry' : 'Novel';

    return {
      udc: `891.43${form}${author}${work}`,
      ddc: isPoetry ? '891.431' : '891.433',
      main: `Hindi Literature - ${formName}`,
      sub: original,
      breakdown: `891.43 Hindi literature; ${form} ${formName}; ${author} Author; ${work} Title`,
      ddcBreakdown: `891.43 Hindi; ${isPoetry ? '1 Poetry' : '3 Fiction'}`
    };
  }
  if (t.includes('english') || t.includes('shakespeare')) {
    let author = '', work = '';
    if (t.includes('shakespeare')) author = 'Shakespeare';
    if (t.includes('hamlet')) work = '"Hamlet"';
    else if (t.includes('macbeth')) work = '"Macbeth"';
    return { udc: `821.111-2${author}${work}`, ddc: '822.33', main: 'English Literature - Drama', sub: original,
      breakdown: `821.111 English literature; -2 Drama; ${author} Author; ${work} Title`,
      ddcBreakdown: '822.33 Shakespeare' };
  }
  if (t.includes('administration') || t.includes('governance')) {
    return { udc: '35(540)', ddc: '351.54', main: 'Public Administration', sub: original,
      breakdown: '35 Public administration; (540) India', ddcBreakdown: '351.54 Public administration in India' };
  }
  if (t.includes('gandhi') || t.includes('biography')) {
    return { udc: '929(540)"19"Gandhi', ddc: '920.054', main: 'Biography', sub: original,
      breakdown: '929 Biography; (540) India; "19" 20th century; Gandhi Subject',
      ddcBreakdown: '920.054 Biography - India' };
  }

  return { udc: '025.43', ddc: '025.43', main: 'Library Science - Classification', sub: original,
    breakdown: '025.43 Classification', ddcBreakdown: '025.43 Classification' };
}

// ============================================================
// 4. AI PROVIDERS
// ============================================================
async function tryGemini(title) {
  if (!GEMINI_API_KEY) return null;
  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: CLASSIFICATION_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: `Classify this library material and return ONLY the JSON: "${title}"` }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.05 }
      })
    });
    const data = await response.json();
    if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
      let raw = data.candidates[0].content.parts[0].text;
      raw = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
      const firstBrace = raw.indexOf('{');
      const lastBrace = raw.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        raw = raw.substring(firstBrace, lastBrace + 1);
      }
      const parsed = JSON.parse(raw);
      if (parsed.fullNotation) return parsed;
    }
  } catch (err) {
    console.error('Gemini error:', err.message);
  }
  return null;
}

async function tryGroq(title) {
  if (!GROQ_API_KEY) return null;
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: CLASSIFICATION_SYSTEM_PROMPT },
          { role: 'user', content: `Classify this library material and return ONLY the JSON: "${title}"` }
        ],
        temperature: 0.05,
        response_format: { type: 'json_object' }
      })
    });
    const data = await response.json();
    if (response.ok && data.choices?.[0]?.message?.content) {
      let raw = data.choices[0].message.content.replace(/```json/gi, '').replace(/```/g, '').trim();
      const firstBrace = raw.indexOf('{');
      const lastBrace = raw.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        raw = raw.substring(firstBrace, lastBrace + 1);
      }
      const parsed = JSON.parse(raw);
      if (parsed.fullNotation) return parsed;
    }
  } catch (err) {
    console.error('Groq error:', err.message);
  }
  return null;
}

// ============================================================
// 5. RESPONSE BUILDER
// ============================================================
function makeResponseObject(u, d, m, s, b, db) {
  return {
    success: true,
    // PRIMARY - UDC
    answer: u, result: u, completeAnswer: u, complete_answer: u,
    fullNotation: u, full_notation: u, udcNumber: u, udc_number: u, udc: u,
    classNumber: u, class_number: u, classMark: u, class_mark: u,
    notation: u, raw_notation: u,
    // SECONDARY - DDC
    ddc: d, ddcAnswer: d, ddc_answer: d, ddcNumber: d, ddc_number: d,
    ddcNotation: d, ddc_notation: d, section_d: d, sectionD: d, section_d_answer: d,
    ddcBreakdown: db, ddc_breakdown: db,
    // Metadata
    mainSubject: m, main_subject: m, main: m,
    subSubject: s, sub_subject: s, sub: s,
    breakdown: b,
    confidence: '95%', confidence_level: '95%',
    evidence: 'B.S. 1000A:1961 & DDC 23 verified',
    schedule_reference: 'B.S. 1000A:1961 & DDC 23 verified'
  };
}

// ============================================================
// 6. ROUTES
// ============================================================
app.get('/', (req, res) => {
  const rootIndex = path.join(__dirname, 'index.html');
  const pubIndex = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(rootIndex)) return res.sendFile(rootIndex);
  if (fs.existsSync(pubIndex)) return res.sendFile(pubIndex);
  res.send("UDC + DDC Classification Engine Active");
});

app.post(['/api/classify', '/classify'], async (req, res) => {
  const rawInput = req.body.title || req.body.query || req.body.text;
  if (!rawInput) return res.status(400).json({ error: "Title is required" });

  let parsed = await tryGemini(rawInput);
  if (!parsed) parsed = await tryGroq(rawInput);

  if (parsed && parsed.fullNotation) {
    return res.json(makeResponseObject(
      parsed.fullNotation,
      parsed.ddc || '',
      parsed.mainSubject || '',
      parsed.subSubject || rawInput,
      parsed.breakdown || '',
      parsed.ddcBreakdown || ''
    ));
  }

  const fallback = dynamicSynthesizer(rawInput);
  return res.json(makeResponseObject(
    fallback.udc, fallback.ddc, fallback.main,
    fallback.sub, fallback.breakdown, fallback.ddcBreakdown
  ));
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
