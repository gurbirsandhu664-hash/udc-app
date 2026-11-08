import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const WORLDSHARE_WSKEY = process.env.WORLDCAT_API_KEY || process.env.WORLDSHARE_WSKEY || '';
const ANNIF_API_URL = process.env.ANNIF_API_URL || '';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isValidNotation(val) {
  if (!val || typeof val !== 'string') return false;
  const s = val.trim();
  return /^[0-9]+[0-9/:\(\)\.\+=\-A-Z\'\s]*$/.test(s) && /\d/.test(s);
}

// ============================================================================
// COMPREHENSIVE CLASSIFIER MATRIX (UDC & DDC-23)
// ============================================================================
function masterClassify(title) {
  const t = norm(title);

  // 1. EXACT PROTECTED TITLES
  const EXACT = {
    'encyclopedia of science': { udc: '5(031)', ddc: '503', breakdown: '5 = Pure Sciences; (031) = Encyclopedias.', desc: 'General Science Encyclopedia.' },
    'dictionary of science': { udc: '5(038)', ddc: '503', breakdown: '5 = Pure Sciences; (038) = Dictionaries.', desc: 'Science Dictionary.' },
    'harvesting of wheat and maize': { udc: '633.11+633.15:631.55', ddc: '633.1', breakdown: '633.11 = wheat; 633.15 = maize; 631.55 = harvesting.', desc: 'Harvesting of wheat & maize.' },
    'harvesting of cereals': { udc: '633.1:631.55', ddc: '633.1', breakdown: '633.1 = cereals; 631.55 = harvesting.', desc: 'Cereal crops harvesting.' },
    'flood damage to wheat': { udc: '633.11:632.166', ddc: '633.11917', breakdown: '633.11 = wheat; 632.166 = flood damage.', desc: 'Flood damage to wheat.' },
    'fishing the whale fishes': { udc: '639.28', ddc: '639.28', breakdown: '639.28 = Whaling / whale fishing.', desc: 'Commercial whaling.' },
    'hindu chronological calendar': { udc: '529.324.5', ddc: '529.3245', breakdown: '529.324.5 = Hindu calendar.', desc: 'Hindu calendar chronology.' },
    'sobha singh': { udc: '75(084.1)SOB', ddc: '759.954', breakdown: '75 = Painting; (084.1) = pictorial; SOB = Sobha Singh.', desc: 'Sobha Singh reproductions.' },
    'bible': { udc: '27-23', ddc: '220', breakdown: '27-23 = The Bible; 220 = Bible.', desc: 'Christian Bible scriptures.' },
    'colon classification': { udc: '025.4', ddc: '025.4', breakdown: '025.4 = Library classification (Ranganathan Colon Classification).', desc: 'Colon Classification.' },
    'five laws of library science': { udc: '02', ddc: '020', breakdown: '02 = Librarianship (Ranganathan Five Laws).', desc: 'Foundations of Library Science.' }
  };
  if (EXACT[t]) return { ...EXACT[t], source: 'Verified Schedule Record' };

  // 2. LINGUISTICS & LANGUAGES (Handles Pronunciation, Grammar, etc.)
  const LANG_MAP = [
    { regex: /\b(french)\b/i, name: 'French', udcLang: '811.133.1', ddcBase: '44', ddcStandard: '440', udcLit: '821.133.1', ddcLit: '840' },
    { regex: /\b(english)\b/i, name: 'English', udcLang: '811.111', ddcBase: '42', ddcStandard: '420', udcLit: '821.111', ddcLit: '820' },
    { regex: /\b(german)\b/i, name: 'German', udcLang: '811.112.2', ddcBase: '43', ddcStandard: '430', udcLit: '821.112.2', ddcLit: '830' },
    { regex: /\b(spanish)\b/i, name: 'Spanish', udcLang: '811.134.2', ddcBase: '46', ddcStandard: '460', udcLit: '821.134.2', ddcLit: '860' },
    { regex: /\b(italian)\b/i, name: 'Italian', udcLang: '811.131.1', ddcBase: '45', ddcStandard: '450', udcLit: '821.131.1', ddcLit: '850' },
    { regex: /\b(punjabi|panjabi)\b/i, name: 'Punjabi', udcLang: '811.214.27', ddcBase: '491.42', ddcStandard: '491.42', udcLit: '821.214.27', ddcLit: '891.42' },
    { regex: /\b(hindi)\b/i, name: 'Hindi', udcLang: '811.214.21', ddcBase: '491.43', ddcStandard: '491.43', udcLit: '821.214.21', ddcLit: '891.43' },
    { regex: /\b(urdu)\b/i, name: 'Urdu', udcLang: '811.214.22', ddcBase: '491.439', ddcStandard: '491.439', udcLit: '821.214.22', ddcLit: '891.439' },
    { regex: /\b(sanskrit)\b/i, name: 'Sanskrit', udcLang: '811.211', ddcBase: '491.2', ddcStandard: '491.2', udcLit: '821.211', ddcLit: '891.2' },
    { regex: /\b(arabic)\b/i, name: 'Arabic', udcLang: '811.411.21', ddcBase: '492.7', ddcStandard: '492.7', udcLit: '821.411.21', ddcLit: '892.7' },
    { regex: /\b(russian)\b/i, name: 'Russian', udcLang: '811.161.1', ddcBase: '491.7', ddcStandard: '491.7', udcLit: '821.161.1', ddcLit: '891.7' },
    { regex: /\b(chinese)\b/i, name: 'Chinese', udcLang: '811.581', ddcBase: '495.1', ddcStandard: '495.1', udcLit: '821.581', ddcLit: '895.1' },
    { regex: /\b(japanese)\b/i, name: 'Japanese', udcLang: '811.521', ddcBase: '495.6', ddcStandard: '495.6', udcLit: '821.521', ddcLit: '895.6' }
  ];

  for (const lang of LANG_MAP) {
    if (lang.regex.test(t)) {
      // 1. Pronunciation / Phonetics / Phonology (e.g. "French Pronunciation")
      if (/\b(pronunciation|phonetics|phonology|accent|speech sounds)\b/i.test(t)) {
        const ddcNum = lang.ddcBase.length === 2 ? `${lang.ddcBase}1.52` : `${lang.ddcBase}152`;
        return {
          udc: `${lang.udcLang}'344`,
          ddc: ddcNum,
          breakdown: `${lang.udcLang} = ${lang.name} language; '344 = Pronunciation & Phonetics. DDC ${ddcNum} = ${lang.name} phonology.`,
          explanation: `Linguistics: ${lang.name} pronunciation and phonetics.`,
          source: 'Linguistics Schedule (UDC & DDC Table 4)'
        };
      }
      // 2. Grammar / Syntax
      if (/\b(grammar|syntax|morphology|parts of speech)\b/i.test(t)) {
        const ddcNum = `${lang.ddcBase}5`;
        return {
          udc: `${lang.udcLang}'36`,
          ddc: ddcNum,
          breakdown: `${lang.udcLang} = ${lang.name} language; '36 = Grammar. DDC ${ddcNum} = ${lang.name} grammar.`,
          explanation: `Linguistics: ${lang.name} grammar.`,
          source: 'Linguistics Schedule'
        };
      }
      // 3. Language Dictionary
      if (/\b(dictionary|shabdakosh|glossary|vocabulary)\b/i.test(t) && !/\b(literature|poetry)\b/i.test(t)) {
        const ddcNum = `${lang.ddcBase}3`;
        return {
          udc: `${lang.udcLang}(038)`,
          ddc: ddcNum,
          breakdown: `${lang.udcLang} = ${lang.name} language; (038) = Dictionary. DDC ${ddcNum} = ${lang.name} dictionary.`,
          explanation: `Linguistics: ${lang.name} dictionary.`,
          source: 'Linguistics Schedule'
        };
      }
      // 4. Literature Genres
      if (/\b(poetry|poem|poems|kavita)\b/i.test(t)) {
        return {
          udc: `${lang.udcLit}-1`,
          ddc: `${lang.ddcLit}1`,
          breakdown: `${lang.udcLit} = ${lang.name} literature; -1 = Poetry. DDC ${lang.ddcLit}1 = ${lang.name} poetry.`,
          explanation: `Literature: ${lang.name} poetry.`,
          source: 'Literature Schedule'
        };
      }
      if (/\b(drama|play|plays|natak)\b/i.test(t)) {
        return {
          udc: `${lang.udcLit}-2`,
          ddc: `${lang.ddcLit}2`,
          breakdown: `${lang.udcLit} = ${lang.name} literature; -2 = Drama. DDC ${lang.ddcLit}2 = ${lang.name} drama.`,
          explanation: `Literature: ${lang.name} drama.`,
          source: 'Literature Schedule'
        };
      }
      if (/\b(novel|novels|fiction|prose)\b/i.test(t)) {
        return {
          udc: `${lang.udcLit}-3`,
          ddc: `${lang.ddcLit}3`,
          breakdown: `${lang.udcLit} = ${lang.name} literature; -3 = Fiction / Prose narrative.`,
          explanation: `Literature: ${lang.name} fiction.`,
          source: 'Literature Schedule'
        };
      }
      if (/\b(literature|sahitya)\b/i.test(t)) {
        return {
          udc: lang.udcLit,
          ddc: lang.ddcLit,
          breakdown: `${lang.udcLit} = ${lang.name} literature; DDC ${lang.ddcLit}.`,
          explanation: `Literature: ${lang.name} literature.`,
          source: 'Literature Schedule'
        };
      }
      if (/\b(language|bhasha|boli)\b/i.test(t) || t === norm(lang.name)) {
        return {
          udc: lang.udcLang,
          ddc: lang.ddcStandard,
          breakdown: `${lang.udcLang} = ${lang.name} language; DDC ${lang.ddcStandard}.`,
          explanation: `Linguistics: ${lang.name} language.`,
          source: 'Linguistics Schedule'
        };
      }
    }
  }

  // 3. AUXILIARIES (Place, Language, Form) FOR GENERAL SUBJECTS
  let placeUdc = '', placeDdc = '', placeName = '';
  if (/\b(punjab)\b/i.test(t)) { placeUdc = '(540.15)'; placeDdc = '54552'; placeName = 'Punjab'; }
  else if (/\b(india|indian|bharat)\b/i.test(t)) { placeUdc = '(540)'; placeDdc = '54'; placeName = 'India'; }
  else if (/\b(pakistan|pakistani)\b/i.test(t)) { placeUdc = '(549.1)'; placeDdc = '5491'; placeName = 'Pakistan'; }
  else if (/\b(united states|usa|u\.s\.a\.|america|american)\b/i.test(t)) { placeUdc = '(73)'; placeDdc = '73'; placeName = 'United States'; }
  else if (/\b(united kingdom|uk|britain|british|england)\b/i.test(t)) { placeUdc = '(410)'; placeDdc = '41'; placeName = 'United Kingdom'; }
  else if (/\b(germany|german)\b/i.test(t)) { placeUdc = '(430)'; placeDdc = '43'; placeName = 'Germany'; }
  else if (/\b(france|french)\b/i.test(t)) { placeUdc = '(44)'; placeDdc = '44'; placeName = 'France'; }
  else if (/\b(china|chinese)\b/i.test(t)) { placeUdc = '(510)'; placeDdc = '51'; placeName = 'China'; }
  else if (/\b(europe|european)\b/i.test(t)) { placeUdc = '(4)'; placeDdc = '4'; placeName = 'Europe'; }

  let langUdc = '', langName = '';
  if (/\b(in english|english edition)\b/i.test(t)) { langUdc = '=111'; langName = 'English'; }
  else if (/\b(in punjabi|punjabi edition)\b/i.test(t)) { langUdc = '=214.27'; langName = 'Punjabi'; }
  else if (/\b(in hindi|hindi edition)\b/i.test(t)) { langUdc = '=214.21'; langName = 'Hindi'; }

  let formUdc = '', formDdc = '', formDesc = '';
  if (/\b(textbook|text book|course book|syllabus book)\b/i.test(t)) { formUdc = '(075)'; formDdc = '.071'; formDesc = 'Textbook'; }
  else if (/\b(encyclopedia|encyclopaedia|vishwakosh)\b/i.test(t)) { formUdc = '(031)'; formDdc = '03'; formDesc = 'Encyclopedia'; }
  else if (/\b(dictionary|shabdakosh|glossary|lexicon)\b/i.test(t)) { formUdc = '(038)'; formDdc = '03'; formDesc = 'Dictionary'; }
  else if (/\b(handbook|manual|guidebook)\b/i.test(t)) { formUdc = '(035)'; formDdc = '.02'; formDesc = 'Handbook'; }
  else if (/\b(directory|yearbook)\b/i.test(t)) { formUdc = '(058)'; formDdc = '.025'; formDesc = 'Directory'; }

  // 4. DETAILED SUBJECT HIERARCHY
  const DOMAINS = [
    { regex: /\b(animal physiology|veterinary physiology)\b/i, udc: '591.1', ddc: '571.1', name: 'Animal Physiology' },
    { regex: /\b(plant physiology)\b/i, udc: '581.1', ddc: '571.2', name: 'Plant Physiology' },
    { regex: /\b(human physiology|medical physiology|physiology)\b/i, udc: '612', ddc: '612', name: 'Human Physiology' },
    { regex: /\b(animal anatomy|veterinary anatomy|comparative anatomy)\b/i, udc: '591.4', ddc: '571.31', name: 'Animal Anatomy' },
    { regex: /\b(plant anatomy)\b/i, udc: '581.4', ddc: '571.32', name: 'Plant Anatomy' },
    { regex: /\b(human anatomy|anatomy)\b/i, udc: '611', ddc: '611', name: 'Human Anatomy' },

    { regex: /\b(public librar(y|ies))\b/i, udc: '027.4', ddc: '027.4', name: 'Public libraries' },
    { regex: /\b(academic librar(y|ies)|university librar(y|ies)|college librar(y|ies))\b/i, udc: '027.7', ddc: '027.7', name: 'University libraries' },
    { regex: /\b(school librar(y|ies))\b/i, udc: '027.8', ddc: '027.8', name: 'School libraries' },
    { regex: /\b(national librar(y|ies))\b/i, udc: '027.5', ddc: '027.5', name: 'National libraries' },
    { regex: /\b(special librar(y|ies))\b/i, udc: '026', ddc: '026', name: 'Special libraries' },
    { regex: /\b(library classification|colon classification|dewey decimal|ddc|udc)\b/i, udc: '025.4', ddc: '025.4', name: 'Library classification' },
    { regex: /\b(library catalogu?ing|cataloguing rules|marc)\b/i, udc: '025.3', ddc: '025.3', name: 'Library cataloguing' },
    { regex: /\b(library automation|digital librar(y|ies))\b/i, udc: '02:004', ddc: '025.04', name: 'Library automation' },
    { regex: /\b(librar(y|ies)|librarianship|library science|information science)\b/i, udc: '02', ddc: '020', name: 'Library Science' },

    { regex: /\b(wheat)\b/i, udc: '633.11', ddc: '633.11', name: 'Wheat' },
    { regex: /\b(maize|corn)\b/i, udc: '633.15', ddc: '633.15', name: 'Maize' },
    { regex: /\b(barley)\b/i, udc: '633.16', ddc: '633.16', name: 'Barley' },
    { regex: /\b(rice|paddy)\b/i, udc: '633.18', ddc: '633.18', name: 'Rice' },
    { regex: /\b(horticulture|gardening)\b/i, udc: '635', ddc: '635', name: 'Horticulture' },
    { regex: /\b(animal husbandry|livestock|dairy farming)\b/i, udc: '636', ddc: '636', name: 'Animal Husbandry' },
    { regex: /\b(veterinary medicine|veterinary science)\b/i, udc: '636.09', ddc: '636.089', name: 'Veterinary Medicine' },
    { regex: /\b(agriculture|farming|agronomy|crops?)\b/i, udc: '63', ddc: '630', name: 'Agriculture' },

    { regex: /\b(artificial intelligence|machine learning|deep learning|neural networks?)\b/i, udc: '004.8', ddc: '006.3', name: 'Artificial Intelligence' },
    { regex: /\b(data science|big data|analytics)\b/i, udc: '004.6', ddc: '005.7', name: 'Data Science' },
    { regex: /\b(cyber security|network security|cryptography)\b/i, udc: '004.056', ddc: '005.8', name: 'Cyber Security' },
    { regex: /\b(computer programming|software engineering|python|java|c\+\+)\b/i, udc: '004.4', ddc: '005.1', name: 'Programming & Software' },
    { regex: /\b(computer science|computing|computers?)\b/i, udc: '004', ddc: '004', name: 'Computer Science' },

    { regex: /\b(biochemistry)\b/i, udc: '577.1', ddc: '572', name: 'Biochemistry' },
    { regex: /\b(microbiology)\b/i, udc: '579', ddc: '579', name: 'Microbiology' },
    { regex: /\b(genetics)\b/i, udc: '575', ddc: '576.5', name: 'Genetics' },
    { regex: /\b(botany|plant biology|plants?)\b/i, udc: '58', ddc: '580', name: 'Botany' },
    { regex: /\b(zoology|animal biology|animals?)\b/i, udc: '59', ddc: '590', name: 'Zoology' },
    { regex: /\b(biology|biological sciences?)\b/i, udc: '57', ddc: '570', name: 'Biology' },
    { regex: /\b(algebra)\b/i, udc: '512', ddc: '512', name: 'Algebra' },
    { regex: /\b(geometry)\b/i, udc: '514', ddc: '516', name: 'Geometry' },
    { regex: /\b(calculus)\b/i, udc: '517', ddc: '515', name: 'Calculus' },
    { regex: /\b(mathematics|maths?)\b/i, udc: '51', ddc: '510', name: 'Mathematics' },
    { regex: /\b(organic chemistry)\b/i, udc: '547', ddc: '547', name: 'Organic Chemistry' },
    { regex: /\b(inorganic chemistry)\b/i, udc: '546', ddc: '546', name: 'Inorganic Chemistry' },
    { regex: /\b(chemistry)\b/i, udc: '54', ddc: '540', name: 'Chemistry' },
    { regex: /\b(optics|light)\b/i, udc: '535', ddc: '535', name: 'Optics' },
    { regex: /\b(thermodynamics)\b/i, udc: '536', ddc: '536', name: 'Thermodynamics' },
    { regex: /\b(nuclear physics)\b/i, udc: '539.1', ddc: '539.7', name: 'Nuclear Physics' },
    { regex: /\b(physics)\b/i, udc: '53', ddc: '530', name: 'Physics' },
    { regex: /\b(geology|earth sciences?)\b/i, udc: '55', ddc: '550', name: 'Geology' },
    { regex: /\b(astronomy|astrophysics)\b/i, udc: '52', ddc: '520', name: 'Astronomy' },
    { regex: /\b(science|pure sciences?)\b/i, udc: '5', ddc: '500', name: 'Science' },

    { regex: /\b(pharmacology|pharmacy|drugs?)\b/i, udc: '615', ddc: '615', name: 'Pharmacology' },
    { regex: /\b(surgery)\b/i, udc: '617', ddc: '617', name: 'Surgery' },
    { regex: /\b(pathology|diseases?)\b/i, udc: '616', ddc: '616', name: 'Pathology' },
    { regex: /\b(medicine|medical sciences?|healthcare)\b/i, udc: '61', ddc: '610', name: 'Medicine' },

    { regex: /\b(civil engineering|structural engineering|construction)\b/i, udc: '624', ddc: '624', name: 'Civil Engineering' },
    { regex: /\b(electrical engineering|electronics)\b/i, udc: '621.3', ddc: '621.3', name: 'Electrical Engineering' },
    { regex: /\b(mechanical engineering)\b/i, udc: '621', ddc: '621', name: 'Mechanical Engineering' },
    { regex: /\b(engineering|technology)\b/i, udc: '62', ddc: '620', name: 'Engineering' },

    { regex: /\b(international relations|foreign policy)\b/i, udc: '327', ddc: '327', name: 'International Relations' },
    { regex: /\b(political science|politics)\b/i, udc: '32', ddc: '320', name: 'Political Science' },
    { regex: /\b(economics?|economy)\b/i, udc: '33', ddc: '330', name: 'Economics' },
    { regex: /\b(law|jurisprudence|legal system|constitution)\b/i, udc: '34', ddc: '340', name: 'Law' },
    { regex: /\b(higher education|universit(y|ies))\b/i, udc: '378', ddc: '378', name: 'Higher Education' },
    { regex: /\b(education|teaching|pedagogy)\b/i, udc: '37', ddc: '370', name: 'Education' },
    { regex: /\b(sociology)\b/i, udc: '316', ddc: '301', name: 'Sociology' },
    { regex: /\b(psychology)\b/i, udc: '159.9', ddc: '150', name: 'Psychology' },
    { regex: /\b(philosophy)\b/i, udc: '1', ddc: '100', name: 'Philosophy' },
    { regex: /\b(religion|theology)\b/i, udc: '2', ddc: '200', name: 'Religion' },
    { regex: /\b(sikhism)\b/i, udc: '235', ddc: '294.6', name: 'Sikhism' },
    { regex: /\b(hinduism)\b/i, udc: '233', ddc: '294.5', name: 'Hinduism' },
    { regex: /\b(islam)\b/i, udc: '28', ddc: '297', name: 'Islam' },
    { regex: /\b(architecture)\b/i, udc: '72', ddc: '720', name: 'Architecture' },
    { regex: /\b(painting)\b/i, udc: '75', ddc: '750', name: 'Painting' },
    { regex: /\b(music)\b/i, udc: '78', ddc: '780', name: 'Music' },
    { regex: /\b(geography)\b/i, udc: '91', ddc: '910', name: 'Geography' },
    { regex: /\b(history)\b/i, udc: '94', ddc: '900', name: 'History' }
  ];

  for (const s of DOMAINS) {
    if (s.regex.test(t)) {
      const fullUdc = `${s.udc}${placeUdc}${formUdc}${langUdc}`;

      let fullDdc = s.ddc;
      if (placeDdc) {
        if (fullDdc.includes('.')) fullDdc = fullDdc + placeDdc;
        else if (fullDdc.endsWith('00')) fullDdc = fullDdc.charAt(0) + placeDdc;
        else if (fullDdc.endsWith('0')) fullDdc = fullDdc.slice(0, 2) + placeDdc;
        else fullDdc = fullDdc + '.' + placeDdc;
      } else if (formDdc) {
        if (formDdc === '03' && fullDdc.endsWith('00')) fullDdc = fullDdc.charAt(0) + '03';
        else fullDdc = fullDdc + formDdc;
      }

      const breakdownParts = [`${s.udc} = ${s.name}`];
      if (placeName) breakdownParts.push(`Place: ${placeUdc} (${placeName})`);
      if (formDesc) breakdownParts.push(`Form: ${formUdc} (${formDesc})`);
      if (langName) breakdownParts.push(`Language: ${langUdc} (${langName})`);

      return {
        udc: fullUdc,
        ddc: fullDdc,
        breakdown: breakdownParts.join(' · '),
        explanation: `${s.name} classified with facets: ${[placeName, formDesc, langName].filter(Boolean).join(', ')}.`,
        source: 'Master Facet Classification Matrix'
      };
    }
  }

  if (placeUdc && /\bhistory\b/i.test(t)) {
    return {
      udc: `94${placeUdc}`,
      ddc: `9${placeDdc}`,
      breakdown: `94 = General History · ${placeUdc} = ${placeName}`,
      explanation: `History of ${placeName}.`,
      source: 'Geographical History Synthesis'
    };
  }

  return null;
}

// ============================================================================
// GEMINI AI INTEGRATION (If API Key Configured)
// ============================================================================
async function queryGemini(title) {
  if (!GEMINI_API_KEY) return null;
  try {
    const prompt = `You are a professional library cataloguer specializing in Universal Decimal Classification (UDC) and Dewey Decimal Classification (DDC-23).
Analyze the title: "${title}"
Provide:
- Precise UDC notation (including form auxiliaries like (075), language auxiliaries like =111, place auxiliaries like (540), or special linguistic facets like '344 for pronunciation).
- Precise DDC notation (e.g. 441.52 for French pronunciation, 571.1 for animal physiology).
Output ONLY valid JSON:
{
  "udc": "string (valid classification notation only)",
  "ddc": "string (valid DDC number only)",
  "breakdown": "string (notation breakdown)",
  "explanation": "string (subject explanation)"
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      }),
      signal: AbortSignal.timeout(5000)
    });

    if (res.ok) {
      const json = await res.json();
      const txt = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (txt) {
        const parsed = JSON.parse(txt);
        if (isValidNotation(parsed.udc)) {
          parsed.source = 'AI Cataloguer (Gemini)';
          return parsed;
        }
      }
    }
  } catch (_) {}
  return null;
}

// ============================================================================
// API ENDPOINT
// ============================================================================
app.post('/api/classify', async (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required.' });
  }

  const cleanTitle = title.trim();

  // 1. Comprehensive Master Matrix
  const matrixResult = masterClassify(cleanTitle);

  // 2. Gemini fallback for edge cases
  const geminiResult = await queryGemini(cleanTitle);

  let finalUdc = null;
  let finalDdc = null;
  let finalBreakdown = '';
  let finalExplanation = '';
  let finalSource = '';

  if (matrixResult) {
    finalUdc = matrixResult.udc;
    finalDdc = matrixResult.ddc;
    finalBreakdown = matrixResult.breakdown;
    finalExplanation = matrixResult.explanation;
    finalSource = matrixResult.source;
  } else if (geminiResult && isValidNotation(geminiResult.udc)) {
    finalUdc = geminiResult.udc;
    finalDdc = geminiResult.ddc;
    finalBreakdown = geminiResult.breakdown || '';
    finalExplanation = geminiResult.explanation || '';
    finalSource = geminiResult.source;
  } else {
    finalUdc = '001';
    finalDdc = '001';
    finalBreakdown = '001 = Knowledge and civilization in general';
    finalExplanation = 'General title classification.';
    finalSource = 'General Library Classification';
  }

  return res.json({
    title: cleanTitle,
    udc_answer: finalUdc,
    ddc_answer: finalDdc,
    breakdown: finalBreakdown,
    explanation: finalExplanation,
    source: finalSource
  });
});

// ============================================================================
// CLEAN FRONTEND
// ============================================================================
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Library Classification — UDC & DDC</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f1f5f9; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px 16px 60px; }
    .wrap { max-width: 760px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { font-size: clamp(26px, 5vw, 38px); font-weight: 800; color: #1e293b; margin: 0 0 8px; }
    .header p { color: #64748b; font-size: 15px; margin: 0; }
    .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 24px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
    label { display: block; font-size: 12px; font-weight: 800; color: #475569; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.06em; }
    textarea { width: 100%; min-height: 100px; border: 2px solid #cbd5e1; border-radius: 14px; padding: 14px; font-size: 18px; color: #0f172a; outline: none; resize: vertical; font-family: inherit; }
    textarea:focus { border-color: #2563eb; }
    .action-row { display: flex; gap: 10px; margin-top: 14px; }
    button.btn-classify { flex: 1; border: 0; border-radius: 14px; padding: 15px 20px; color: #ffffff; font-weight: 800; font-size: 17px; background: linear-gradient(135deg, #2563eb, #1d4ed8); cursor: pointer; }
    button.btn-classify:disabled { opacity: 0.6; cursor: wait; }
    button.btn-voice { border: 0; border-radius: 14px; padding: 15px 20px; background: #e2e8f0; color: #1e293b; font-weight: 700; font-size: 16px; cursor: pointer; }
    .voice-status { font-size: 13px; color: #64748b; margin-top: 10px; }
    .error-box { display: none; margin-top: 16px; padding: 12px 16px; border-radius: 12px; background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; font-size: 14px; font-weight: 600; }
    #result { display: none; margin-top: 24px; }
    .title-banner { padding-bottom: 14px; border-bottom: 1px solid #f1f5f9; margin-bottom: 18px; }
    .title-banner .subhead { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }
    .title-banner h2 { margin: 6px 0 0; font-size: 22px; color: #0f172a; word-break: break-word; }
    .grid-results { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; }
    .result-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px; }
    .result-box.highlight { background: #eff6ff; border-color: #bfdbfe; }
    .result-box .tag { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #2563eb; margin-bottom: 6px; }
    .result-box .number { font-size: clamp(26px, 5vw, 38px); font-weight: 900; color: #0f172a; margin: 4px 0 8px; word-break: break-word; }
    .result-box .detail { font-size: 13px; color: #475569; line-height: 1.45; }
    .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 16px; font-size: 13px; color: #334155; line-height: 1.5; }
    .meta-box b { color: #0f172a; }
    .source-tag { display: inline-block; margin-top: 8px; padding: 4px 10px; border-radius: 999px; background: #e0f2fe; color: #0369a1; font-size: 11px; font-weight: 700; }
    @media (max-width: 600px) { .grid-results { grid-template-columns: 1fr; } .action-row { flex-direction: column; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>Library Classification</h1>
      <p>Universal Decimal Classification (UDC) & Dewey Decimal Classification (DDC)</p>
    </div>

    <div class="card">
      <label for="title">Book Title</label>
      <textarea id="title" placeholder="ਕਿਤਾਬ ਦਾ ਟਾਈਟਲ ਲਿਖੋ... e.g. French Pronunciation">French Pronunciation</textarea>

      <div class="action-row">
        <button id="go" class="btn-classify">⚡ Classify Book</button>
        <button id="voice" type="button" class="btn-voice">🎙️ Voice</button>
      </div>
      <div id="voiceStatus" class="voice-status">Tap Voice to speak title or type directly.</div>
      <div id="err" class="error-box"></div>
    </div>

    <div id="result" class="card">
      <div class="title-banner">
        <div class="subhead">Title Received</div>
        <h2 id="resTitle"></h2>
      </div>

      <div class="grid-results">
        <div class="result-box highlight">
          <div class="tag">UDC (Universal Decimal)</div>
          <div id="resUdc" class="number">-</div>
          <div id="resUdcBreakdown" class="detail"></div>
        </div>

        <div class="result-box">
          <div class="tag">DDC (Dewey Decimal)</div>
          <div id="resDdc" class="number">-</div>
          <div id="resDdcBreakdown" class="detail"></div>
        </div>
      </div>

      <div class="meta-box">
        <div><b>Explanation & Subject:</b> <span id="resExplain"></span></div>
        <div id="resSource" class="source-tag"></div>
      </div>
    </div>
  </div>

  <script>
    const $ = id => document.getElementById(id);

    $('go').addEventListener('click', async () => {
      const title = $('title').value.trim();
      const errBox = $('err');
      const resBox = $('result');

      errBox.style.display = 'none';
      resBox.style.display = 'none';

      if (!title) {
        errBox.textContent = 'ਕਿਰਪਾ ਕਰਕੇ ਕੋਈ ਟਾਈਟਲ ਦਰਜ ਕਰੋ।';
        errBox.style.display = 'block';
        return;
      }

      $('go').disabled = true;
      $('go').textContent = '⚡ ਲੱਭ ਰਿਹਾ ਹੈ...';

      try {
        const response = await fetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title })
        });

        if (!response.ok) throw new Error('ਸਰਵਰ ਵੱਲੋਂ ਗਲਤੀ ਆਈ ਹੈ।');
        const data = await response.json();

        $('resTitle').textContent = data.title || title;
        $('resUdc').textContent = data.udc_answer || data.udc || '001';
        $('resUdcBreakdown').textContent = data.breakdown || '';
        
        $('resDdc').textContent = data.ddc_answer || data.ddc || '001';
        $('resDdcBreakdown').textContent = data.breakdown || '';

        $('resExplain').textContent = data.explanation || 'ਵਰਗੀਕਰਨ ਪੂਰਾ ਹੋਇਆ।';
        $('resSource').textContent = 'Engine: ' + (data.source || 'Standard Schedule');

        resBox.style.display = 'block';
        resBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (err) {
        errBox.textContent = err.message || 'ਕਲਾਸੀਫਿਕੇਸ਼ਨ ਦੌਰਾਨ ਗਲਤੀ ਆਈ।';
        errBox.style.display = 'block';
      } finally {
        $('go').disabled = false;
        $('go').textContent = '⚡ Classify Book';
      }
    });

    (() => {
      const btn = $('voice');
      const status = $('voiceStatus');
      const field = $('title');
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        btn.addEventListener('click', () => { field.focus(); status.textContent = 'ਕੀਬੋਰਡ ਮਾਈਕ੍ਰੋਫੋਨ ਦੀ ਵਰਤੋਂ ਕਰੋ।'; });
        return;
      }

      const rec = new SpeechRecognition();
      rec.lang = 'en-IN';
      rec.interimResults = false;
      let listening = false;

      btn.addEventListener('click', () => {
        if (listening) { rec.stop(); return; }
        try {
          rec.start();
          listening = true;
          btn.textContent = '⏹ ਰੋਕੋ';
          status.textContent = 'ਸੁਣ ਰਿਹਾ ਹੈ... ਬੋਲੋ (Listening...)';
        } catch (_) { listening = false; }
      });

      rec.onresult = (e) => {
        field.value = e.results[0][0].transcript;
        $('go').click();
      };
      rec.onerror = () => { listening = false; btn.textContent = '🎙️ Voice'; };
      rec.onend = () => { listening = false; btn.textContent = '🎙️ Voice'; };
    })();
  </script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
