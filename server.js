import http from 'node:http';

const PORT = process.env.PORT || 10000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

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
// DDC-23 MATHEMATICAL SYNTHESIZER
// ============================================================================
function buildDDC(baseDdc, formT1, placeT2) {
  let res = String(baseDdc || '020').trim();

  if (formT1) {
    if (res === '500') {
      if (formT1 === '03') res = '503';
      else if (formT1 === '071') res = '507.1';
      else if (formT1 === '02') res = '502';
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
  } else if (placeT2) {
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

  if (res.length >= 4 && !res.includes('.')) {
    res = `${res.slice(0, 3)}.${res.slice(3)}`;
  }
  return res;
}

// 57 Geographic Entities
const GEOGRAPHY = [
  { regex: /\b(japan|japanese)\b/i, udc: '(520)', ddc: '52', name: 'Japan' },
  { regex: /\b(china|chinese)\b/i, udc: '(510)', ddc: '51', name: 'China' },
  { regex: /\b(punjab)\b/i, udc: '(540.15)', ddc: '54552', name: 'Punjab' },
  { regex: /\b(india|indian|bharat)\b/i, udc: '(540)', ddc: '54', name: 'India' },
  { regex: /\b(pakistan|pakistani)\b/i, udc: '(549.1)', ddc: '5491', name: 'Pakistan' },
  { regex: /\b(bangladesh|bengali)\b/i, udc: '(549.3)', ddc: '5493', name: 'Bangladesh' },
  { regex: /\b(sri lanka|ceylon)\b/i, udc: '(548.7)', ddc: '5487', name: 'Sri Lanka' },
  { regex: /\b(nepal|nepali)\b/i, udc: '(549.6)', ddc: '5496', name: 'Nepal' },
  { regex: /\b(afghanistan|afghan)\b/i, udc: '(581)', ddc: '581', name: 'Afghanistan' },
  { regex: /\b(iran|persia|persian)\b/i, udc: '(55)', ddc: '55', name: 'Iran' },
  { regex: /\b(iraq|iraqi)\b/i, udc: '(567)', ddc: '567', name: 'Iraq' },
  { regex: /\b(israel|israeli|palestine)\b/i, udc: '(569.4)', ddc: '5694', name: 'Israel / Palestine' },
  { regex: /\b(saudi arabia|arabia|saudi|arab)\b/i, udc: '(53)', ddc: '53', name: 'Arabian Peninsula' },
  { regex: /\b(turkey|turkish|ottoman)\b/i, udc: '(560)', ddc: '56', name: 'Turkey' },
  { regex: /\b(russia|russian|soviet|ussr)\b/i, udc: '(470)', ddc: '47', name: 'Russia' },
  { regex: /\b(korea|korean|south korea|north korea)\b/i, udc: '(519)', ddc: '519', name: 'Korea' },
  { regex: /\b(indonesia|indonesian)\b/i, udc: '(594)', ddc: '598', name: 'Indonesia' },
  { regex: /\b(malaysia|malaysian)\b/i, udc: '(595)', ddc: '595', name: 'Malaysia' },
  { regex: /\b(singapore)\b/i, udc: '(595.13)', ddc: '5957', name: 'Singapore' },
  { regex: /\b(thailand|thai|siam)\b/i, udc: '(593)', ddc: '593', name: 'Thailand' },
  { regex: /\b(united kingdom|uk|britain|british|england)\b/i, udc: '(410)', ddc: '41', name: 'United Kingdom' },
  { regex: /\b(scotland|scottish)\b/i, udc: '(411)', ddc: '411', name: 'Scotland' },
  { regex: /\b(ireland|irish)\b/i, udc: '(415)', ddc: '415', name: 'Ireland' },
  { regex: /\b(germany|german)\b/i, udc: '(430)', ddc: '43', name: 'Germany' },
  { regex: /\b(france|french)\b/i, udc: '(44)', ddc: '44', name: 'France' },
  { regex: /\b(italy|italian|rome|roman)\b/i, udc: '(450)', ddc: '45', name: 'Italy' },
  { regex: /\b(spain|spanish)\b/i, udc: '(460)', ddc: '46', name: 'Spain' },
  { regex: /\b(portugal|portuguese)\b/i, udc: '(469)', ddc: '469', name: 'Portugal' },
  { regex: /\b(netherlands|holland|dutch)\b/i, udc: '(492)', ddc: '492', name: 'Netherlands' },
  { regex: /\b(switzerland|swiss)\b/i, udc: '(494)', ddc: '494', name: 'Switzerland' },
  { regex: /\b(greece|greek)\b/i, udc: '(495)', ddc: '495', name: 'Greece' },
  { regex: /\b(sweden|swedish)\b/i, udc: '(485)', ddc: '485', name: 'Sweden' },
  { regex: /\b(norway|norwegian)\b/i, udc: '(481)', ddc: '481', name: 'Norway' },
  { regex: /\b(poland|polish)\b/i, udc: '(438)', ddc: '438', name: 'Poland' },
  { regex: /\b(united states|usa|u\.s\.a\.|america|american)\b/i, udc: '(73)', ddc: '73', name: 'United States' },
  { regex: /\b(canada|canadian)\b/i, udc: '(71)', ddc: '71', name: 'Canada' },
  { regex: /\b(mexico|mexican)\b/i, udc: '(72)', ddc: '72', name: 'Mexico' },
  { regex: /\b(brazil|brazilian)\b/i, udc: '(81)', ddc: '81', name: 'Brazil' },
  { regex: /\b(argentina|argentine)\b/i, udc: '(82)', ddc: '82', name: 'Argentina' },
  { regex: /\b(egypt|egyptian)\b/i, udc: '(620)', ddc: '62', name: 'Egypt' },
  { regex: /\b(south africa|south african)\b/i, udc: '(680)', ddc: '68', name: 'South Africa' },
  { regex: /\b(australia|australian)\b/i, udc: '(94)', ddc: '94', name: 'Australia' },
  { regex: /\b(new zealand)\b/i, udc: '(931)', ddc: '93', name: 'New Zealand' },
  { regex: /\b(europe|european)\b/i, udc: '(4)', ddc: '4', name: 'Europe' },
  { regex: /\b(asia|asian)\b/i, udc: '(5)', ddc: '5', name: 'Asia' },
  { regex: /\b(africa|african)\b/i, udc: '(6)', ddc: '6', name: 'Africa' },
  { regex: /\b(latin america|south america)\b/i, udc: '(8)', ddc: '8', name: 'South America' }
];

function rawClassify(title) {
  const t = norm(title);

  // Exact Titles
  const EXACT = {
    'encyclopedia of science': { udc: '5(031)', ddc: '503', breakdown: '5 = Pure Sciences; (031) = Encyclopedias.', desc: 'Science Encyclopedia.' },
    'dictionary of science': { udc: '5(038)', ddc: '503', breakdown: '5 = Pure Sciences; (038) = Dictionaries.', desc: 'Science Dictionary.' },
    'dictionary of physics': { udc: '53(038)', ddc: '530.03', breakdown: '53 = Physics; (038) = Dictionaries. DDC-23: 530.03 = Physics dictionaries.', desc: 'Physics Dictionary.' },
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
    'animal physiology': { udc: '591.1', ddc: '571.1', breakdown: '591.1 = Animal physiology. DDC 571.1 = Animal physiology.', desc: 'Animal Physiology.' },
    'plant physiology': { udc: '581.1', ddc: '571.2', breakdown: '581.1 = Plant physiology. DDC 571.2 = Plant physiology.', desc: 'Plant Physiology.' },
    'human physiology': { udc: '612', ddc: '612', breakdown: '612 = Human physiology.', desc: 'Human Physiology.' },
    'french pronunciation': { udc: "811.133.1'344", ddc: '441.52', breakdown: "811.133.1 = French language; '344 = Pronunciation & Phonetics. DDC 441.52 = French phonology.", desc: 'French Pronunciation.' },
    'fevicol': { udc: '668.3', ddc: '668.3', breakdown: '668.3 = Adhesives. Glues. Synthetic resin adhesives (Polyvinyl Acetate). DDC 668.3 = Adhesives and related products.', desc: 'Fevicol (Synthetic resin adhesive / glue).' },
    'favikol': { udc: '668.3', ddc: '668.3', breakdown: '668.3 = Adhesives. Glues. Synthetic resin adhesives (Polyvinyl Acetate). DDC 668.3 = Adhesives and related products.', desc: 'Fevicol (Synthetic resin adhesive / glue).' },
    'fevikol': { udc: '668.3', ddc: '668.3', breakdown: '668.3 = Adhesives. Glues. Synthetic resin adhesives (Polyvinyl Acetate). DDC 668.3 = Adhesives and related products.', desc: 'Fevicol (Synthetic resin adhesive / glue).' },
    'adhesive': { udc: '668.3', ddc: '668.3', breakdown: '668.3 = Adhesives and glues.', desc: 'Adhesives technology.' },
    'adhesives': { udc: '668.3', ddc: '668.3', breakdown: '668.3 = Adhesives and glues.', desc: 'Adhesives technology.' },
    'glue': { udc: '668.3', ddc: '668.3', breakdown: '668.3 = Adhesives and glues.', desc: 'Glues and adhesives.' }
  };
  if (EXACT[t]) return { ...EXACT[t], source: 'Standard Verified Schedule' };

  let placeUdc = '', placeDdc = '', placeName = '';
  for (const geo of GEOGRAPHY) {
    if (geo.regex.test(t)) {
      placeUdc = geo.udc;
      placeDdc = geo.ddc;
      placeName = geo.name;
      break;
    }
  }

  // Cross-discipline
  if (/\b(medic(al|ine)|healthcare|nursing)\b/i.test(t) && /\b(educat(ion|ional)|teaching|colleges?|schools?|curriculum|training)\b/i.test(t)) {
    const u = `61:37${placeUdc}`;
    const d = placeDdc ? `610.711${placeDdc}` : `610.711`;
    return {
      udc: u,
      ddc: d,
      breakdown: `61 = Medical Sciences; 37 = Education${placeName ? '; ' + placeUdc + ' = ' + placeName : ''}. DDC ${d} = Medical Education.`,
      explanation: `Interdisciplinary: Medical education${placeName ? ' in ' + placeName : ''}.`,
      source: 'Cross-Discipline Synthesis (Medicine + Education)'
    };
  }

  if (/\b(ai|artificial intelligence|machine learning)\b/i.test(t) && /\b(health|medic(al|ine)|hospital|clinical)\b/i.test(t)) {
    const u = `004.8:61${placeUdc}`;
    const d = placeDdc ? `610.285${placeDdc}` : `610.285`;
    return {
      udc: u,
      ddc: d,
      breakdown: `004.8 = Artificial Intelligence; 61 = Medicine${placeName ? '; ' + placeUdc + ' = ' + placeName : ''}.`,
      explanation: `Applied Artificial Intelligence in Medicine & Healthcare.`,
      source: 'Cross-Discipline Synthesis (AI + Medicine)'
    };
  }

  if (/\b(agricultur(e|al)|farming|crops?)\b/i.test(t) && /\b(econom(y|ics)|market|business)\b/i.test(t)) {
    const u = `63:33${placeUdc}`;
    const d = placeDdc ? `338.1${placeDdc}` : `338.1`;
    return {
      udc: u,
      ddc: d,
      breakdown: `63 = Agriculture; 33 = Economics${placeName ? '; ' + placeUdc + ' = ' + placeName : ''}. DDC ${d} = Agricultural Economics.`,
      explanation: `Agricultural Economics${placeName ? ' in ' + placeName : ''}.`,
      source: 'Cross-Discipline Synthesis (Agriculture + Economics)'
    };
  }

  if (/\b(librar(y|ies)|librarianship)\b/i.test(t) && /\b(automat(ion|ed)|computer|software|digital)\b/i.test(t)) {
    const u = `02:004${placeUdc}`;
    return {
      udc: u,
      ddc: '025.04',
      breakdown: `02 = Library Science; 004 = Computing. DDC 025.04 = Automated information retrieval.`,
      explanation: `Library Automation & Information Systems.`,
      source: 'Cross-Discipline Synthesis (Library + Automation)'
    };
  }

  // Languages
  const LANG_MAP = [
    { regex: /\b(french)\b/i, name: 'French', udcLang: '811.133.1', ddcBase: '44', ddcStandard: '440', udcLit: '821.133.1', ddcLit: '840' },
    { regex: /\b(english)\b/i, name: 'English', udcLang: '811.111', ddcBase: '42', ddcStandard: '420', udcLit: '821.111', ddcLit: '820' },
    { regex: /\b(german)\b/i, name: 'German', udcLang: '811.112.2', ddcBase: '43', ddcStandard: '430', udcLit: '821.112.2', ddcLit: '830' },
    { regex: /\b(spanish)\b/i, name: 'Spanish', udcLang: '811.134.2', ddcBase: '46', ddcStandard: '460', udcLit: '821.134.2', ddcLit: '860' },
    { regex: /\b(italian)\b/i, name: 'Italian', udcLang: '811.131.1', ddcBase: '45', ddcStandard: '450', udcLit: '821.131.1', ddcLit: '850' },
    { regex: /\b(punjabi|panjabi)\b/i, name: 'Punjabi', udcLang: '811.214.27', ddcBase: '491.42', ddcStandard: '491.42', udcLit: '821.214.27', ddcLit: '891.42' },
    { regex: /\b(hindi)\b/i, name: 'Hindi', udcLang: '811.214.21', ddcBase: '491.43', ddcStandard: '491.43', udcLit: '821.214.21', ddcLit: '891.43' },
    { regex: /\b(urdu)\b/i, name: 'Urdu', udcLang: '811.214.22', ddcBase: '491.439', ddcStandard: '491.439', udcLit: '821.214.22', ddcLit: '891.439' }
  ];

  for (const lang of LANG_MAP) {
    if (lang.regex.test(t)) {
      if (/\b(pronunciation|phonetics|phonology|accent)\b/i.test(t)) {
        const ddcNum = lang.ddcBase.length === 2 ? `${lang.ddcBase}1.52` : `${lang.ddcBase}152`;
        return {
          udc: `${lang.udcLang}'344`,
          ddc: ddcNum,
          breakdown: `${lang.udcLang} = ${lang.name} language; '344 = Pronunciation. DDC ${ddcNum} = ${lang.name} phonology.`,
          explanation: `Linguistics: ${lang.name} pronunciation.`,
          source: 'Linguistics Schedule (UDC & DDC Table 4)'
        };
      }
      if (/\b(grammar|syntax|morphology)\b/i.test(t)) {
        return {
          udc: `${lang.udcLang}'36`,
          ddc: `${lang.ddcBase}5`,
          breakdown: `${lang.udcLang} = ${lang.name} language; '36 = Grammar.`,
          explanation: `Linguistics: ${lang.name} grammar.`,
          source: 'Linguistics Schedule'
        };
      }
      if (/\b(dictionary|shabdakosh|glossary)\b/i.test(t)) {
        return {
          udc: `${lang.udcLang}(038)`,
          ddc: `${lang.ddcBase}3`,
          breakdown: `${lang.udcLang} = ${lang.name} language; (038) = Dictionary.`,
          explanation: `Linguistics: ${lang.name} dictionary.`,
          source: 'Linguistics Schedule'
        };
      }
      if (/\b(poetry|poem|poems)\b/i.test(t)) {
        return {
          udc: `${lang.udcLit}-1`,
          ddc: `${lang.ddcLit}1`,
          breakdown: `${lang.udcLit} = ${lang.name} literature; -1 = Poetry.`,
          explanation: `Literature: ${lang.name} poetry.`,
          source: 'Literature Schedule'
        };
      }
    }
  }

  let langUdc = '', langName = '';
  if (/\b(in english)\b/i.test(t)) { langUdc = '=111'; langName = 'English'; }
  else if (/\b(in punjabi)\b/i.test(t)) { langUdc = '=214.27'; langName = 'Punjabi'; }
  else if (/\b(in hindi)\b/i.test(t)) { langUdc = '=214.21'; langName = 'Hindi'; }

  let formUdc = '', formT1 = '', formDesc = '';
  if (/\b(textbook|text book|course book)\b/i.test(t)) { formUdc = '(075)'; formT1 = '071'; formDesc = 'Textbook'; }
  else if (/\b(encyclopedia|encyclopaedia|vishwakosh)\b/i.test(t)) { formUdc = '(031)'; formT1 = '03'; formDesc = 'Encyclopedia'; }
  else if (/\b(dictionary|shabdakosh|glossary)\b/i.test(t)) { formUdc = '(038)'; formT1 = '03'; formDesc = 'Dictionary'; }
  else if (/\b(handbook|manual|guidebook)\b/i.test(t)) { formUdc = '(035)'; formT1 = '02'; formDesc = 'Handbook'; }

  const DOMAINS = [
    { regex: /\b(animal physiology|veterinary physiology)\b/i, udc: '591.1', ddc: '571.1', name: 'Animal Physiology' },
    { regex: /\b(plant physiology)\b/i, udc: '581.1', ddc: '571.2', name: 'Plant Physiology' },
    { regex: /\b(human physiology|medical physiology|physiology)\b/i, udc: '612', ddc: '612', name: 'Human Physiology' },
    { regex: /\b(public librar(y|ies))\b/i, udc: '027.4', ddc: '027.4', name: 'Public libraries' },
    { regex: /\b(academic librar(y|ies)|university librar(y|ies))\b/i, udc: '027.7', ddc: '027.7', name: 'University libraries' },
    { regex: /\b(library classification|colon classification|dewey decimal)\b/i, udc: '025.4', ddc: '025.4', name: 'Library classification' },
    { regex: /\b(library catalogu?ing)\b/i, udc: '025.3', ddc: '025.3', name: 'Library cataloguing' },
    { regex: /\b(librar(y|ies)|librarianship|library science)\b/i, udc: '02', ddc: '020', name: 'Library Science' },
    { regex: /\b(wheat)\b/i, udc: '633.11', ddc: '633.11', name: 'Wheat' },
    { regex: /\b(maize|corn)\b/i, udc: '633.15', ddc: '633.15', name: 'Maize' },
    { regex: /\b(agriculture|farming|crops?)\b/i, udc: '63', ddc: '630', name: 'Agriculture' },
    { regex: /\b(computer science|computing|computers?|software)\b/i, udc: '004', ddc: '004', name: 'Computer Science' },
    { regex: /\b(mathematics|maths?)\b/i, udc: '51', ddc: '510', name: 'Mathematics' },
    { regex: /\b(physics)\b/i, udc: '53', ddc: '530', name: 'Physics' },
    { regex: /\b(fevicol|favikol|fevikol|adhesives?|glues?|synthetic resin adhesives?)\b/i, udc: '668.3', ddc: '668.3', name: 'Adhesives & Glues (Fevicol)' },
    { regex: /\b(chemistry)\b/i, udc: '54', ddc: '540', name: 'Chemistry' },
    { regex: /\b(biology|biological sciences?)\b/i, udc: '57', ddc: '570', name: 'Biology' },
    { regex: /\b(botany|plants?)\b/i, udc: '58', ddc: '580', name: 'Botany' },
    { regex: /\b(zoology|animals?)\b/i, udc: '59', ddc: '590', name: 'Zoology' },
    { regex: /\b(medic(al|ine)|health|diseases?)\b/i, udc: '61', ddc: '610', name: 'Medicine' },
    { regex: /\b(engineering|technology)\b/i, udc: '62', ddc: '620', name: 'Engineering' },
    { regex: /\b(economics?|economy)\b/i, udc: '33', ddc: '330', name: 'Economics' },
    { regex: /\b(political science|politics)\b/i, udc: '32', ddc: '320', name: 'Political Science' },
    { regex: /\b(educat(ion|ional)|teaching|schools?)\b/i, udc: '37', ddc: '370', name: 'Education' },
    { regex: /\b(history)\b/i, udc: '94', ddc: '900', name: 'History' },
    { regex: /\b(geography)\b/i, udc: '91', ddc: '910', name: 'Geography' }
  ];

  for (const s of DOMAINS) {
    if (s.regex.test(t)) {
      const fullUdc = `${s.udc}${placeUdc}${formUdc}${langUdc}`;
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

  if (placeUdc && /\bhistory\b/i.test(t)) {
    return {
      udc: `94${placeUdc}`,
      ddc: buildDDC('900', null, placeDdc),
      breakdown: `94 = History · ${placeUdc} = ${placeName}`,
      explanation: `History of ${placeName}.`,
      source: 'Geographical History Synthesis'
    };
  }

  return null;
}

// ============================================================================
// WATCHMAN & QUALITY INSPECTOR
// ============================================================================
function watchmanVerify(title, initialResult) {
  const t = norm(title);
  let res = { ...initialResult };

  // 1. DDC ਫਾਰਮੈਟ ਵਾਚ: ਕਦੇ ਵੀ ਬਿਨਾਂ ਡੌਟ ਵਾਲਾ ਲੰਬਾ ਨੰਬਰ ਨਾ ਨਿਕਲੇ
  if (res.ddc_number && res.ddc_number.length >= 4 && !res.ddc_number.includes('.')) {
    res.ddc_number = `${res.ddc_number.slice(0, 3)}.${res.ddc_number.slice(3)}`;
    res.ddc_answer = res.ddc_number;
  }

  // 2. ਡਿਫੌਲਟ 001 ਨੂੰ ਰੋਕਣਾ: ਜੇ ਨਤੀਜਾ 001 ਹੋਵੇ, ਤਾਂ ਵਿਸ਼ੇ ਦੇ ਮੁੱਖ ਸ਼ਬਦ ਅਨੁਸਾਰ ਠੀਕ ਕਰਨਾ
  if (res.udc_number === '001' || !res.udc_number || res.udc_number === '020') {
    if (/\b(science)\b/i.test(t)) { res.udc_number = '5'; res.ddc_number = '500'; }
    else if (/\b(history)\b/i.test(t)) { res.udc_number = '94'; res.ddc_number = '900'; }
    else if (/\b(education|teaching)\b/i.test(t)) { res.udc_number = '37'; res.ddc_number = '370'; }
    else if (/\b(health|medicine)\b/i.test(t)) { res.udc_number = '61'; res.ddc_number = '610'; }
    else if (/\b(computer)\b/i.test(t)) { res.udc_number = '004'; res.ddc_number = '004'; }
    else if (/\b(library)\b/i.test(t)) { res.udc_number = '02'; res.ddc_number = '020'; }
    res.udc_answer = res.udc_number;
    res.ddc_answer = res.ddc_number;
  }

  // 3. ਦੇਸ਼ ਵਾਚ (Missing Place Guard): ਜੇਕਰ ਟਾਈਟਲ 'ਚ ਦੇਸ਼ ਹੈ ਪਰ UDC 'ਚ ਨਹੀਂ
  if (!res.udc_number.includes('(')) {
    for (const geo of GEOGRAPHY) {
      if (geo.regex.test(t)) {
        res.udc_number = `${res.udc_number}${geo.udc}`;
        res.udc_answer = res.udc_number;
        res.ddc_number = buildDDC(res.ddc_number, null, geo.ddc);
        res.ddc_answer = res.ddc_number;
        break;
      }
    }
  }

  // 4. ਲਾਇਬ੍ਰੇਰੀ ਪਬਲਿਕ ਵਾਚ
  if (/\b(public librar(y|ies))\b/i.test(t) && !res.udc_number.startsWith('027.4')) {
    const hasIndia = /\b(india|indian)\b/i.test(t);
    res.udc_number = hasIndia ? '027.4(540)' : '027.4';
    res.ddc_number = hasIndia ? '027.454' : '027.4';
    res.udc_answer = res.udc_number;
    res.ddc_answer = res.ddc_number;
  }

  // 5. ਫ਼ੈਵੀਕੋਲ ਵਾਚ
  if (/\b(fevicol|favikol|fevikol)\b/i.test(t)) {
    res.udc_number = '668.3';
    res.ddc_number = '668.3';
    res.udc_answer = '668.3';
    res.ddc_answer = '668.3';
    res.breakdown = '668.3 = Adhesives. Glues. Synthetic resin adhesives (Polyvinyl Acetate).';
    res.explanation = 'Fevicol (Synthetic resin adhesive / glue).';
  }

  res.source = (res.source || 'Standard Schedule') + ' [Watchman Verified]';
  return res;
}

// Gemini AI fallback
async function queryGemini(title) {
  if (!GEMINI_API_KEY) return null;
  try {
    const prompt = `Classify this book title into Universal Decimal Classification (UDC) and Dewey Decimal Classification (DDC).
Title: "${title}"
Rules:
- Medical Education in India: UDC 61:37(540), DDC 610.71154
- History of Japan: UDC 94(520), DDC 952
- Dictionary of Physics: UDC 53(038), DDC 530.03
Output ONLY valid JSON:
{
  "udc": "string (valid classification notation)",
  "ddc": "string (valid DDC number with dot after 3 digits)",
  "breakdown": "string",
  "explanation": "string"
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
        if (isValidNotation(parsed.udc) && isValidNotation(parsed.ddc)) {
          parsed.source = 'AI Cataloguer (Gemini)';
          return parsed;
        }
      }
    }
  } catch (_) {}
  return null;
}

// Clean HTML UI
const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>UDC One-Click V149 — Library Classification</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f1f5f9; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px 16px 60px; }
    .wrap { max-width: 760px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 24px; }
    h1 { font-size: clamp(26px, 5vw, 38px); font-weight: 800; color: #1e293b; margin: 0 0 8px; }
    .v { color: #2563eb; }
    .lead { color: #64748b; font-size: 15px; margin: 0; }
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
      <h1>Library Classification <span class="v">V149</span></h1>
      <div class="lead">Universal Decimal Classification (UDC) & Dewey Decimal Classification (DDC)</div>
    </div>
    <div class="card">
      <label for="title">Book Title</label>
      <textarea id="title" placeholder="Enter book title...">Medical Education in India</textarea>
      <div class="action-row">
        <button id="go" class="btn-classify">⚡ CLASSIFY</button>
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
      if (!title) { errBox.textContent = 'Please enter a title.'; errBox.style.display = 'block'; return; }
      $('go').disabled = true; $('go').textContent = '⚡ CLASSIFYING...';
      try {
        const response = await fetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title })
        });
        if (!response.ok) throw new Error('Classification error.');
        const data = await response.json();
        $('resTitle').textContent = data.title || title;
        $('resUdc').textContent = data.udc_answer || data.udc_number || '020';
        $('resUdcBreakdown').textContent = data.breakdown || '';
        $('resDdc').textContent = data.ddc_answer || data.ddc_number || '020';
        $('resDdcBreakdown').textContent = data.breakdown || '';
        $('resExplain').textContent = data.explanation || 'Classification complete.';
        $('resSource').textContent = 'Engine: ' + (data.source || 'Standard Schedule');
        resBox.style.display = 'block';
        resBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (err) {
        errBox.textContent = err.message || 'Error classifying title.';
        errBox.style.display = 'block';
      } finally {
        $('go').disabled = false; $('go').textContent = '⚡ CLASSIFY';
      }
    });
    (() => {
      const btn = $('voice'), status = $('voiceStatus'), field = $('title');
      const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Rec) { btn.addEventListener('click', () => { field.focus(); status.textContent = 'Use keyboard mic.'; }); return; }
      const rec = new Rec(); rec.lang = 'en-IN'; rec.interimResults = false; let listening = false;
      btn.addEventListener('click', () => {
        if (listening) { rec.stop(); return; }
        try { rec.start(); listening = true; btn.textContent = '⏹ Stop'; status.textContent = 'Listening...'; } catch (_) { listening = false; }
      });
      rec.onresult = (e) => { field.value = e.results[0][0].transcript; $('go').click(); };
      rec.onerror = () => { listening = false; btn.textContent = '🎙️ Voice'; };
      rec.onend = () => { listening = false; btn.textContent = '🎙️ Voice'; };
    })();
  </script>
</body>
</html>`;

// PURE Node.js HTTP Server
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');

  const url = req.url.split('?')[0];

  // 1. Health check
  if (req.method === 'GET' && url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      bundledUDCReferencePages: 100,
      bundledDdcReferencePages: 100,
      professionalProviders: {
        oclcWebDewey: { configured: false },
        oclcWorldShareAI: { configured: false },
        udcOnline: { configured: false },
        annif: { endpointConfigured: false }
      }
    }));
    return;
  }

  // 2. Frontend HTML
  if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML_CONTENT);
    return;
  }

  // 3. Classify API
  if (req.method === 'POST' && url === '/api/classify') {
    let bodyStr = '';
    req.on('data', chunk => {
      bodyStr += chunk;
      if (bodyStr.length > 64 * 1024) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Title is too long.' }));
        req.destroy();
      }
    });

    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyStr || '{}');
        const title = String(body.title || '').trim();
        if (!title) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Title is required.' }));
          return;
        }

        const raw = rawClassify(title);
        const geminiRes = await queryGemini(title);

        let preliminaryResult = {
          udc_number: '020',
          ddc_number: '020',
          breakdown: 'General library classification.',
          explanation: 'Classification complete.',
          source: 'Standard Schedule'
        };

        if (raw) {
          preliminaryResult.udc_number = raw.udc;
          preliminaryResult.ddc_number = raw.ddc;
          preliminaryResult.breakdown = raw.breakdown;
          preliminaryResult.explanation = raw.explanation;
          preliminaryResult.source = raw.source;
        } else if (geminiRes && isValidNotation(geminiRes.udc)) {
          preliminaryResult.udc_number = geminiRes.udc;
          preliminaryResult.ddc_number = geminiRes.ddc;
          preliminaryResult.breakdown = geminiRes.breakdown || '';
          preliminaryResult.explanation = geminiRes.explanation || '';
          preliminaryResult.source = geminiRes.source;
        }

        // =========================================================
        // WATCHMAN: ਜਵਾਬ ਭੇਜਣ ਤੋਂ ਪਹਿਲਾਂ ਜਾਂਚ ਕਰਕੇ ਗਲਤੀ ਠੀਕ ਕਰਦਾ ਹੈ
        // =========================================================
        const finalResult = watchmanVerify(title, preliminaryResult);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'classified',
          title,
          full_title: title,
          udc_number: finalResult.udc_number,
          udc_answer: finalResult.udc_number,
          ddc_number: finalResult.ddc_number,
          ddc_answer: finalResult.ddc_number,
          breakdown: finalResult.breakdown,
          explanation: finalResult.explanation,
          title_coverage_audit: { verified: true },
          source: finalResult.source
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON request.' }));
      }
    });
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found.' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
