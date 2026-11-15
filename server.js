const http = process.getBuiltinModule('node:http');
const fs = process.getBuiltinModule('node:fs');
const zlib = process.getBuiltinModule('node:zlib');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CACHE_FILE = './ai-cache-v9.json';

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

// 3. Specific-First DDC 23rd Ed. & UDC Schedule
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

  // Transport Modes
  { keys: ['railway transport', 'railways', 'railroad', 'rail transport'], udc: '656.2', ddc: '385', ddcBase: '385', name: 'Railway Transport' },
  { keys: ['air transport', 'aviation', 'airlines'], udc: '656.7', ddc: '387.7', ddcBase: '3877', name: 'Air Transport' },
  { keys: ['maritime transport', 'shipping', 'water transport'], udc: '656.6', ddc: '387.5', ddcBase: '3875', name: 'Maritime Transport' },
  { keys: ['road transport', 'highways'], udc: '656.1', ddc: '388.1', ddcBase: '3881', name: 'Road Transport' },
  { keys: ['transport', 'transportation'], udc: '656', ddc: '388', ddcBase: '388', name: 'Transportation' },

  // Tourism, Economics, Commerce & Social Sciences
  { keys: ['ecotourism', 'eco-tourism', 'sustainable tourism'], udc: '338.48:502', ddc: '338.4791', ddcBase: '3384791', name: 'Ecotourism & Sustainable Tourism' },
  { keys: ['tourism', 'tourist', 'hospitality industry', 'travel industry'], udc: '338.48', ddc: '338.4791', ddcBase: '3384791', name: 'Tourism & Hospitality' },
  { keys: ['social media', 'social networking'], udc: '004.738.5:316.77', ddc: '302.231', ddcBase: '302231', name: 'Social Media' },
  { keys: ['artificial intelligence', 'machine learning'], udc: '004.8', ddc: '006.3', ddcBase: '0063', name: 'Artificial Intelligence' },
  { keys: ['data science', 'big data', 'database'], udc: '004.65', ddc: '005.7', ddcBase: '0057', name: 'Data Science & Databases' },
  { keys: ['cyber security', 'cybersecurity', 'information security'], udc: '004.056', ddc: '005.8', ddcBase: '0058', name: 'Cybersecurity' },
  { keys: ['computer science', 'computing', 'information technology', 'software'], udc: '004', ddc: '004', ddcBase: '004', name: 'Computer Science' },
  { keys: ['journalism', 'mass media', 'newspaper'], udc: '070', ddc: '070', ddcBase: '070', name: 'Journalism & Media' },
  { keys: ['mental health', 'psychiatry'], udc: '616.89', ddc: '362.2', ddcBase: '3622', name: 'Mental Health' },
  { keys: ['educational psychology'], udc: '37.015.3', ddc: '370.15', ddcBase: '37015', name: 'Educational Psychology' },
  { keys: ['psychology', 'human behavior'], udc: '159.9', ddc: '150', ddcBase: '15', name: 'Psychology' },
  { keys: ['philosophy', 'metaphysics'], udc: '1', ddc: '100', ddcBase: '10', name: 'Philosophy' },
  { keys: ['logic'], udc: '16', ddc: '160', ddcBase: '16', name: 'Logic' },
  { keys: ['ethics'], udc: '17', ddc: '170', ddcBase: '17', name: 'Ethics' },
  { keys: ['sikhism', 'sikh'], udc: '294.553', ddc: '294.6', ddcBase: '2946', name: 'Sikhism' },
  { keys: ['hinduism'], udc: '294.5', ddc: '294.5', ddcBase: '2945', name: 'Hinduism' },
  { keys: ['buddhism', 'buddhist'], udc: '294.3', ddc: '294.3', ddcBase: '2943', name: 'Buddhism' },
  { keys: ['islam'], udc: '297', ddc: '297', ddcBase: '297', name: 'Islam' },
  { keys: ['religion', 'theology'], udc: '2', ddc: '200', ddcBase: '20', name: 'Religion' },
  { keys: ['sociology', 'society', 'social change'], udc: '316', ddc: '301', ddcBase: '301', name: 'Sociology' },
  { keys: ['demography', 'population'], udc: '314', ddc: '304.6', ddcBase: '3046', name: 'Demography & Population' },
  { keys: ['statistics'], udc: '311', ddc: '310', ddcBase: '31', name: 'Statistics' },
  { keys: ['international relations', 'foreign policy', 'diplomacy'], udc: '327', ddc: '327', ddcBase: '327', name: 'International Relations' },
  { keys: ['political science', 'politics', 'democracy', 'elections'], udc: '32', ddc: '320', ddcBase: '32', name: 'Political Science' },
  { keys: ['banking', 'finance', 'monetary'], udc: '336.71', ddc: '332.1', ddcBase: '3321', name: 'Banking & Finance' },
  { keys: ['taxation', 'taxes', 'income tax'], udc: '336.22', ddc: '336.2', ddcBase: '3362', name: 'Taxation' },
  { keys: ['economics', 'economy', 'economic development'], udc: '33', ddc: '330', ddcBase: '33', name: 'Economics' },
  { keys: ['constitutional law', 'constitution'], udc: '342', ddc: '342', ddcBase: '342', name: 'Constitutional Law' },
  { keys: ['criminal law', 'criminology', 'crime'], udc: '343', ddc: '345', ddcBase: '345', name: 'Criminal Law' },
  { keys: ['human rights'], udc: '342.7', ddc: '323', ddcBase: '323', name: 'Human Rights' },
  { keys: ['law', 'jurisprudence', 'legal'], udc: '34', ddc: '340', ddcBase: '34', name: 'Law' },
  { keys: ['public administration', 'governance'], udc: '35', ddc: '350', ddcBase: '35', name: 'Public Administration' },
  { keys: ['social welfare', 'social work'], udc: '364', ddc: '361', ddcBase: '361', name: 'Social Work & Welfare' },
  { keys: ['insurance'], udc: '368', ddc: '368', ddcBase: '368', name: 'Insurance' },
  { keys: ['environmental science', 'ecology', 'environment', 'climate change'], udc: '502/504', ddc: '333.7', ddcBase: '3337', name: 'Environmental Science & Ecology' },
  { keys: ['higher education', 'universities'], udc: '378', ddc: '378', ddcBase: '378', name: 'Higher Education' },
  { keys: ['education', 'teaching', 'schools'], udc: '37', ddc: '370', ddcBase: '37', name: 'Education' },
  { keys: ['commerce', 'trade', 'export', 'import'], udc: '339', ddc: '380', ddcBase: '38', name: 'Commerce & Trade' },
  { keys: ['folklore', 'customs', 'festivals'], udc: '39', ddc: '390', ddcBase: '39', name: 'Customs & Folklore' },

  // Sciences, Medicine, Engineering, Agriculture & Fisheries
  { keys: ['mathematics'], udc: '51', ddc: '510', ddcBase: '51', name: 'Mathematics' },
  { keys: ['astronomy', 'astrophysics', 'space'], udc: '52', ddc: '520', ddcBase: '52', name: 'Astronomy' },
  { keys: ['quantum physics', 'quantum mechanics'], udc: '530.145', ddc: '530.12', ddcBase: '53012', name: 'Quantum Physics' },
  { keys: ['physics'], udc: '53', ddc: '530', ddcBase: '53', name: 'Physics' },
  { keys: ['organic chemistry'], udc: '547', ddc: '547', ddcBase: '547', name: 'Organic Chemistry' },
  { keys: ['chemistry'], udc: '54', ddc: '540', ddcBase: '54', name: 'Chemistry' },
  { keys: ['geology', 'earthquakes', 'earth science'], udc: '55', ddc: '551', ddcBase: '551', name: 'Geology' },
  { keys: ['genetics', 'biotechnology'], udc: '575', ddc: '576.5', ddcBase: '5765', name: 'Genetics & Biotechnology' },
  { keys: ['biology', 'microbiology'], udc: '57', ddc: '570', ddcBase: '57', name: 'Biology' },
  { keys: ['botany', 'plants', 'flora'], udc: '58', ddc: '580', ddcBase: '58', name: 'Botany' },
  { keys: ['zoology', 'animals', 'wildlife', 'fauna'], udc: '59', ddc: '590', ddcBase: '59', name: 'Zoology & Wildlife' },
  { keys: ['cardiology', 'heart'], udc: '616.12', ddc: '616.12', ddcBase: '61612', name: 'Cardiology' },
  { keys: ['pharmacology', 'pharmacy', 'drugs'], udc: '615', ddc: '615', ddcBase: '615', name: 'Pharmacology' },
  { keys: ['surgery'], udc: '617', ddc: '617', ddcBase: '617', name: 'Surgery' },
  { keys: ['anatomy'], udc: '611', ddc: '611', ddcBase: '611', name: 'Anatomy' },
  { keys: ['public health', 'epidemiology', 'nutrition'], udc: '614', ddc: '614', ddcBase: '614', name: 'Public Health' },
  { keys: ['medicine', 'medical', 'health', 'diseases'], udc: '61', ddc: '610', ddcBase: '61', name: 'Medicine & Health' },
  { keys: ['mining', 'minerals'], udc: '622', ddc: '622', ddcBase: '622', name: 'Mining Engineering' },
  { keys: ['civil engineering', 'bridges', 'roads'], udc: '624', ddc: '624', ddcBase: '624', name: 'Civil Engineering' },
  { keys: ['electrical engineering', 'electronics', 'energy', 'solar'], udc: '621.3', ddc: '621.3', ddcBase: '6213', name: 'Electrical & Energy Engineering' },
  { keys: ['mechanical engineering'], udc: '621', ddc: '621', ddcBase: '621', name: 'Mechanical Engineering' },
  { keys: ['automobiles', 'vehicles', 'motor cars'], udc: '629.33', ddc: '629.222', ddcBase: '629222', name: 'Automobiles' },
  { keys: ['engineering', 'technology'], udc: '62', ddc: '620', ddcBase: '62', name: 'Engineering & Technology' },
  { keys: ['forestry', 'forests', 'silviculture'], udc: '630', ddc: '634.9', ddcBase: '6349', name: 'Forestry' },
  { keys: ['horticulture', 'gardening'], udc: '635', ddc: '635', ddcBase: '635', name: 'Horticulture' },
  { keys: ['animal husbandry', 'livestock', 'dairy', 'veterinary'], udc: '636', ddc: '636', ddcBase: '636', name: 'Animal Husbandry' },
  { keys: ['fisheries', 'fishery', 'fishing', 'aquaculture'], udc: '639.2', ddc: '639.2', ddcBase: '6392', name: 'Fisheries & Aquaculture' },
  { keys: ['agriculture', 'farming', 'agronomy', 'crops'], udc: '63', ddc: '630', ddcBase: '63', name: 'Agriculture' },
  { keys: ['accounting', 'auditing'], udc: '657', ddc: '657', ddcBase: '657', name: 'Accounting' },
  { keys: ['marketing', 'advertising'], udc: '658.8', ddc: '658.8', ddcBase: '6588', name: 'Marketing' },
  { keys: ['business management', 'management', 'business'], udc: '65', ddc: '658', ddcBase: '658', name: 'Business Management' },
  { keys: ['textiles', 'textile industry'], udc: '677', ddc: '677', ddcBase: '677', name: 'Textiles' },

  // Arts, Literature & History
  { keys: ['architecture'], udc: '72', ddc: '720', ddcBase: '72', name: 'Architecture' },
  { keys: ['painting', 'fine arts'], udc: '75', ddc: '750', ddcBase: '75', name: 'Painting & Fine Arts' },
  { keys: ['photography'], udc: '77', ddc: '770', ddcBase: '77', name: 'Photography' },
  { keys: ['music'], udc: '78', ddc: '780', ddcBase: '78', name: 'Music' },
  { keys: ['cinema', 'films', 'theatre'], udc: '791', ddc: '791.43', ddcBase: '79143', name: 'Cinema & Performing Arts' },
  { keys: ['sports', 'athletics', 'cricket', 'football'], udc: '796', ddc: '796', ddcBase: '796', name: 'Sports' },
  { keys: ['linguistics', 'language'], udc: '81', ddc: '410', ddcBase: '41', name: 'Linguistics' },
  { keys: ['punjabi literature'], udc: '821.214.2', ddc: '891.42', ddcBase: '89142', name: 'Punjabi Literature' },
  { keys: ['hindi literature'], udc: '821.214.21', ddc: '891.43', ddcBase: '89143', name: 'Hindi Literature' },
  { keys: ['english literature'], udc: '821.111', ddc: '820', ddcBase: '82', name: 'English Literature' },
  { keys: ['literature', 'poetry', 'fiction', 'drama'], udc: '82', ddc: '800', ddcBase: '80', name: 'Literature' },
  { keys: ['geography', 'travel'], udc: '91', ddc: '910', ddcBase: '91', name: 'Geography' },
  { keys: ['archaeology'], udc: '902', ddc: '930.1', ddcBase: '9301', name: 'Archaeology' },
  { keys: ['history', 'civilization'], udc: '93/94', ddc: '900', ddcBase: '90', name: 'History' }
];

// 4. All UDC Common Auxiliary Signs Ordered by Official UDC Citation Order
const FACET_RULES = [
  // Point of View / Properties (.00...)
  { order: 1, pattern: /\b(theory of|philosophy of|principles of)\b/i, udcAdd: '.001', ddcSub: '01', label: 'Point of View (.001) / DDC -01' },
  { order: 1, pattern: /\b(research|methodology)\b/i, udcAdd: '.001.5', ddcSub: '072', label: 'Point of View (.001.5) / DDC -072' },

  // Persons & Ethnic Signs (-05... / (=...))
  { order: 2, pattern: /\b(teenagers?|youth|adolescents?)\b/i, udcAdd: '-053.6', ddcSub: '0835', label: 'Persons (-053.6 Youth) / DDC -0835' },
  { order: 2, pattern: /\b(children|child)\b/i, udcAdd: '-053.2', ddcSub: '083', label: 'Persons (-053.2 Children) / DDC -083' },
  { order: 2, pattern: /\b(women|females?)\b/i, udcAdd: '-055.2', ddcSub: '082', label: 'Persons (-055.2 Women) / DDC -082' },
  { order: 2, pattern: /\b(sikhs)\b/i, udcAdd: '(=214.2:294.553)', ddcSub: '0882946', label: 'Ethnic/Group (=...) / DDC -088' },

  // Place Auxiliaries (...)
  { order: 3, pattern: /\b(rural|villages?)\b/i, udcAdd: '(-22)', ddcSub: '091734', label: 'Place (-22) Rural / DDC -091734' },
  { order: 3, pattern: /\b(urban|cities)\b/i, udcAdd: '(-21)', ddcSub: '091732', label: 'Place (-21) Urban / DDC -091732' },
  { order: 3, pattern: /\b(punjab)\b/i, udcAdd: '(545.2)', ddcSub: '09545', histDdc: '954.5', label: 'Place (545.2) Punjab / DDC -09545' },
  { order: 3, pattern: /\b(india|indian)\b/i, udcAdd: '(540)', ddcSub: '0954', histDdc: '954', label: 'Place (540) India / DDC -0954' },
  { order: 3, pattern: /\b(nepal|nepalese)\b/i, udcAdd: '(541.35)', ddcSub: '095496', histDdc: '954.96', label: 'Place (541.35) Nepal / DDC -095496' },
  { order: 3, pattern: /\b(pakistan)\b/i, udcAdd: '(549.1)', ddcSub: '095491', histDdc: '954.91', label: 'Place (549.1) Pakistan / DDC -095491' },
  { order: 3, pattern: /\b(bangladesh)\b/i, udcAdd: '(549.3)', ddcSub: '095492', histDdc: '954.92', label: 'Place (549.3) Bangladesh / DDC -095492' },
  { order: 3, pattern: /\b(sri lanka)\b/i, udcAdd: '(548.7)', ddcSub: '095493', histDdc: '954.93', label: 'Place (548.7) Sri Lanka / DDC -095493' },
  { order: 3, pattern: /\b(bhutan)\b/i, udcAdd: '(541.31)', ddcSub: '095498', histDdc: '954.98', label: 'Place (541.31) Bhutan / DDC -095498' },
  { order: 3, pattern: /\b(china|chinese)\b/i, udcAdd: '(510)', ddcSub: '0951', histDdc: '951', label: 'Place (510) China / DDC -0951' },
  { order: 3, pattern: /\b(japan|japanese)\b/i, udcAdd: '(520)', ddcSub: '0952', histDdc: '952', label: 'Place (520) Japan / DDC -0952' },
  { order: 3, pattern: /\b(canada|canadian)\b/i, udcAdd: '(71)', ddcSub: '0971', histDdc: '971', label: 'Place (71) Canada / DDC -0971' },
  { order: 3, pattern: /\b(usa|united states|america|american)\b/i, udcAdd: '(73)', ddcSub: '0973', histDdc: '973', label: 'Place (73) USA / DDC -0973' },
  { order: 3, pattern: /\b(uk|united kingdom|britain|england|british)\b/i, udcAdd: '(410)', ddcSub: '0941', histDdc: '941', label: 'Place (410) UK / DDC -0941' },
  { order: 3, pattern: /\b(australia|australian)\b/i, udcAdd: '(94)', ddcSub: '0994', histDdc: '994', label: 'Place (94) Australia / DDC -0994' },
  { order: 3, pattern: /\b(germany|german)\b/i, udcAdd: '(430)', ddcSub: '0943', histDdc: '943', label: 'Place (430) Germany / DDC -0943' },
  { order: 3, pattern: /\b(france|french)\b/i, udcAdd: '(44)', ddcSub: '0944', histDdc: '944', label: 'Place (44) France / DDC -0944' },
  { order: 3, pattern: /\b(norway|norwegian)\b/i, udcAdd: '(481)', ddcSub: '09481', histDdc: '948.1', label: 'Place (481) Norway / DDC -09481' },
  { order: 3, pattern: /\b(sweden|swedish)\b/i, udcAdd: '(485)', ddcSub: '09485', histDdc: '948.5', label: 'Place (485) Sweden / DDC -09485' },
  { order: 3, pattern: /\b(denmark|danish)\b/i, udcAdd: '(489)', ddcSub: '09489', histDdc: '948.9', label: 'Place (489) Denmark / DDC -09489' },
  { order: 3, pattern: /\b(italy|italian)\b/i, udcAdd: '(450)', ddcSub: '0945', histDdc: '945', label: 'Place (450) Italy / DDC -0945' },
  { order: 3, pattern: /\b(spain|spanish)\b/i, udcAdd: '(460)', ddcSub: '0946', histDdc: '946', label: 'Place (460) Spain / DDC -0946' },
  { order: 3, pattern: /\b(russia|russian)\b/i, udcAdd: '(470)', ddcSub: '0947', histDdc: '947', label: 'Place (470) Russia / DDC -0947' },
  { order: 3, pattern: /\b(brazil|brazilian)\b/i, udcAdd: '(81)', ddcSub: '0981', histDdc: '981', label: 'Place (81) Brazil / DDC -0981' },
  { order: 3, pattern: /\b(south africa)\b/i, udcAdd: '(680)', ddcSub: '0968', histDdc: '968', label: 'Place (680) South Africa / DDC -0968' },
  { order: 3, pattern: /\b(africa|african)\b/i, udcAdd: '(6)', ddcSub: '096', histDdc: '960', label: 'Place (6) Africa / DDC -096' },
  { order: 3, pattern: /\b(europe|european)\b/i, udcAdd: '(4)', ddcSub: '094', histDdc: '940', label: 'Place (4) Europe / DDC -094' },
  { order: 3, pattern: /\b(asia|asian)\b/i, udcAdd: '(5)', ddcSub: '095', histDdc: '950', label: 'Place (5) Asia / DDC -095' },

  // Form Auxiliaries (0...)
  { order: 5, pattern: /\b(statistical tables?|statistical data)\b/i, udcAdd: '(083.4)', ddcSub: '021', label: 'Form (083.4) Tables / DDC -021' },
  { order: 5, pattern: /\b(dictionar(y|ies)|glossary)\b/i, udcAdd: '(038)', ddcSub: '03', label: 'Form (038) Dictionary / DDC -03' },
  { order: 5, pattern: /\b(encyclopedias?|encyclopaedias?)\b/i, udcAdd: '(031)', ddcSub: '03', label: 'Form (031) Encyclopedia / DDC -03' },
  { order: 5, pattern: /\b(bibliograph(y|ies))\b/i, udcAdd: '(01)', ddcSub: '016', label: 'Form (01) Bibliography / DDC 016' },
  { order: 5, pattern: /\b(periodicals?|journals?)\b/i, udcAdd: '(05)', ddcSub: '05', label: 'Form (05) Serials / DDC -05' },
  { order: 5, pattern: /\b(handbooks?|manuals?|guides?|guide to)\b/i, udcAdd: '(035)', ddcSub: '0202', label: 'Form (035) Guide / DDC -0202' },

  // Language Auxiliaries (=...)
  { order: 6, pattern: /\b(in english|english language)\b/i, udcAdd: '=111', ddcSub: '', label: 'Language (=111 English)' },
  { order: 6, pattern: /\b(in punjabi|punjabi language)\b/i, udcAdd: '=214.2', ddcSub: '', label: 'Language (=214.2 Punjabi)' },
  { order: 6, pattern: /\b(in hindi|hindi language)\b/i, udcAdd: '=214.21', ddcSub: '', label: 'Language (=214.21 Hindi)' },
  { order: 6, pattern: /\b(in french|french language)\b/i, udcAdd: '=133.1', ddcSub: '', label: 'Language (=133.1 French)' }
];

// 5. Complete Century Parser (1st to 21st Century)
function parseCenturyFacet(query) {
  const match = query.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+century\b/i);
  if (!match) return null;
  const c = parseInt(match[1], 10);
  if (c < 1 || c > 21) return null;

  const udcDigits = String(c - 1).padStart(2, '0');
  const udcSign = `"${udcDigits}"`;

  let ddcPeriodSub = '0904';
  if (c <= 5) ddcPeriodSub = '0901';
  else if (c <= 15) ddcPeriodSub = '0902';
  else if (c <= 18) ddcPeriodSub = '0903';
  else if (c === 19) ddcPeriodSub = '09034';
  else if (c === 20) ddcPeriodSub = '0904';
  else if (c === 21) ddcPeriodSub = '0905';

  return {
    order: 4,
    udcAdd: udcSign,
    ddcSub: ddcPeriodSub,
    label: `Time ${udcSign} (${c}th Century) / DDC -${ddcPeriodSub}`
  };
}

// 6. Special UDC Signs: Asterisk (*) for ISO/Standards
function parseSpecialNotations(query) {
  const extras = [];
  const isoMatch = query.match(/\b(iso|ansi|bs|is)\s*[-:]?\s*(\d{3,6})\b/i);
  if (isoMatch) {
    const code = `${isoMatch[1].toUpperCase()}${isoMatch[2]}`;
    extras.push({ order: 7, udcAdd: `*${code}`, ddcSub: '', label: `Asterisk (*${code}) Non-UDC Standard` });
  }
  return extras;
}

function formatDdcNumber(ddcBase, sub, isHistory, histDdc) {
  if (!sub) return ddcBase;
  if (isHistory && histDdc) return histDdc;
  if (sub === '016') return `016.${ddcBase.replace(/^0+/, '')}`;
  const cleanBase = ddcBase.replace('.', '');
  let effectiveSub = sub;
  if (cleanBase.endsWith('0') && sub.startsWith('0') && !sub.startsWith('09')) {
    effectiveSub = sub.slice(1);
  }
  const raw = `${cleanBase}${effectiveSub}`;
  return raw.length > 3 ? `${raw.slice(0, 3)}.${raw.slice(3)}` : raw;
}

function synthesizeLocalSchedule(query) {
  const q = query.toLowerCase().trim();

  const udcJson = flatUdc.get(q);
  const ddcJson = flatDdc.get(q);
  if (udcJson && ddcJson) {
    return {
      udc: udcJson,
      ddc: ddcJson,
      explanation: `Exact class number matched from reference schedule for "${query}".`,
      source: '⚡ Reference Index (Instant)'
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

  const centuryFacet = parseCenturyFacet(q);
  if (centuryFacet) appliedFacets.push(centuryFacet);

  const specialNotations = parseSpecialNotations(query);
  appliedFacets.push(...specialNotations);

  appliedFacets.sort((a, b) => a.order - b.order);

  if (matchedDisciplines.length > 0) {
    const primary = matchedDisciplines[0];
    const secondary = matchedDisciplines[1] || null;
    const isHistory = primary.name === 'History';

    let udcBuilt = primary.udc;
    let ddcBuilt = primary.ddc;
    const steps = [`Base: ${primary.name} (${primary.udc} / ${primary.ddc})`];

    if (secondary) {
      const isDoubleColon = /\b(role of|application of|impact of|use of|in)\b/i.test(q) && !/\b(and|&)\b/i.test(q);
      const isPlus = /\b(and|&)\b/i.test(q);
      const connector = isPlus ? '+' : (isDoubleColon ? '::' : ':');
      udcBuilt = `${primary.udc}${connector}${secondary.udc}`;

      if (appliedFacets.length > 0) {
        udcBuilt = `[${udcBuilt}]`;
      }
      steps.push(`Sign (${connector}): ${secondary.name} (${secondary.udc})`);
    }

    for (const f of appliedFacets) {
      udcBuilt += f.udcAdd;
      ddcBuilt = formatDdcNumber(ddcBuilt, f.ddcSub, isHistory && !!f.histDdc, f.histDdc);
      steps.push(f.label);
    }

    return {
      udc: udcBuilt,
      ddc: ddcBuilt,
      explanation: steps.length > 1 ? `Synthesized Class Number -> ${steps.join(' + ')}.` : `Standard Class Number for ${primary.name}.`,
      source: '⚡ UDC/DDC Rule Engine (Instant)'
    };
  }

  return null;
}

// 7. Fast Parallel Network Fetch (Gemini AI Mode + Open Library Race)
async function fetchGeminiSingle(model, prompt) {
  if (!GEMINI_API_KEY) throw new Error('No key');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.1 }
      })
    });
    clearTimeout(timer);
    const data = await apiRes.json();
    if (data.error || !data.candidates?.[0]?.content?.parts) throw new Error('API error');
    const rawText = data.candidates[0].content.parts.map(p => p.text || '').join('');
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Parse error');
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.udc || !parsed.ddc) throw new Error('Incomplete');
    return {
      udc: parsed.udc,
      ddc: parsed.ddc,
      explanation: parsed.explanation || 'Verified via Google AI Mode.',
      source: '✨ Google AI Mode (Live Search Grounded)'
    };
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

async function fetchOpenLibraryFast(query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=4&fields=title,ddc`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const data = await res.json();
    if (data.docs) {
      for (const doc of data.docs) {
        if (doc.ddc && doc.ddc.length > 0) {
          const rawDdc = doc.ddc[0].replace(/[^0-9.]/g, '');
          if (rawDdc) {
            // Clean DDC geographic subdivision (-09...) before converting to UDC base
            let udcClean = rawDdc.replace(/0?9\d+$/, '');
            if (udcClean.startsWith('301')) udcClean = udcClean.replace(/^301/, '316');
            else if (udcClean.startsWith('020')) udcClean = udcClean.replace(/^020/, '02');
            else if (udcClean.startsWith('634.9')) udcClean = udcClean.replace(/^634\.9/, '630');

            return {
              udc: udcClean,
              ddc: rawDdc,
              explanation: `Matched from World Library Catalog for "${doc.title || query}".`,
              source: '📚 Library Catalog Grounded'
            };
          }
        }
      }
    }
    throw new Error('No DDC match');
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

async function resolveOnlineParallel(query) {
  const prompt = `You are a senior library cataloger expert in UDC (Universal Decimal Classification) and DDC 23rd Edition.
Build the EXACT synthesized class number for: "${query}".
Follow official UDC signs and citation order:
- Connecting signs: + (addition), / (stroke extension), : (relation), :: (double colon order fixing), [...] (subgrouping), * (non-UDC code), A/Z (alphabetical).
- Common auxiliaries order: .00/-0 (viewpoint/persons) -> (...) (place) -> "..." (time: 18th="17", 19th="18", 20th="19", 21st="20") -> (0...) (form) -> =... (language).
Use exact DDC 23rd Edition schedules and Tables 1-6.
Return ONLY valid JSON: {"udc": "...", "ddc": "...", "explanation": "step-by-step breakdown"}`;

  try {
    return await Promise.any([
      fetchGeminiSingle('gemini-2.5-flash', prompt),
      fetchGeminiSingle('gemini-3.8-flash', prompt),
      fetchOpenLibraryFast(query)
    ]);
  } catch (e) {
    return null;
  }
}

// 8. GZIP Response Helper
function sendCompressed(req, res, statusCode, contentType, payload) {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const buf = Buffer.from(payload, 'utf8');
  if (acceptEncoding.includes('gzip')) {
    zlib.gzip(buf, (err, compressed) => {
      if (!err) {
        res.writeHead(statusCode, { 'Content-Type': contentType, 'Content-Encoding': 'gzip', 'Cache-Control': 'public, max-age=3600' });
        return res.end(compressed);
      }
      res.writeHead(statusCode, { 'Content-Type': contentType });
      res.end(buf);
    });
  } else {
    res.writeHead(statusCode, { 'Content-Type': contentType });
    res.end(buf);
  }
}

// 9. Professional Library Cataloger UI
const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>UDC & DDC Classifier • Google AI Mode</title>
  <style>
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { background: linear-gradient(135deg, #f0f4f9 0%, #e8eef5 100%); margin: 0; padding: 24px 14px; min-height: 100vh; display: flex; justify-content: center; align-items: flex-start; }
    .container { width: 100%; max-width: 740px; background: #ffffff; border-radius: 24px; padding: 28px 24px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); border: 1px solid rgba(255,255,255,0.8); }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-icon { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #1a73e8, #4285f4); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; }
    .brand-title { font-size: 18px; font-weight: 700; color: #1e293b; margin: 0; }
    .brand-sub { font-size: 12px; color: #64748b; margin: 2px 0 0 0; }
    .tabs { display: flex; gap: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px; overflow-x: auto; }
    .tab { background: none; border: none; font-size: 14px; font-weight: 600; color: #64748b; cursor: pointer; padding: 6px 2px; position: relative; white-space: nowrap; transition: color 0.2s; }
    .tab:hover { color: #1a73e8; }
    .tab.active { color: #1a73e8; }
    .tab.active::after { content: ""; position: absolute; bottom: -11px; left: 0; width: 100%; height: 3px; background: #1a73e8; border-radius: 3px 3px 0 0; }
    .search-box { display: flex; align-items: center; border: 1.5px solid #cbd5e1; border-radius: 30px; padding: 6px 8px 6px 18px; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04); background: #fff; transition: border-color 0.2s, box-shadow 0.2s; }
    .search-box:focus-within { border-color: #1a73e8; box-shadow: 0 4px 14px rgba(26, 115, 232, 0.14); }
    .search-box input { flex: 1; border: none; outline: none; font-size: 15px; color: #0f172a; padding: 10px 4px; background: transparent; }
    .search-box button { background: linear-gradient(135deg, #1a73e8, #1557b0); color: #fff; border: none; border-radius: 24px; padding: 11px 22px; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
    .search-box button:hover { opacity: 0.92; }
    .search-box button:disabled { background: #94a3b8; cursor: not-allowed; }
    .signs-bar { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
    .sign-pill { font-size: 11px; color: #475569; background: #f1f5f9; padding: 3px 8px; border-radius: 6px; font-family: monospace; }
    .result-card { margin-top: 24px; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; background: #fafbfc; display: none; }
    .badge { display: inline-block; font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 20px; background: #e8f0fe; color: #1a73e8; margin-bottom: 16px; }
    .code-row { display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 14px 16px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 10px; }
    .code-label { font-weight: 600; color: #334155; font-size: 14px; }
    .code-actions { display: flex; align-items: center; gap: 8px; }
    .code-val { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 16px; font-weight: 700; color: #0f5132; background: #d1e7dd; padding: 5px 12px; border-radius: 8px; word-break: break-all; }
    .copy-btn { background: #f1f5f9; border: 1px solid #cbd5e1; color: #334155; border-radius: 8px; padding: 5px 9px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .copy-btn:hover { background: #e2e8f0; }
    .explanation { margin-top: 12px; font-size: 13.5px; color: #334155; line-height: 1.6; background: #fff; padding: 14px 16px; border-radius: 12px; border-left: 4px solid #1a73e8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">
        <div class="brand-icon">LC</div>
        <div>
          <h1 class="brand-title">UDC & DDC Precision Classifier</h1>
          <p class="brand-sub">DDC 23rd Edition • Complete UDC Signs & Auxiliary Synthesis</p>
        </div>
      </div>
    </div>

    <div class="tabs">
      <button class="tab active" data-mode="ai">✨ AI Mode</button>
      <button class="tab" data-mode="both">All (UDC + DDC)</button>
      <button class="tab" data-mode="udc">UDC Only</button>
      <button class="tab" data-mode="ddc">DDC Only</button>
    </div>

    <div class="search-box">
      <input type="text" id="subjectInput" placeholder="Enter title (e.g., Fisheries in Norway, History of India in 20th century)..." />
      <button id="classifyBtn">Search</button>
    </div>

    <div class="signs-bar">
      <span class="sign-pill">+ Addition</span>
      <span class="sign-pill">/ Stroke</span>
      <span class="sign-pill">: Colon</span>
      <span class="sign-pill">:: Double Colon</span>
      <span class="sign-pill">[ ] Subgroup</span>
      <span class="sign-pill">* Code</span>
      <span class="sign-pill">= Language</span>
      <span class="sign-pill">(0...) Form</span>
      <span class="sign-pill">(...) Place</span>
      <span class="sign-pill">(=...) Ethnic</span>
      <span class="sign-pill">"..." Time</span>
      <span class="sign-pill">-05 Persons</span>
      <span class="sign-pill">.00 Viewpoint</span>
    </div>

    <div class="result-card" id="resultCard">
      <span class="badge" id="sourceBadge">✨ Google AI Mode</span>
      <div class="code-row" id="udcRow">
        <span class="code-label">UDC Notation</span>
        <div class="code-actions">
          <span class="code-val" id="udcValue">-</span>
          <button class="copy-btn" onclick="copyText('udcValue', this)">Copy</button>
        </div>
      </div>
      <div class="code-row" id="ddcRow">
        <span class="code-label">DDC 23 Notation</span>
        <div class="code-actions">
          <span class="code-val" id="ddcValue">-</span>
          <button class="copy-btn" onclick="copyText('ddcValue', this)">Copy</button>
        </div>
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
    function copyText(id, btn) {
      const val = document.getElementById(id).textContent;
      navigator.clipboard.writeText(val);
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 1400);
    }
    function showResult(data) {
      document.getElementById('resultCard').style.display = 'block';
      document.getElementById('sourceBadge').textContent = data.source || '✨ Google AI Mode';
      document.getElementById('udcValue').textContent = data.udc || 'Not found';
      document.getElementById('ddcValue').textContent = data.ddc || 'Not found';
      document.getElementById('explanationText').textContent = data.explanation || '';
      updateRowVisibility();
    }
    async function classifySubject() {
      const query = document.getElementById('subjectInput').value.trim();
      if (!query) return;

      const localKey = 'udc_v9_' + query.toLowerCase();
      const saved = localStorage.getItem(localKey);
      if (saved) {
        showResult(JSON.parse(saved));
        return;
      }

      const btn = document.getElementById('classifyBtn');
      btn.textContent = 'Searching...';
      btn.disabled = true;

      const controller = new AbortController();
      const uiTimeout = setTimeout(() => controller.abort(), 12000);

      try {
        const res = await fetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ query })
        });
        clearTimeout(uiTimeout);
        const data = await res.json();
        if (data.udc && data.udc !== '001') {
          localStorage.setItem(localKey, JSON.stringify(data));
        }
        showResult(data);
      } catch (err) {
        clearTimeout(uiTimeout);
        alert('Connection slow. Tap Search once more.');
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
    return sendCompressed(req, res, 200, 'text/html; charset=utf-8', HTML_PAGE);
  }

  if (req.method === 'POST' && req.url === '/api/classify') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { query } = JSON.parse(body || '{}');
        if (!query) {
          return sendCompressed(req, res, 400, 'application/json', JSON.stringify({ error: 'Query is required' }));
        }

        const qKey = query.toLowerCase().trim();

        if (diskCache[qKey]) {
          return sendCompressed(req, res, 200, 'application/json', JSON.stringify(diskCache[qKey]));
        }

        const localSynthesized = synthesizeLocalSchedule(qKey);
        if (localSynthesized) {
          saveCache(qKey, localSynthesized);
          return sendCompressed(req, res, 200, 'application/json', JSON.stringify(localSynthesized));
        }

        const onlineResult = await resolveOnlineParallel(query);
        if (onlineResult) {
          saveCache(qKey, onlineResult);
          return sendCompressed(req, res, 200, 'application/json', JSON.stringify(onlineResult));
        }

        return sendCompressed(req, res, 200, 'application/json', JSON.stringify({
          udc: '001',
          ddc: '001',
          explanation: `General Knowledge & Interdisciplinary Subject ("${query}").`,
          source: '🛡️ General Classification'
        }));
      } catch (err) {
        return sendCompressed(req, res, 200, 'application/json', JSON.stringify({
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

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
