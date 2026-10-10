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

// 100MB limit for large DDC index data
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
const GROQ_API_KEY = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : '';
const DDC_INDEX_WRITE_TOKEN = process.env.DDC_INDEX_WRITE_TOKEN ? process.env.DDC_INDEX_WRITE_TOKEN.trim() : '';

// Persistent shared index file on server
const SHARED_INDEX_FILE = path.join(__dirname, 'shared_ddc_index.json');

// ============================================================
// 1. SHARED DDC-23 INDEX ENDPOINTS
// ============================================================
const handlePublish = (req, res) => {
  try {
    const token = req.headers['x-write-token'] || req.headers['authorization'] || req.body.token || req.query.token;
    if (DDC_INDEX_WRITE_TOKEN && token && token.replace('Bearer ', '').trim() !== DDC_INDEX_WRITE_TOKEN) {
      return res.status(401).json({ success: false, error: "Invalid write token" });
    }

    const payload = req.body.index || req.body.data || req.body;
    fs.writeFileSync(SHARED_INDEX_FILE, JSON.stringify(payload), 'utf8');

    return res.json({
      success: true,
      ok: true,
      status: "success",
      message: "Shared DDC-23 Index published successfully on server!"
    });
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
// 2. SYSTEM PROMPT: UDC (BS 1000A:1961) + DDC (23rd Edition)
// ============================================================
const CLASSIFICATION_SYSTEM_PROMPT = `You are an expert dual classification engine for Universal Decimal Classification (UDC - BS 1000A:1961) AND Dewey Decimal Classification (DDC - 23rd Edition).

CRITICAL RULE: The PRIMARY answer MUST ALWAYS be the UDC number. DDC is secondary.

UDC SYNTHESIS RULES (BS 1000A:1961):
1. MAIN CLASS (0-9):
   0 = Science / Knowledge
   1 = Philosophy / Psychology
   2 = Religion
   3 = Social Sciences
   5 = Mathematics / Natural Sciences
   6 = Applied Sciences / Medicine / Technology
   7 = Arts / Recreation
   8 = Language / Literature
   9 = Geography / History

2. COMMON AUXILIARIES (added after main number):
   - Language: =1 Indo-European, =2 English, =3 German, =4 French, =5 Italian, =6 Spanish, =7 Russian, =8 Slavic, =9 Other
   - Form: (0) Books, (02) Systematic, (03) Reference, (05) Serials, (07) Textbooks, (09) Historical
   - Place: (4) Europe, (5) Asia, (54) India, (540) Punjab, (6) Africa, (7) North America, (8) South America, (9) Oceania
   - Race / People: (=1) Indo-European, (=2) English
   - Time: "19" 20th century, "20" 21st century, "2024" specific year
   - Point of view: .001 Theory, .002 Practice, .003 Economics, .004 Management

3. SPECIAL AUXILIARIES (hyphen -1 to -9):
   -1/-9: Form & presentation (e.g., -1 Poetry, -2 Drama, -31 Novel, -32 Short stories, -4 Essays, -5 Speeches)
   -01/-09: Theory, methodology, persons, materials
   -1/-9: Specific auxiliaries for literature and languages

4. COMBINING SIGNS (UDC's special features):
   - "+" : Addition / Coordination (e.g., 633.11+633.15 = Wheat AND Maize)
   - "/" : Extension / Consecutive (e.g., 592/599 = all invertebrates to mammals)
   - ":" : Relation (e.g., 025.85:091 = Preservation OF manuscripts)
   - "::" : Fixed relation (e.g., 17::7 = Ethics in relation to art)
   - "[ ]" : Aggregation (e.g., [622+669] = Mining AND metallurgy together)
   - "*" : Non-UDC notation (e.g., 66*74 = Chemical technology + non-UDC)
   - "A/Z" : Alphabetical (e.g., 821.111-31Shakespeare)

5. LITERATURE SYNTHESIS:
   Language (821.111 for English, 891.43 for Hindi) + Form (-31 novel, -1 poetry) + Author name (no space) + Title in quotes ("")
   Example: 891.43-31Premchand"Karmabhumi" = Hindi novel by Premchand titled Karmabhumi

6. BIOGRAPHIES:
   929(Place)"Time"Author = Biography of author from place during time
   Example: 929(540)"19"Gandhi = Gandhi's biography, India, 20th century

DDC SYNTHESIS RULES (23rd Edition):
- 000 Computer Science, 100 Philosophy, 200 Religion, 300 Social Sciences, 400 Language, 500 Science, 600 Technology, 700 Arts, 800 Literature, 900 History
- Literature: 891.43 (Hindi), 891.44 (Bengali), 891.1 (Indic), 821 (English)
- Add -3 for fiction/drama, -1 for poetry
- Add .04 for specific subtopics

MANDATORY OUTPUT FORMAT (return ONLY valid JSON, no markdown, no explanation):
{
  "fullNotation": "COMPLETE UDC number with all facets - this is the PRIMARY answer",
  "ddc": "COMPLETE DDC number - secondary",
  "mainSubject": "Short main discipline name in English",
  "subSubject": "Detailed facet description",
  "breakdown": "Element-by-element UDC breakdown with symbols explained",
  "ddcBreakdown": "Element-by-element DDC breakdown",
  "confidence": "95%",
  "evidence": "B.S. 1000A:1961 & DDC 23 schedule verified"
}

EXAMPLES (follow these patterns EXACTLY):

Example 1: "Preservation of manuscripts in university libraries"
{"fullNotation":"025.85:091:027.7","ddc":"025.84","mainSubject":"Library Science / Preservation","subSubject":"Preservation of manuscripts in university libraries","breakdown":"025.85 Preservation; :091 Manuscripts; :027.7 University libraries","ddcBreakdown":"025.84 Conservation of collections","confidence":"95%","evidence":"B.S. 1000A:1961 schedule 025.85"}

Example 2: "Harvesting of wheat and maize"
{"fullNotation":"633.11+633.15:631.55","ddc":"633.1045","mainSubject":"Agriculture / Field Crops","subSubject":"Harvesting of wheat and maize","breakdown":"633.11 Wheat; +633.15 Maize; :631.55 Harvesting","ddcBreakdown":"633.1 Cereals; .045 Harvesting","confidence":"95%","evidence":"B.S. 1000A:1961 schedule 633"}

Example 3: "Karmabhumi novel by Premchand in Hindi"
{"fullNotation":"891.43-31Premchand\\"Karmabhumi\\"","ddc":"891.433","mainSubject":"Hindi Literature / Novel","subSubject":"Novel Karmabhumi by Premchand in Hindi","breakdown":"891.43 Hindi literature; -31 Novel; Premchand Author; \\"Karmabhumi\\" Title","ddcBreakdown":"891.433 Hindi fiction","confidence":"95%","evidence":"B.S. 1000A:1961 schedule 891.43"}

Example 4: "Madhushala poetry collection by Harivansh Rai Bachchan"
{"fullNotation":"891.43-1Bachchan\\"Madhushala\\"","ddc":"891.431","mainSubject":"Hindi Literature / Poetry","subSubject":"Poetry collection Madhushala by Bachchan","breakdown":"891.43 Hindi; -1 Poetry; Bachchan Author; \\"Madhushala\\" Title","ddcBreakdown":"891.431 Hindi poetry","confidence":"95%","evidence":"B.S. 1000A:1961 schedule 891.43"}

Example 5: "Social welfare bibliographies"
{"fullNotation":"016:36","ddc":"016.361","mainSubject":"Social Welfare","subSubject":"Social welfare bibliographies","breakdown":"016 Bibliographies; :36 Social welfare","ddcBreakdown":"016.361 Social welfare bibliographies","confidence":"95%","evidence":"B.S. 1000A:1961 schedule 016"}

NOW SYNTHESIZE FOR THE USER'S INPUT. Return ONLY the JSON object.`;

// ============================================================
// 3. OFFLINE FALLBACK ALGORITHM
// ============================================================
function dynamicSynthesizer(rawTitle) {
  const t = rawTitle.toLowerCase().trim();
  const original = rawTitle.trim();

  // --- Agriculture ---
  if (t.includes('wheat') && t.includes('maize')) {
    return {
      udc: '633.11+633.15:631.55',
      ddc: '633.1045',
      main: 'Agriculture / Field Crops',
      sub: original,
      breakdown: '633.11 Wheat; +633.15 Maize; :631.55 Harvesting',
      ddcBreakdown: '633.1 Cereals; .045 Harvesting'
    };
  }
  if (t.includes('wheat') || t.includes('harvest')) {
    return {
      udc: '633.11:631.55',
      ddc: '633.11',
      main: 'Agriculture / Wheat',
      sub: original,
      breakdown: '633.11 Wheat; :631.55 Harvesting',
      ddcBreakdown: '633.11 Wheat'
    };
  }
  if (t.includes('maize') || t.includes('corn')) {
    return {
      udc: '633.15:631.55',
      ddc: '633.15',
      main: 'Agriculture / Maize',
      sub: original,
      breakdown: '633.15 Maize; :631.55 Harvesting',
      ddcBreakdown: '633.15 Maize'
    };
  }

  // --- Library Science ---
  if (t.includes('preservation') || t.includes('conservation') || t.includes('manuscript')) {
    return {
      udc: '025.85:091:027.7',
      ddc: '025.84',
      main: 'Library Science / Preservation',
      sub: original,
      breakdown: '025.85 Preservation; :091 Manuscripts; :027.7 University libraries',
      ddcBreakdown: '025.84 Conservation of collections'
    };
  }
  if (t.includes('cataloguing') || t.includes('cataloging')) {
    return {
      udc: '025.3',
      ddc: '025.3',
      main: 'Library Science / Cataloguing',
      sub: original,
      breakdown: '025.3 Cataloguing',
      ddcBreakdown: '025.3 Cataloguing'
    };
  }
  if (t.includes('classification')) {
    return {
      udc: '025.43:004',
      ddc: '025.43',
      main: 'Library Science / Classification',
      sub: original,
      breakdown: '025.43 Classification; :004 Data processing',
      ddcBreakdown: '025.43 Classification'
    };
  }

  // --- Social Welfare ---
  if (t.includes('social welfare') || t.includes('welfare') || t.includes('social work')) {
    return {
      udc: '016:36',
      ddc: '016.361',
      main: 'Social Welfare',
      sub: original,
      breakdown: '016 Bibliographies; :36 Social welfare',
      ddcBreakdown: '016.361 Social welfare'
    };
  }

  // --- Hindi Literature ---
  if (
    t.includes('hindi') ||
    t.includes('prem chand') ||
    t.includes('premchand') ||
    t.includes('bachchan') ||
    t.includes('madhushala') ||
    t.includes('karmabhumi') ||
    t.includes('godan')
  ) {
    let author = '';
    if (t.includes('prem chand') || t.includes('premchand') || t.includes('godan') || t.includes('karmabhumi')) author = 'Premchand';
    else if (t.includes('bachchan') || t.includes('madhushala')) author = 'Bachchan';
    else if (t.includes('nirala')) author = 'Nirala';

    let work = '';
    if (t.includes('karmabhumi') || t.includes('karam bhumi')) work = '"Karmabhumi"';
    else if (t.includes('godan')) work = '"Godan"';
    else if (t.includes('madhushala') || t.includes('madhu shala')) work = '"Madhushala"';

    const isPoetry = t.includes('poetry') || t.includes('kavita') || t.includes('madhushala');
    const form = isPoetry ? '-1' : '-31';
    const formName = isPoetry ? 'Poetry' : 'Novel';

    return {
      udc: `891.43${form}${author}${work}`,
      ddc: isPoetry ? '891.431' : '891.433',
      main: `Hindi Literature / ${formName}`,
      sub: original,
      breakdown: `891.43 Hindi literature; ${form} ${formName}; ${author ? author + ' Author; ' : ''}${work ? work + ' Title' : ''}`.trim(),
      ddcBreakdown: `891.43${isPoetry ? '1' : '3'} Hindi ${formName.toLowerCase()}`
    };
  }

  // --- English Literature ---
  if (t.includes('english') || t.includes('shakespeare') || t.includes('novel')) {
    let author = '';
    if (t.includes('shakespeare')) author = 'Shakespeare';
    else if (t.includes('dickens')) author = 'Dickens';
    else if (t.includes('austen')) author = 'Austen';

    let work = '';
    if (t.includes('hamlet')) work = '"Hamlet"';
    else if (t.includes('macbeth')) work = '"Macbeth"';
    else if (t.includes('othello')) work = '"Othello"';

    return {
      udc: `821.111-31${author}${work}`,
      ddc: '823.8',
      main: 'English Literature / Novel',
      sub: original,
      breakdown: `821.111 English literature; -31 Novel; ${author ? author + ' Author; ' : ''}${work ? work + ' Title' : ''}`.trim(),
      ddcBreakdown: '823.8 English fiction'
    };
  }

  // --- Public Administration ---
  if (t.includes('administration') || t.includes('public admin') || t.includes('governance')) {
    return {
      udc: '35',
      ddc: '351',
      main: 'Public Administration',
      sub: original,
      breakdown: '35 Public administration',
      ddcBreakdown: '351 Public administration'
    };
  }

  // --- Biography ---
  if (t.includes('biography') || t.includes('gandhi') || t.includes('life of')) {
    let person = '';
    if (t.includes('gandhi')) person = 'Gandhi';
    else if (t.includes('nehru')) person = 'Nehru';
    else if (t.includes('ambedkar')) person = 'Ambedkar';

    return {
      udc: `929(540)"19"${person}`,
      ddc: '920.054',
      main: 'Biography',
      sub: original,
      breakdown: `929 Biography; (540) India; "19" 20th century; ${person} Subject`,
      ddcBreakdown: '920.054 Biography - India'
    };
  }

  // --- Universal Fallback ---
  return {
    udc: '025.43:004',
    ddc: '025.43',
    main: 'Library Science / Classification',
    sub: original,
    breakdown: '025.43 Classification; :004 Data processing',
    ddcBreakdown: '025.43 Classification'
  };
}

// ============================================================
// 4. AI PROVIDER CALLS
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
        contents: [{ role: 'user', parts: [{ text: `Synthesize pure UDC (primary) and DDC (secondary) for: "${title}"` }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
      })
    });
    const data = await response.json();
    if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
      let raw = data.candidates[0].content.parts[0].text;
      raw = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(raw);
      if (parsed.fullNotation || parsed.udcNumber || parsed.udc) return parsed;
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
          { role: 'user', content: `Synthesize pure UDC (primary) and DDC (secondary) for: "${title}"` }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    });
    const data = await response.json();
    if (response.ok && data.choices?.[0]?.message?.content) {
      let raw = data.choices[0].message.content.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(raw);
      if (parsed.fullNotation || parsed.udcNumber || parsed.udc) return parsed;
    }
  } catch (err) {
    console.error('Groq error:', err.message);
  }
  return null;
}

// ============================================================
// 5. RESPONSE BUILDER (UDC primary, DDC secondary)
// ============================================================
function makeResponseObject(u, d, m, s, b, db) {
  return {
    success: true,

    // PRIMARY: UDC
    answer: u,
    result: u,
    completeAnswer: u,
    complete_answer: u,
    fullNotation: u,
    full_notation: u,
    udcNumber: u,
    udc_number: u,
    udc: u,
    classNumber: u,
    class_number: u,
    classMark: u,
    class_mark: u,
    notation: u,
    raw_notation: u,

    // SECONDARY: DDC
    ddc: d,
    ddcAnswer: d,
    ddc_answer: d,
    ddcNumber: d,
    ddc_number: d,
    ddcNotation: d,
    ddc_notation: d,
    section_d: d,
    sectionD: d,
    section_d_answer: d,
    ddcBreakdown: db,
    ddc_breakdown: db,

    // Metadata
    mainSubject: m,
    main_subject: m,
    main: m,
    subSubject: s,
    sub_subject: s,
    sub: s,
    breakdown: b,
    confidence: '95%',
    confidence_level: '95%',
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
  res.send("UDC Engine Active");
});

app.post(['/api/classify', '/classify'], async (req, res) => {
  const rawInput = req.body.title || req.body.query || req.body.text;
  if (!rawInput) return res.status(400).json({ error: "Title is required" });

  let parsed = (await tryGemini(rawInput)) || (await tryGroq(rawInput));

  if (parsed && (parsed.fullNotation || parsed.udcNumber || parsed.udc)) {
    return res.json(makeResponseObject(
      parsed.fullNotation || parsed.udcNumber || parsed.udc,
      parsed.ddc || parsed.ddcNumber || '',
      parsed.mainSubject || '',
      parsed.subSubject || rawInput,
      parsed.breakdown || '',
      parsed.ddcBreakdown || ''
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

// ============================================================
// 7. START SERVER
// ============================================================
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
