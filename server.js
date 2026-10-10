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
// 1. SHARED INDEX ENDPOINTS
// ============================================================
const handlePublish = (req, res) => {
  try {
    const token = req.headers['x-write-token'] || req.headers['authorization'] || req.body.token || req.query.token;
    if (DDC_INDEX_WRITE_TOKEN && token && token.replace('Bearer ', '').trim() !== DDC_INDEX_WRITE_TOKEN) {
      return res.status(401).json({ success: false, error: "Invalid write token" });
    }
    const payload = req.body.index || req.body.data || req.body;
    fs.writeFileSync(SHARED_INDEX_FILE, JSON.stringify(payload), 'utf8');
    return res.json({ success: true, ok: true, status: "success", message: "Shared index published!" });
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
// 2. KNOWLEDGE BASE — Keyword to UDC/DDC mapping
// Order matters: more specific keywords first
// ============================================================
const KNOWLEDGE_BASE = [
  // ---------- LIBRARY & INFORMATION SCIENCE ----------
  { keys: ['preservation', 'conservation', 'manuscript'], udc: '025.85:091:027.7', ddc: '025.84',
    main: 'Library Science - Preservation',
    bd: '025.85 Preservation; :091 Manuscripts; :027.7 University libraries',
    db: '025.84 Preservation of library materials' },
  { keys: ['cataloguing', 'cataloging', 'catalogue'], udc: '025.3', ddc: '025.3',
    main: 'Library Science - Cataloguing', bd: '025.3 Cataloguing', db: '025.3 Cataloguing' },
  { keys: ['classification', 'dewey', 'udc scheme'], udc: '025.43', ddc: '025.43',
    main: 'Library Science - Classification', bd: '025.43 Classification', db: '025.43 Classification' },
  { keys: ['library science', 'librarianship', 'library'], udc: '02', ddc: '020',
    main: 'Library Science', bd: '02 Libraries', db: '020 Library & Information Science' },
  { keys: ['information science', 'information retrieval'], udc: '025.4:004', ddc: '025.04',
    main: 'Information Science', bd: '025.4 Information retrieval; :004 Data processing', db: '025.04 Information storage' },

  // ---------- AGRICULTURE ----------
  { keys: ['wheat', 'maize', 'corn'], udc: '633.11+633.15:631.55', ddc: '633.1045',
    main: 'Agriculture - Field Crops',
    bd: '633.11 Wheat; +633.15 Maize; :631.55 Harvesting', db: '633.1 Cereals; .045 Harvesting' },
  { keys: ['wheat'], udc: '633.11:631.55', ddc: '633.11',
    main: 'Agriculture - Wheat', bd: '633.11 Wheat; :631.55 Harvesting', db: '633.11 Wheat' },
  { keys: ['maize', 'corn'], udc: '633.15:631.55', ddc: '633.15',
    main: 'Agriculture - Maize', bd: '633.15 Maize; :631.55 Harvesting', db: '633.15 Maize' },
  { keys: ['rice', 'paddy'], udc: '633.18:631.55', ddc: '633.18',
    main: 'Agriculture - Rice', bd: '633.18 Rice; :631.55 Harvesting', db: '633.18 Rice' },
  { keys: ['harvest', 'harvesting', 'crop'], udc: '631.55', ddc: '631.55',
    main: 'Agriculture - Harvesting', bd: '631.55 Harvesting', db: '631.55 Harvesting' },
  { keys: ['agriculture', 'farming', 'crop'], udc: '63', ddc: '630',
    main: 'Agriculture', bd: '63 Agriculture', db: '630 Agriculture' },
  { keys: ['soil'], udc: '631.4', ddc: '631.4',
    main: 'Agriculture - Soil Science', bd: '631.4 Soil science', db: '631.4 Soil science' },
  { keys: ['irrigation'], udc: '631.67', ddc: '631.587',
    main: 'Agriculture - Irrigation', bd: '631.67 Irrigation', db: '631.587 Irrigation' },

  // ---------- MEDICINE ----------
  { keys: ['cancer', 'oncology'], udc: '616-006', ddc: '616.994',
    main: 'Medicine - Oncology', bd: '616-006 Tumours', db: '616.994 Cancer' },
  { keys: ['diabetes'], udc: '616.379', ddc: '616.462',
    main: 'Medicine - Diabetes', bd: '616.379 Diabetes', db: '616.462 Diabetes' },
  { keys: ['cardiology', 'heart'], udc: '616.12', ddc: '616.12',
    main: 'Medicine - Cardiology', bd: '616.12 Heart diseases', db: '616.12 Cardiology' },
  { keys: ['medicine', 'medical', 'surgery'], udc: '61', ddc: '610',
    main: 'Medicine', bd: '61 Medicine', db: '610 Medicine' },
  { keys: ['nursing'], udc: '616-083', ddc: '610.73',
    main: 'Nursing', bd: '616-083 Nursing care', db: '610.73 Nursing' },

  // ---------- ENGINEERING & TECHNOLOGY ----------
  { keys: ['computer', 'computing', 'software', 'programming', 'algorithm'], udc: '004', ddc: '004',
    main: 'Computer Science', bd: '004 Computer science', db: '004 Data processing' },
  { keys: ['artificial intelligence', 'machine learning', 'neural'], udc: '004.85', ddc: '006.3',
    main: 'Artificial Intelligence', bd: '004.85 Machine learning', db: '006.3 AI' },
  { keys: ['electrical', 'electronics'], udc: '621.3', ddc: '621.3',
    main: 'Electrical Engineering', bd: '621.3 Electrical engineering', db: '621.3 Electrical' },
  { keys: ['mechanical engineering', 'mechanics'], udc: '621', ddc: '621',
    main: 'Mechanical Engineering', bd: '621 Mechanical engineering', db: '621 Mechanical' },
  { keys: ['civil engineering', 'construction'], udc: '624', ddc: '624',
    main: 'Civil Engineering', bd: '624 Civil engineering', db: '624 Civil engineering' },
  { keys: ['engineering'], udc: '62', ddc: '620',
    main: 'Engineering', bd: '62 Engineering', db: '620 Engineering' },
  { keys: ['chemical engineering'], udc: '66', ddc: '660',
    main: 'Chemical Engineering', bd: '66 Chemical technology', db: '660 Chemical engineering' },

  // ---------- PURE SCIENCE ----------
  { keys: ['physics', 'quantum', 'relativity'], udc: '53', ddc: '530',
    main: 'Physics', bd: '53 Physics', db: '530 Physics' },
  { keys: ['chemistry', 'chemical'], udc: '54', ddc: '540',
    main: 'Chemistry', bd: '54 Chemistry', db: '540 Chemistry' },
  { keys: ['biology', 'botany', 'zoology'], udc: '57', ddc: '570',
    main: 'Biology', bd: '57 Biology', db: '570 Life sciences' },
  { keys: ['mathematics', 'maths', 'algebra', 'geometry', 'calculus'], udc: '51', ddc: '510',
    main: 'Mathematics', bd: '51 Mathematics', db: '510 Mathematics' },
  { keys: ['astronomy', 'space', 'stars', 'planets'], udc: '52', ddc: '520',
    main: 'Astronomy', bd: '52 Astronomy', db: '520 Astronomy' },
  { keys: ['geology', 'earth science'], udc: '55', ddc: '550',
    main: 'Earth Sciences', bd: '55 Earth sciences', db: '550 Earth sciences' },
  { keys: ['science'], udc: '5', ddc: '500',
    main: 'Science', bd: '5 Science', db: '500 Science' },

  // ---------- SOCIAL SCIENCES ----------
  { keys: ['social welfare', 'welfare', 'social work'], udc: '016:36', ddc: '016.361',
    main: 'Social Welfare', bd: '016 Bibliographies; :36 Social welfare', db: '016.361 Social welfare bibliographies' },
  { keys: ['sociology', 'society'], udc: '316', ddc: '301',
    main: 'Sociology', bd: '316 Sociology', db: '301 Sociology' },
  { keys: ['economics', 'economy', 'finance', 'banking'], udc: '33', ddc: '330',
    main: 'Economics', bd: '33 Economics', db: '330 Economics' },
  { keys: ['law', 'legal', 'jurisprudence'], udc: '34', ddc: '340',
    main: 'Law', bd: '34 Law', db: '340 Law' },
  { keys: ['education', 'teaching', 'pedagogy'], udc: '37', ddc: '370',
    main: 'Education', bd: '37 Education', db: '370 Education' },
  { keys: ['politics', 'political'], udc: '32', ddc: '320',
    main: 'Political Science', bd: '32 Politics', db: '320 Political science' },
  { keys: ['public administration', 'administration', 'governance'], udc: '35(540)', ddc: '351.54',
    main: 'Public Administration', bd: '35 Public administration; (540) India', db: '351.54 Public administration in India' },
  { keys: ['social science'], udc: '3', ddc: '300',
    main: 'Social Sciences', bd: '3 Social sciences', db: '300 Social sciences' },

  // ---------- PHILOSOPHY & RELIGION ----------
  { keys: ['philosophy', 'ethics', 'logic'], udc: '1', ddc: '100',
    main: 'Philosophy', bd: '1 Philosophy', db: '100 Philosophy' },
  { keys: ['psychology', 'mind'], udc: '159.9', ddc: '150',
    main: 'Psychology', bd: '159.9 Psychology', db: '150 Psychology' },
  { keys: ['religion', 'theology', 'god'], udc: '2', ddc: '200',
    main: 'Religion', bd: '2 Religion', db: '200 Religion' },
  { keys: ['hinduism', 'hindu'], udc: '233-24', ddc: '294.5',
    main: 'Hinduism', bd: '233-24 Hinduism', db: '294.5 Hinduism' },
  { keys: ['islam', 'muslim', 'quran'], udc: '28', ddc: '297',
    main: 'Islam', bd: '28 Islam', db: '297 Islam' },
  { keys: ['christianity', 'christian', 'bible'], udc: '27', ddc: '230',
    main: 'Christianity', bd: '27 Christianity', db: '230 Christianity' },
  { keys: ['sikhism', 'sikh', 'guru granth'], udc: '233-24:294.5', ddc: '294.6',
    main: 'Sikhism', bd: '233-24 Sikh religion', db: '294.6 Sikhism' },

  // ---------- ARTS & RECREATION ----------
  { keys: ['music', 'song', 'raga'], udc: '78', ddc: '780',
    main: 'Music', bd: '78 Music', db: '780 Music' },
  { keys: ['painting', 'art', 'drawing'], udc: '75', ddc: '750',
    main: 'Painting', bd: '75 Painting', db: '750 Painting' },
  { keys: ['photography', 'photo'], udc: '77', ddc: '770',
    main: 'Photography', bd: '77 Photography', db: '770 Photography' },
  { keys: ['sports', 'cricket', 'football', 'hockey'], udc: '796', ddc: '796',
    main: 'Sports', bd: '796 Sports', db: '796 Sports' },
  { keys: ['architecture', 'building design'], udc: '72', ddc: '720',
    main: 'Architecture', bd: '72 Architecture', db: '720 Architecture' },
  { keys: ['cinema', 'film', 'movie'], udc: '791.43', ddc: '791.43',
    main: 'Cinema', bd: '791.43 Cinema', db: '791.43 Motion pictures' },

  // ---------- LANGUAGE & LITERATURE ----------
  { keys: ['hindi', 'premchand', 'prem chand', 'bachchan', 'madhushala', 'karmabhumi', 'godan', 'nirala', 'pant', 'mahadevi'], 
    udc: '891.43-31', ddc: '891.433',
    main: 'Hindi Literature', bd: '891.43 Hindi literature; -31 Novel', db: '891.43 Hindi literature' },
  { keys: ['english literature', 'shakespeare', 'hamlet', 'macbeth', 'dickens', 'austen'], 
    udc: '821.111-2', ddc: '822.33',
    main: 'English Literature', bd: '821.111 English literature; -2 Drama', db: '821 English literature' },
  { keys: ['bengali', 'tagore', 'gitanjali'], udc: '891.44-1', ddc: '891.441',
    main: 'Bengali Literature', bd: '891.44 Bengali literature; -1 Poetry', db: '891.44 Bengali literature' },
  { keys: ['urdu', 'ghalib', 'iqbal'], udc: '891.439-1', ddc: '891.4391',
    main: 'Urdu Literature', bd: '891.439 Urdu literature; -1 Poetry', db: '891.439 Urdu literature' },
  { keys: ['punjabi', 'gurbani', 'amrita pritam'], udc: '891.42-1', ddc: '891.421',
    main: 'Punjabi Literature', bd: '891.42 Punjabi literature; -1 Poetry', db: '891.421 Punjabi literature' },
  { keys: ['sanskrit', 'vedas', 'upanishad'], udc: '891.2', ddc: '891.2',
    main: 'Sanskrit Literature', bd: '891.2 Sanskrit literature', db: '891.2 Sanskrit' },
  { keys: ['poetry', 'poem', 'kavita'], udc: '82-1', ddc: '808.81',
    main: 'Poetry', bd: '82-1 Poetry', db: '808.81 Poetry' },
  { keys: ['novel', 'fiction'], udc: '82-31', ddc: '808.3',
    main: 'Fiction / Novel', bd: '82-31 Novel', db: '808.3 Fiction' },
  { keys: ['drama', 'play'], udc: '82-2', ddc: '808.82',
    main: 'Drama', bd: '82-2 Drama', db: '808.82 Drama' },
  { keys: ['literature'], udc: '82', ddc: '800',
    main: 'Literature', bd: '82 Literature', db: '800 Literature' },
  { keys: ['language', 'linguistics'], udc: '81', ddc: '410',
    main: 'Linguistics', bd: '81 Linguistics', db: '410 Linguistics' },

  // ---------- HISTORY & GEOGRAPHY ----------
  { keys: ['biography', 'life of', 'gandhi', 'nehru', 'ambedkar'], udc: '929(540)"19"', ddc: '920.054',
    main: 'Biography', bd: '929 Biography; (540) India; "19" 20th century', db: '920.054 Biography India' },
  { keys: ['history', 'historical'], udc: '94', ddc: '900',
    main: 'History', bd: '94 History', db: '900 History' },
  { keys: ['geography', 'atlas', 'maps'], udc: '91', ddc: '910',
    main: 'Geography', bd: '91 Geography', db: '910 Geography' },
  { keys: ['archaeology', 'excavation'], udc: '902', ddc: '930.1',
    main: 'Archaeology', bd: '902 Archaeology', db: '930.1 Archaeology' },
  { keys: ['india', 'indian'], udc: '(540)', ddc: '954',
    main: 'India', bd: '(540) India', db: '954 India' },
  { keys: ['travel', 'tourism'], udc: '910.4', ddc: '910.4',
    main: 'Travel', bd: '910.4 Travel', db: '910.4 Travel' },

  // ---------- GENERAL / MISCELLANEOUS ----------
  { keys: ['dictionary', 'encyclopedia', 'reference'], udc: '(031)', ddc: '030',
    main: 'Reference Works', bd: '(031) Reference works', db: '030 Encyclopedias' },
  { keys: ['journal', 'periodical', 'magazine'], udc: '(051)', ddc: '050',
    main: 'Periodicals', bd: '(051) Periodicals', db: '050 General serials' },
  { keys: ['management', 'business', 'administration of'], udc: '65', ddc: '650',
    main: 'Management', bd: '65 Management', db: '650 Management' },
  { keys: ['home', 'family', 'cooking', 'cookery'], udc: '64', ddc: '640',
    main: 'Home Economics', bd: '64 Home economics', db: '640 Home & family' }
];

// ============================================================
// 3. RULE-BASED CLASSIFIER (works for ANY title)
// ============================================================
function detectLanguage(title) {
  const t = title.toLowerCase();
  if (/\b(hindi|premchand|prem chand|bachchan|madhushala|karmabhumi|godan|nirala|pant)\b/.test(t)) return 'hindi';
  if (/\b(bengali|tagore|gitanjali)\b/.test(t)) return 'bengali';
  if (/\b(urdu|ghalib|iqbal)\b/.test(t)) return 'urdu';
  if (/\b(punjabi|gurbani|amrita pritam)\b/.test(t)) return 'punjabi';
  if (/\b(sanskrit|vedas|upanishad)\b/.test(t)) return 'sanskrit';
  if (/\b(english|shakespeare|dickens|austen)\b/.test(t)) return 'english';
  return 'english'; // default to english
}

function detectForm(title) {
  const t = title.toLowerCase();
  if (/\b(poetry|poem|kavita|verse|madhushala|gitanjali)\b/.test(t)) return { code: '-1', ddc: '1', name: 'Poetry' };
  if (/\b(drama|play|natak|hamlet|macbeth|othello)\b/.test(t)) return { code: '-2', ddc: '2', name: 'Drama' };
  if (/\b(short stories|short story|kahani)\b/.test(t)) return { code: '-32', ddc: '1', name: 'Short Stories' };
  if (/\b(novel|fiction|upanyas|karmabhumi|godan)\b/.test(t)) return { code: '-31', ddc: '3', name: 'Novel' };
  if (/\b(essay|nibandh)\b/.test(t)) return { code: '-4', ddc: '4', name: 'Essays' };
  return null;
}

function extractAuthorWork(title) {
  let author = '';
  let work = '';
  const t = title.toLowerCase();

  const authorMap = {
    'premchand': 'Premchand', 'prem chand': 'Premchand',
    'bachchan': 'Bachchan', 'harivansh rai bachchan': 'Bachchan',
    'nirala': 'Nirala', 'pant': 'SumitranandanPant',
    'mahadevi': 'MahadeviVerma', 'tagore': 'Tagore',
    'shakespeare': 'Shakespeare', 'dickens': 'Dickens',
    'austen': 'Austen', 'ghalib': 'Ghalib', 'iqbal': 'Iqbal',
    'amrita pritam': 'AmritaPritam'
  };
  for (const key in authorMap) {
    if (t.includes(key)) { author = authorMap[key]; break; }
  }

  const workMap = {
    'karmabhumi': 'Karmabhumi', 'godan': 'Godan',
    'madhushala': 'Madhushala', 'gitanjali': 'Gitanjali',
    'hamlet': 'Hamlet', 'macbeth': 'Macbeth', 'othello': 'Othello'
  };
  for (const key in workMap) {
    if (t.includes(key)) { work = workMap[key]; break; }
  }
  return { author, work };
}

function buildLiteratureNotation(title) {
  const lang = detectLanguage(title);
  const form = detectForm(title);
  const { author, work } = extractAuthorWork(title);

  const langMap = {
    hindi:    { udc: '891.43',  ddc: '891.43' },
    bengali:  { udc: '891.44',  ddc: '891.44' },
    urdu:     { udc: '891.439', ddc: '891.439' },
    punjabi:  { udc: '891.42',  ddc: '891.42' },
    sanskrit: { udc: '891.2',   ddc: '891.2' },
    english:  { udc: '821.111', ddc: '821' }
  };

  const langCode = langMap[lang] || langMap.english;
  const formCode = form ? form.code : '-31';
  const formName = form ? form.name : 'Novel';
  const formDdc = form ? form.ddc : '3';

  let udc = `${langCode.udc}${formCode}`;
  let breakdownParts = [`${langCode.udc} ${lang.charAt(0).toUpperCase() + lang.slice(1)} literature`, `${formCode} ${formName}`];

  if (author) {
    udc += author;
    breakdownParts.push(`${author} Author`);
  }
  if (work) {
    udc += `"${work}"`;
    breakdownParts.push(`"${work}" Title`);
  }

  const ddc = `${langCode.ddc}${formDdc}`;

  return {
    udc,
    ddc,
    main: `${lang.charAt(0).toUpperCase() + lang.slice(1)} Literature - ${formName}`,
    sub: title.trim(),
    breakdown: breakdownParts.join('; '),
    ddcBreakdown: `${langCode.ddc} ${lang.charAt(0).toUpperCase() + lang.slice(1)} literature; ${formDdc} ${formName}`
  };
}

function classifyTitle(rawTitle) {
  const t = rawTitle.toLowerCase().trim();
  const original = rawTitle.trim();

  // Step 1: Try knowledge base (most specific first)
  for (const entry of KNOWLEDGE_BASE) {
    for (const key of entry.keys) {
      if (t.includes(key)) {
        return {
          udc: entry.udc,
          ddc: entry.ddc,
          main: entry.main,
          sub: original,
          breakdown: entry.bd,
          ddcBreakdown: entry.db
        };
      }
    }
  }

  // Step 2: Literature detection (if any literary term present)
  if (/\b(novel|poetry|poem|drama|play|fiction|kavita|upanyas|kahani|essay|writer|author|literature|book|title)\b/.test(t)) {
    return buildLiteratureNotation(original);
  }

  // Step 3: Biography detection
  if (/\b(biography|life of|memoir|autobiography)\b/.test(t)) {
    return {
      udc: '929(540)"19"',
      ddc: '920.054',
      main: 'Biography',
      sub: original,
      breakdown: '929 Biography; (540) India; "19" 20th century',
      ddcBreakdown: '920.054 Biography - India'
    };
  }

  // Step 4: Universal fallback — assign Generalities / Library Science
  // Never return "020" alone; always a real classification.
  return {
    udc: '025.43:004',
    ddc: '025.43',
    main: 'Library Science - Classification',
    sub: original,
    breakdown: '025.43 Classification; :004 Data processing',
    ddcBreakdown: '025.43 Classification'
  };
}

// ============================================================
// 4. AI PROVIDERS (optional boost)
// ============================================================
const AI_PROMPT = `You are a strict library classifier. Return ONLY a valid JSON object. No text, no markdown, no code fences.

Use UDC (BS 1000A:1961) as PRIMARY and DDC (23rd ed.) as SECONDARY.

Output EXACTLY this shape:
{"fullNotation":"UDC number","ddc":"DDC number","mainSubject":"subject","subSubject":"details","breakdown":"UDC explanation","ddcBreakdown":"DDC explanation","confidence":"95%","evidence":"B.S. 1000A:1961 & DDC 23"}

UDC quick reference:
0=Library/CS/Knowledge, 1=Philosophy/Psychology, 2=Religion, 3=Social Sciences (35=Public Admin, 36=Social Welfare, 37=Education), 5=Science (51=Math, 53=Physics, 54=Chem, 57=Biology), 6=Applied (61=Medicine, 62=Engineering, 63=Agriculture, 633.11=Wheat, 633.15=Maize, 631.55=Harvest, 64=Home, 65=Management, 66=Chem Eng), 7=Arts (78=Music, 75=Painting, 77=Photo, 796=Sports, 791.43=Cinema), 8=Language/Lit (821.111=English Lit, 891.43=Hindi Lit, 891.44=Bengali), 9=History/Geo/Bio (91=Geography, 929=Biography, 94=History).
UDC facets: :091 manuscripts, :027.7 universities, :631.55 harvesting, :36 social welfare, :004 data processing, (540) India, "19" 20th century.
UDC literature: language + form (-1 poetry, -2 drama, -31 novel, -32 short stories) + AuthorName + "Title".
Examples: 891.43-31Premchand"Karmabhumi", 891.43-1Bachchan"Madhushala", 025.85:091:027.7, 633.11+633.15:631.55, 016:36, 35(540), 929(540)"19"Gandhi.

DDC 23 quick reference: 004=CS, 020=Library, 025.84=Preservation, 150=Psychology, 200=Religion, 300=Social Sci, 330=Economics, 340=Law, 351=Public Admin, 370=Education, 500=Science, 510=Math, 530=Physics, 540=Chem, 570=Biology, 610=Medicine, 620=Engineering, 630=Agriculture, 633.1=Cereals, 633.11=Wheat, 633.15=Maize, 640=Home, 650=Management, 660=Chem Eng, 750=Painting, 770=Photo, 780=Music, 796=Sports, 800=Literature, 821=English Lit, 822.33=Shakespeare, 823=English Fiction, 891.43=Hindi Lit, 891.431=Hindi Poetry, 891.433=Hindi Fiction, 900=History, 910=Geo, 920=Biography, 954=India.

NOW classify the input. Return ONLY the JSON.`;

async function tryGemini(title) {
  if (!GEMINI_API_KEY) return null;
  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${AI_PROMPT}\n\nINPUT: "${title}"` }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.05 }
      })
    });
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (response.ok && text) {
      let raw = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
      if (a !== -1 && b !== -1) raw = raw.substring(a, b + 1);
      const parsed = JSON.parse(raw);
      if (parsed.fullNotation && parsed.ddc) return parsed;
    }
  } catch (err) { console.error('Gemini error:', err.message); }
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
          { role: 'system', content: AI_PROMPT },
          { role: 'user', content: `Classify: "${title}"` }
        ],
        temperature: 0.05,
        response_format: { type: 'json_object' }
      })
    });
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (response.ok && text) {
      let raw = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
      if (a !== -1 && b !== -1) raw = raw.substring(a, b + 1);
      const parsed = JSON.parse(raw);
      if (parsed.fullNotation && parsed.ddc) return parsed;
    }
  } catch (err) { console.error('Groq error:', err.message); }
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
    classNumber: u, class_number: u, classMark: u, class_mark:
