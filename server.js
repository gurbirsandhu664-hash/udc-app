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
// DDC-23 MATHEMATICAL SYNTHESIZER (Standard Subdivisions Table 1 & Table 2)
// ============================================================================
function buildDDC(baseDdc, formT1, placeT2) {
  let res = String(baseDdc || '001').trim();

  // 1. Form Auxiliaries (Table 1: Standard Subdivisions)
  if (formT1) {
    if (res === '500') {
      if (formT1 === '03') res = '503';
      else if (formT1 === '071') res = '507.1';
      else if (formT1 === '02') res = '502';
      else if (formT1 === '05') res = '505';
      else res = `50${formT1}`;
    } else if (res === '600') {
      res = formT1 === '03' ? '603' : `60${formT1}`;
    } else if (res === '700') {
      res = formT1 === '03' ? '703' : `70${formT1}`;
    } else if (res === '800') {
      res = formT1 === '03' ? '803' : `80${formT1}`;
    } else if (res === '900') {
      res = formT1 === '03' ? '903' : `90${formT1}`;
    } else if (res === '100') {
      res = formT1 === '03' ? '103' : `10${formT1}`;
    } else if (res === '200') {
      res = formT1 === '03' ? '203' : `20${formT1}`;
    } else if (res === '300') {
      res = formT1 === '03' ? '300.3' : `300.${formT1}`;
    } else if (res === '530') {
      // DDC-23 Schedule p.1042: Physics standard subdivisions are 530.01 - 530.09
      res = `530.${formT1}`;
    } else if (res === '510') {
      if (formT1 === '03') res = '510.3';
      else if (formT1 === '071') res = '510.71';
      else res = `510.${formT1}`;
    } else if (res === '540') {
      res = `540.${formT1.replace(/^0+/, '') || '3'}`;
    } else if (res === '570') {
      res = `570.${formT1.replace(/^0+/, '') || '3'}`;
    } else if (res === '580') {
      res = `580.${formT1.replace(/^0+/, '') || '3'}`;
    } else if (res === '590') {
      res = `590.${formT1.replace(/^0+/, '') || '3'}`;
    } else if (res === '610') {
      res = `610.${formT1.replace(/^0+/, '') || '3'}`;
    } else if (res === '620') {
      res = `620.${formT1}`;
    } else if (res === '630') {
      res = `630.${formT1.replace(/^0+/, '') || '3'}`;
    } else if (res === '020') {
      res = `020.${formT1.replace(/^0+/, '') || '3'}`;
    } else if (res.includes('.')) {
      res = `${res}0${formT1.replace(/^0+/, '')}`;
    } else {
      res = `${res}.${formT1}`;
    }
  }
  // 2. Geographic / Area Subdivisions (Table 2)
  else if (placeT2) {
    if (res.includes('.')) {
      res = `${res}${placeT2}`;
    } else if (res.endsWith('00')) {
      res = `${res.charAt(0)}${placeT2}`;
    } else if (res.endsWith('0')) {
      res = `${res}.9${placeT2}`;
    } else {
      res = `${res}.${placeT2}`;
    }
  }

  // Formatting Safety: In DDC, there must ALWAYS be a decimal dot after exactly 3 digits if length > 3
  if (res.length >= 4 && !res.includes('.')) {
    res = `${res.slice(0, 3)}.${res.slice(3)}`;
  }

  return res;
}

// ============================================================================
// COMPREHENSIVE CLASSIFIER MATRIX (UDC & DDC-23)
// ============================================================================
function masterClassify(title) {
  const t = norm(title);

  // -------------------------------------------------------------
  // 1. EXACT VERIFIED TITLES
  // -------------------------------------------------------------
  const EXACT = {
    'encyclopedia of science': { udc: '5(031)', ddc: '503', breakdown: '5 = Pure Sciences; (031) = Encyclopedias.', desc: 'Science Encyclopedia.' },
    'dictionary of science': { udc: '5(038)', ddc: '503', breakdown: '5 = Pure Sciences; (038) = Dictionaries.', desc: 'Science Dictionary.' },
    'dictionary of physics': { udc: '53(038)', ddc: '530.03', breakdown: '53 = Physics; (038) = Dictionaries. DDC-23 p.1042: 530.03 = Physics dictionaries.', desc: 'Physics Dictionary.' },
    'encyclopedia of physics': { udc: '53(031)', ddc: '530.03', breakdown: '53 = Physics; (031) = Encyclopedias.', desc: 'Physics Encyclopedia.' },
    'harvesting of wheat and maize': { udc: '633.11+633.15:631.55', ddc: '633.1', breakdown: '633.11 = wheat; 633.15 = maize; 631.55 = harvesting.', desc: 'Harvesting of wheat & maize.' },
    'harvesting of cereals': { udc: '633.1:631.55', ddc: '633.1', breakdown: '633.1 = cereals; 631.55 = harvesting.', desc: 'Cereal crops harvesting.' },
    'flood damage to wheat': { udc: '633.11:632.166', ddc: '633.11917', breakdown: '633.11 = wheat; 632.166 = flood damage.', desc: 'Flood damage to wheat.' },
    'fishing the whale fishes': { udc: '639.28', ddc: '639.28', breakdown: '639.28 = Whaling / whale fishing.', desc: 'Commercial whaling.' },
    'hindu chronological calendar': { udc: '529.324.5', ddc: '529.3245', breakdown: '529.324.5 = Hindu calendar.', desc: 'Hindu calendar chronology.' },
    'sobha singh': { udc: '75(084.1)SOB', ddc: '759.954', breakdown: '75 = Painting; (084.1) = pictorial; SOB = Sobha Singh.', desc: 'Sobha Singh reproductions.' },
    'bible': { udc: '27-23', ddc: '220', breakdown: '27-23 = The Bible; 220 = Bible.', desc: 'Christian Bible scriptures.' },
    'colon classification': { udc: '025.4', ddc: '025.4', breakdown: '025.4 = Library classification (Ranganathan Colon Classification).', desc: 'Colon Classification.' },
    'five laws of library science': { udc: '02', ddc: '020', breakdown: '02 = Librarianship (Ranganathan Five Laws).', desc: 'Foundations of Library Science.' },
    'animal physiology': { udc: '591.1', ddc: '571.1', breakdown: '591.1 = Animal physiology (General zoology). DDC 571.1 = Animal physiology.', desc: 'Animal Physiology.' },
    'plant physiology': { udc: '581.1', ddc: '571.2', breakdown: '581.1 = Plant physiology. DDC 571.2 = Plant physiology.', desc: 'Plant Physiology.' },
    'human physiology': { udc: '612', ddc: '612', breakdown: '612 = Human physiology.', desc: 'Human Physiology.' },
    'french pronunciation': { udc: "811.133.1'344", ddc: '441.52', breakdown: "811.133.1 = French language; '344 = Pronunciation & Phonetics. DDC 441.52 = French phonology.", desc: 'French Pronunciation.' }
  };
  if (EXACT[t]) return { ...EXACT[t], source: 'Verified Schedule Record' };

  // -------------------------------------------------------------
  // 2. LINGUISTICS & LANGUAGES
  // -------------------------------------------------------------
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
          breakdown: `${lang.udcLit} = ${lang.name} literature; -3 = Fiction.`,
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

  // -------------------------------------------------------------
  // 3. AUXILIARIES (Place, Language, Form)
  // -------------------------------------------------------------
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

  let formUdc = '', formT1 = '', formDesc = '';
  if (/\b(textbook|text book|course book|syllabus book)\b/i.test(t)) { formUdc = '(075)'; formT1 = '071'; formDesc = 'Textbook'; }
  else if (/\b(encyclopedia|encyclopaedia|vishwakosh)\b/i.test(t)) { formUdc = '(031)'; formT1 = '03'; formDesc = 'Encyclopedia'; }
  else if (/\b(dictionary|shabdakosh|glossary|lexicon)\b/i.test(t)) { formUdc = '(038)'; formT1 = '03'; formDesc = 'Dictionary'; }
  else if (/\b(handbook|manual|guidebook)\b/i.test(t)) { formUdc = '(035)'; formT1 = '02'; formDesc = 'Handbook'; }
  else if (/\b(directory|yearbook)\b/i.test(t)) { formUdc = '(058)'; formT1 = '05'; formDesc = 'Directory'; }

  // -------------------------------------------------------------
  // 4. DETAILED DISCIPLINE TAXONOMY
  // -------------------------------------------------------------
  const DOMAINS = [
    // Animal vs Plant vs Human Physiology & Anatomy
    { regex: /\b(animal physiology|veterinary physiology)\b/i, udc: '591.1', ddc: '571.1', name: 'Animal Physiology' },
    { regex: /\b(plant physiology)\b/i, udc: '581.1', ddc: '571.2', name: 'Plant Physiology' },
    { regex: /\b(human physiology|medical physiology|physiology)\b/i, udc: '612', ddc: '612', name: 'Human Physiology' },
    { regex: /\b(animal anatomy|veterinary anatomy|comparative anatomy)\b/i, udc: '591.4', ddc: '571.31', name: 'Animal Anatomy' },
    { regex: /\b(plant anatomy)\b/i, udc: '581.4', ddc: '571.32', name: 'Plant Anatomy' },
    { regex: /\b(human anatomy|anatomy)\b/i, udc: '611', ddc: '611', name: 'Human Anatomy' },

    // Libraries
    { regex: /\b(public librar(y|ies))\b/i, udc: '027.4', ddc: '027.4', name: 'Public libraries' },
    { regex: /\b(academic librar(y|ies)|university librar(y|ies)|college librar(y|ies))\b/i, udc: '027.7', ddc: '027.7', name: 'University libraries' },
    { regex: /\b(school librar(y|ies))\b/i, udc: '027.8', ddc: '027.8', name: 'School libraries' },
    { regex: /\b(national librar(y|ies))\b/i, udc: '027.5', ddc: '027.5', name: 'National libraries' },
    { regex: /\b(special librar(y|ies))\b/i, udc: '026', ddc: '026', name: 'Special libraries' },
    { regex: /\b(library classification|colon classification|dewey decimal|ddc|udc)\b/i, udc: '025.4', ddc: '025.4', name: 'Library classification' },
    { regex: /\b(library catalogu?ing|cataloguing rules|marc)\b/i, udc: '025.3', ddc: '025.3', name: 'Library cataloguing' },
    { regex: /\b(library automation|digital librar(y|ies))\b/i, udc: '02:004', ddc: '025.04', name: 'Library automation' },
    { regex: /\b(librar(y|ies)|librarianship|library science|information science)\b/i, udc: '02', ddc: '020', name: 'Library Science' },

    // Agriculture
    { regex: /\b(wheat)\b/i, udc: '633.11', ddc: '633.11', name: 'Wheat' },
    { regex: /\b(maize|corn)\b/i, udc: '633.15', ddc: '633.15', name: 'Maize' },
    { regex: /\b(barley)\b/i, udc: '633.16', ddc: '633.16', name: 'Barley' },
    { regex: /\b(rice|paddy)\b/i, udc: '633.18', ddc: '633.18', name: 'Rice' },
    { regex: /\b(horticulture|gardening)\b/i, udc: '635', ddc: '635', name: 'Horticulture' },
    { regex: /\b(animal husbandry|livestock|dairy farming)\b/i, udc: '636', ddc: '636', name: 'Animal Husbandry' },
    { regex: /\b(veterinary medicine|veterinary science)\b/i, udc: '636.09', ddc: '636.089', name: 'Veterinary Medicine' },
    { regex: /\b(agriculture|farming|agronomy|crops?)\b/i, udc: '63', ddc: '630', name: 'Agriculture' },

    // Computing & AI
    { regex: /\b(artificial intelligence|machine learning|deep learning)\b/i, udc: '004.8', ddc: '006.3', name: 'Artificial Intelligence' },
    { regex: /\b(data science|big data|analytics)\b/i, udc: '004.6', ddc: '005.7', name: 'Data Science' },
    { regex: /\b(cyber security|network security|cryptography)\b/i, udc: '004.056', ddc: '005.8', name: 'Cyber Security' },
    { regex: /\b(computer programming|software engineering|python|java|c\+\+)\b/i, udc: '004.4', ddc: '005.1', name: 'Programming & Software' },
    { regex: /\b(computer science|computing|computers?)\b/i, udc: '004', ddc: '004', name: 'Computer Science' },

    // Natural Sciences & Math
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

    // Medicine
    { regex: /\b(pharmacology|pharmacy|drugs?)\b/i, udc: '615', ddc: '615', name: 'Pharmacology' },
    { regex: /\b(surgery)\b/i, udc: '617', ddc: '617', name: 'Surgery' },
    { regex: /\b(pathology|diseases?)\b/i, udc: '616', ddc: '616', name: 'Pathology' },
    { regex: /\b(medicine|medical sciences?|healthcare)\b/i, udc: '61', ddc: '610', name: 'Medicine' },

    // Engineering
    { regex: /\b(civil engineering|structural engineering|construction)\b/i, udc: '624', ddc: '624', name: 'Civil Engineering' },
    { regex: /\b(electrical engineering|electronics)\b/i, udc: '621.3', ddc: '621.3', name: 'Electrical Engineering' },
    { regex: /\b(mechanical engineering)\b/i, udc: '621', ddc: '621', name: 'Mechanical Engineering' },
    { regex: /\b(engineering|technology)\b/i, udc: '62', ddc: '620', name: 'Engineering' },

    // Social Sciences & Humanities
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
      // 1. UDC: Base + Place + Form + Language
      const fullUdc = `${s.udc}${placeUdc}${formUdc}${langUdc}`;

      // 2. DDC: Accurate Standard Subdivision / Area Synthesizer
      const fullDdc = buildDDC(s.ddc, formT1, placeDdc);

      const breakdownParts = [`${s.udc} = ${s.name}`];
      if (placeName) breakdownParts.push(`Place: ${placeUdc} (${placeName})`);
      if (formDesc) breakdownParts.push(`Form: ${formUdc} (${formDesc})`);
      if (langName) breakdownParts.push(`Language: ${langUdc} (${langName})`);

      return {
        udc: fullUdc,
        ddc: fullDdc,
        breakdown: breakdownParts.join(' · '),
        explanation: `${s.name} classified with facets: ${[placeName, formDesc, langName].filter(Boolean).join(', ')}.`,
        source: 'Advanced DDC & UDC Synthesizer'
      };
    }
  }

  // Geographic history fallback
  if (placeUdc && /\bhistory\b/i.test(t)) {
    const ddcHist = buildDDC('900', null, placeDdc);
    return {
      udc: `94${placeUdc}`,
      ddc: ddcHist,
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
Analyze: "${title}"
Rules:
- Dictionary of Physics: UDC 53(038), DDC 530.03 (NEVER 53003!)
- Encyclopedia of Science: UDC 5(031), DDC 503
- Animal Physiology: UDC 591.1, DDC 571.1
- French Pronunciation: UDC 811.133.1'344, DDC 441.52
Output ONLY JSON:
{
  "udc": "string (valid classification notation only)",
  "ddc": "string (valid DDC number with dot after 3 digits, e.g. 530.03)",
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
        if (isValidNotation(parsed.udc) && isValidNotation(
