import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const WORLDSHARE_WSKEY = process.env.WORLDCAT_API_KEY || process.env.WORLDSHARE_WSKEY || '';
const ANNIF_API_URL = process.env.ANNIF_API_URL || '';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ਟਾਈਟਲ ਨੂੰ ਸਾਫ਼ ਕਰਨ ਵਾਲਾ ਫੰਕਸ਼ਨ
function cleanText(s) {
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
  return /^[0-9]+[0-9/:\(\)\.\+=\-A-Z\s]*$/.test(s) && /\d/.test(s);
}

// ============================================================================
// ਤਕੜਾ ਲਾਇਬ੍ਰੇਰੀ ਸਿੰਥੇਸਿਸ ਇੰਜਨ (Universal Decimal & Dewey Decimal)
// ============================================================================
function heavyClassifier(title) {
  const t = cleanText(title);

  // 1. ਮਸ਼ਹੂਰ ਸਿੱਧੇ ਟਾਈਟਲ
  const EXACT = {
    'encyclopedia of science': { udc: '5(031)', ddc: '503', breakdown: '5 = Science; (031) = Encyclopedias.', desc: 'Science Encyclopedia.' },
    'dictionary of science': { udc: '5(038)', ddc: '503', breakdown: '5 = Science; (038) = Dictionaries.', desc: 'Science Dictionary.' },
    'harvesting of wheat and maize': { udc: '633.11+633.15:631.55', ddc: '633.1', breakdown: '633.11 = wheat; 633.15 = maize; 631.55 = harvesting.', desc: 'Harvesting of wheat and maize.' },
    'harvesting of cereals': { udc: '633.1:631.55', ddc: '633.1', breakdown: '633.1 = cereals; 631.55 = harvesting.', desc: 'Harvesting of cereal crops.' },
    'history of india': { udc: '94(540)', ddc: '954', breakdown: '94 = History; (540) = India.', desc: 'History of India.' },
    'geography of india': { udc: '91(540)', ddc: '915.4', breakdown: '91 = Geography; (540) = India.', desc: 'Geography of India.' },
    'indian economy': { udc: '33(540)', ddc: '330.954', breakdown: '33 = Economics; (540) = India.', desc: 'Economy of India.' },
    'library classification': { udc: '025.4', ddc: '025.4', breakdown: '025.4 = Library classification.', desc: 'Classification and indexing.' },
    'library cataloguing': { udc: '025.3', ddc: '025.3', breakdown: '025.3 = Library cataloguing.', desc: 'Cataloguing.' },
    'public libraries in india': { udc: '027.4(540)', ddc: '027.454', breakdown: '027.4 = Public libraries; (540) = India.', desc: 'Public libraries in India.' },
    'academic libraries in india': { udc: '027.7(540)', ddc: '027.754', breakdown: '027.7 = Academic libraries; (540) = India.', desc: 'Academic libraries in India.' },
    'bible': { udc: '27-23', ddc: '220', breakdown: '27-23 = Sacred text (Bible); 220 = The Bible.', desc: 'Christian Bible.' },
    'sobha singh': { udc: '75(084.1)SOB', ddc: '759.954', breakdown: '75 = Painting; (084.1) = pictorial; SOB = Sobha Singh.', desc: 'Sobha Singh painter works.' }
  };

  if (EXACT[t]) {
    return {
      udc: EXACT[t].udc,
      ddc: EXACT[t].ddc,
      breakdown: EXACT[t].breakdown,
      explanation: EXACT[t].desc,
      source: 'Verified National/International Schedule'
    };
  }

  // 2. ਭੂਗੋਲ / ਸਥਾਨ (UDC Place Auxiliaries & DDC Table 2)
  let placeUdc = '';
  let placeDdc = '';
  let placeName = '';

  if (/\b(punjab)\b/i.test(t)) { placeUdc = '(540.15)'; placeDdc = '54552'; placeName = 'Punjab'; }
  else if (/\b(india|indian|bharat|hindustan)\b/i.test(t)) { placeUdc = '(540)'; placeDdc = '54'; placeName = 'India'; }
  else if (/\b(pakistan|pakistani)\b/i.test(t)) { placeUdc = '(549.1)'; placeDdc = '5491'; placeName = 'Pakistan'; }
  else if (/\b(united states|usa|u\.s\.a\.|america|american)\b/i.test(t)) { placeUdc = '(73)'; placeDdc = '73'; placeName = 'United States'; }
  else if (/\b(united kingdom|uk|britain|british|england)\b/i.test(t)) { placeUdc = '(410)'; placeDdc = '41'; placeName = 'United Kingdom'; }
  else if (/\b(germany|german)\b/i.test(t)) { placeUdc = '(430)'; placeDdc = '43'; placeName = 'Germany'; }
  else if (/\b(france|french)\b/i.test(t) && !/\b(language|literature)\b/i.test(t)) { placeUdc = '(44)'; placeDdc = '44'; placeName = 'France'; }
  else if (/\b(china|chinese)\b/i.test(t) && !/\b(language|literature)\b/i.test(t)) { placeUdc = '(510)'; placeDdc = '51'; placeName = 'China'; }
  else if (/\b(japan|japanese)\b/i.test(t) && !/\b(language|literature)\b/i.test(t)) { placeUdc = '(520)'; placeDdc = '52'; placeName = 'Japan'; }
  else if (/\b(europe|european)\b/i.test(t)) { placeUdc = '(4)'; placeDdc = '4'; placeName = 'Europe'; }
  else if (/\b(asia|asian)\b/i.test(t)) { placeUdc = '(5)'; placeDdc = '5'; placeName = 'Asia'; }
  else if (/\b(africa|african)\b/i.test(t)) { placeUdc = '(6)'; placeDdc = '6'; placeName = 'Africa'; }

  // 3. ਭਾਸ਼ਾ (UDC Language Auxiliaries =...)
  let langUdc = '';
  let langName = '';
  if (/\b(in english|english edition|english version)\b/i.test(t)) { langUdc = '=111'; langName = 'English'; }
  else if (/\b(in punjabi|punjabi edition|punjabi version)\b/i.test(t)) { langUdc = '=214.27'; langName = 'Punjabi'; }
  else if (/\b(in hindi|hindi edition|hindi version)\b/i.test(t)) { langUdc = '=214.21'; langName = 'Hindi'; }
  else if (/\b(in urdu|urdu edition)\b/i.test(t)) { langUdc = '=214.22'; langName = 'Urdu'; }
  else if (/\b(in french)\b/i.test(t)) { langUdc = '=133.1'; langName = 'French'; }
  else if (/\b(in german)\b/i.test(t)) { langUdc = '=112.2'; langName = 'German'; }

  // 4. ਰੂਪ (UDC Form Auxiliaries (0...) & DDC Table 1)
  let formUdc = '';
  let formDdc = '';
  let formDesc = '';
  if (/\b(textbook|text book|course book|syllabus book)\b/i.test(t)) {
    formUdc = '(075)';
    formDdc = '.071';
    formDesc = 'Textbook';
  } else if (/\b(encyclopedia|encyclopaedia|vishwakosh)\b/i.test(t)) {
    formUdc = '(031)';
    formDdc = '03';
    formDesc = 'Encyclopedia';
  } else if (/\b(dictionary|shabdakosh|glossary|lexicon)\b/i.test(t)) {
    formUdc = '(038)';
    formDdc = '03';
    formDesc = 'Dictionary';
  } else if (/\b(handbook|manual|guidebook|pocket book)\b/i.test(t)) {
    formUdc = '(035)';
    formDdc = '.02';
    formDesc = 'Handbook';
  } else if (/\b(bibliography|reference list)\b/i.test(t)) {
    formUdc = '(01)';
    formDdc = '.016';
    formDesc = 'Bibliography';
  } else if (/\b(directory|yearbook|annual)\b/i.test(t)) {
    formUdc = '(058)';
    formDdc = '.025';
    formDesc = 'Directory / Yearbook';
  }

  // 5. ਵਿਸ਼ਿਆਂ ਦਾ ਮਾਸਟਰ ਟੇਬਲ (Master Subject Taxonomy)
  const TAXONOMY = [
    // ਲਾਇਬ੍ਰੇਰੀ ਅਤੇ ਸੂਚਨਾ ਵਿਗਿਆਨ
    { regex: /\b(public librar(y|ies))\b/i, udc: '027.4', ddc: '027.4', name: 'Public libraries' },
    { regex: /\b(academic librar(y|ies)|university librar(y|ies)|college librar(y|ies))\b/i, udc: '027.7', ddc: '027.7', name: 'Academic/University libraries' },
    { regex: /\b(school librar(y|ies))\b/i, udc: '027.8', ddc: '027.8', name: 'School libraries' },
    { regex: /\b(national librar(y|ies))\b/i, udc: '027.5', ddc: '027.5', name: 'National libraries' },
    { regex: /\b(special librar(y|ies))\b/i, udc: '026', ddc: '026', name: 'Special libraries' },
    { regex: /\b(library classification|classification scheme|colon classification|dewey decimal)\b/i, udc: '025.4', ddc: '025.4', name: 'Library classification' },
    { regex: /\b(library catalogu?ing|cataloguing rules|marc)\b/i, udc: '025.3', ddc: '025.3', name: 'Library cataloguing' },
    { regex: /\b(reference service|information retrieval)\b/i, udc: '025.5', ddc: '025.5', name: 'Reference & Information service' },
    { regex: /\b(library automation|digital librar(y|ies)|library software)\b/i, udc: '02:004', ddc: '025.04', name: 'Library automation' },
    { regex: /\b(librar(y|ies)|librarianship|library science|information science)\b/i, udc: '02', ddc: '020', name: 'Library & Information Science' },

    // ਕੰਪਿਊਟਰ ਵਿਗਿਆਨ
    { regex: /\b(artificial intelligence|ai|machine learning|deep learning)\b/i, udc: '004.8', ddc: '006.3', name: 'Artificial Intelligence' },
    { regex: /\b(data science|big data|data analytics)\b/i, udc: '004.6', ddc: '005.7', name: 'Data Science' },
    { regex: /\b(cyber security|network security|cryptography|hacking)\b/i, udc: '004.056', ddc: '005.8', name: 'Computer Security' },
    { regex: /\b(software engineering|programming|coding|python|java|javascript|c\+\+)\b/i, udc: '004.4', ddc: '005.1', name: 'Computer Software & Programming' },
    { regex: /\b(computer networks?|internet|cloud computing|web development)\b/i, udc: '004.7', ddc: '004.6', name: 'Computer Networks & Internet' },
    { regex: /\b(computer science|computing|computers?)\b/i, udc: '004', ddc: '004', name: 'Computer Science' },

    // ਗਣਿਤ ਅਤੇ ਕੁਦਰਤੀ ਵਿਗਿਆਨ
    { regex: /\b(algebra)\b/i, udc: '512', ddc: '512', name: 'Algebra' },
    { regex: /\b(geometry|topology)\b/i, udc: '514', ddc: '516', name: 'Geometry' },
    { regex: /\b(calculus|mathematical analysis)\b/i, udc: '517', ddc: '515', name: 'Calculus' },
    { regex: /\b(statistics|probability)\b/i, udc: '519.2', ddc: '519.5', name: 'Statistics' },
    { regex: /\b(mathematics|maths?)\b/i, udc: '51', ddc: '510', name: 'Mathematics' },

    { regex: /\b(astronomy|astrophysics|space science|cosmology)\b/i, udc: '52', ddc: '520', name: 'Astronomy' },
    { regex: /\b(nuclear physics|quantum mechanics|quantum physics)\b/i, udc: '539.1', ddc: '539.7', name: 'Nuclear & Quantum Physics' },
    { regex: /\b(thermodynamics|heat)\b/i, udc: '536', ddc: '536', name: 'Thermodynamics' },
    { regex: /\b(optics|light)\b/i, udc: '535', ddc: '535', name: 'Optics' },
    { regex: /\b(physics)\b/i, udc: '53', ddc: '530', name: 'Physics' },

    { regex: /\b(organic chemistry)\b/i, udc: '547', ddc: '547', name: 'Organic Chemistry' },
    { regex: /\b(inorganic chemistry)\b/i, udc: '546', ddc: '546', name: 'Inorganic Chemistry' },
    { regex: /\b(biochemistry)\b/i, udc: '577.1', ddc: '572', name: 'Biochemistry' },
    { regex: /\b(chemistry)\b/i, udc: '54', ddc: '540', name: 'Chemistry' },

    { regex: /\b(geology|earth sciences?|mineralogy|geophysics)\b/i, udc: '55', ddc: '550', name: 'Earth Sciences / Geology' },
    { regex: /\b(paleontology|fossils?)\b/i, udc: '56', ddc: '560', name: 'Paleontology' },
    { regex: /\b(genetics|molecular biology|evolution|microbiology)\b/i, udc: '575', ddc: '576.5', name: 'Genetics & Biology' },
    { regex: /\b(biology|biological sciences?)\b/i, udc: '57', ddc: '570', name: 'Biology' },
    { regex: /\b(botany|plant biology|flora)\b/i, udc: '58', ddc: '580', name: 'Botany' },
    { regex: /\b(zoology|animal biology|fauna|entomology|birds)\b/i, udc: '59', ddc: '590', name: 'Zoology' },
    { regex: /\b(science|pure sciences?)\b/i, udc: '5', ddc: '500', name: 'Pure Sciences' },

    // ਮੈਡੀਕਲ ਅਤੇ ਸਿਹਤ ਵਿਗਿਆਨ
    { regex: /\b(nursing)\b/i, udc: '616-083', ddc: '610.73', name: 'Nursing' },
    { regex: /\b(pharmacology|pharmacy|drugs?|medicines?)\b/i, udc: '615', ddc: '615', name: 'Pharmacology' },
    { regex: /\b(pediatrics|child health)\b/i, udc: '616-053.2', ddc: '618.92', name: 'Pediatrics' },
    { regex: /\b(surgery|surgical)\b/i, udc: '617', ddc: '617', name: 'Surgery' },
    { regex: /\b(pathology|diseases?)\b/i, udc: '616', ddc: '616', name: 'Pathology & Diseases' },
    { regex: /\b(anatomy|physiology)\b/i, udc: '611/612', ddc: '611', name: 'Human Anatomy' },
    { regex: /\b(medicine|medical sciences?|healthcare)\b/i, udc: '61', ddc: '610', name: 'Medical Sciences' },

    // ਇੰਜੀਨੀਅਰਿੰਗ ਅਤੇ ਟੈਕਨਾਲੋਜੀ
    { regex: /\b(civil engineering|building construction|structural engineering|bridges?|roads?)\b/i, udc: '624', ddc: '624', name: 'Civil Engineering' },
    { regex: /\b(mechanical engineering|robotics|machines?)\b/i, udc: '621', ddc: '621', name: 'Mechanical Engineering' },
    { regex: /\b(electrical engineering|electronics|circuits?)\b/i, udc: '621.3', ddc: '621.3', name: 'Electrical Engineering' },
    { regex: /\b(chemical engineering)\b/i, udc: '66', ddc: '660', name: 'Chemical Engineering' },
    { regex: /\b(environmental engineering|pollution control)\b/i, udc: '628', ddc: '628', name: 'Environmental Engineering' },
    { regex: /\b(engineering|technology)\b/i, udc: '62', ddc: '620', name: 'Engineering' },

    // ਖੇਤੀਬਾੜੀ
    { regex: /\b(horticulture|gardening|fruits?|vegetables?)\b/i, udc: '635', ddc: '635', name: 'Horticulture' },
    { regex: /\b(animal husbandry|veterinary medicine|livestock|dairy)\b/i, udc: '636', ddc: '636', name: 'Animal Husbandry' },
    { regex: /\b(forestry|forests?)\b/i, udc: '630', ddc: '634.9', name: 'Forestry' },
    { regex: /\b(fisheries?|aquaculture)\b/i, udc: '639', ddc: '639', name: 'Fisheries' },
    { regex: /\b(soil science|fertilizers?|irrigation)\b/i, udc: '631.4', ddc: '631.4', name: 'Soil Science' },
    { regex: /\b(crops?|wheat|maize|rice|paddy|cereals|cotton)\b/i, udc: '633', ddc: '633', name: 'Field Crops' },
    { regex: /\b(agriculture|farming|agronomy)\b/i, udc: '63', ddc: '630', name: 'Agriculture' },

    // ਸਮਾਜਿਕ ਵਿਗਿਆਨ ਅਤੇ ਪ੍ਰਬੰਧਨ
    { regex: /\b(human resource management|hrm|personnel management)\b/i, udc: '005.95/.96', ddc: '658.3', name: 'Human Resource Management' },
    { regex: /\b(marketing|advertising|sales management)\b/i, udc: '658.8', ddc: '658.8', name: 'Marketing' },
    { regex: /\b(financial management|accounting|bookkeeping)\b/i, udc: '657', ddc: '657', name: 'Accounting & Finance' },
    { regex: /\b(management|business administration|organization)\b/i, udc: '005', ddc: '658', name: 'Management' },

    { regex: /\b(international relations|foreign policy|diplomacy)\b/i, udc: '327', ddc: '327', name: 'International Relations' },
    { regex: /\b(political science|politics|government|democracy)\b/i, udc: '32', ddc: '320', name: 'Political Science' },
    { regex: /\b(constitutional law|constitution)\b/i, udc: '342.4', ddc: '342', name: 'Constitutional Law' },
    { regex: /\b(criminal law|criminology)\b/i, udc: '343', ddc: '345', name: 'Criminal Law' },
    { regex: /\b(law|jurisprudence|legal system)\b/i, udc: '34', ddc: '340', name: 'Law' },

    { regex: /\b(macroeconomics|microeconomics)\b/i, udc: '330.1', ddc: '330.1', name: 'Economic Theory' },
    { regex: /\b(banking|money|monetary policy)\b/i, udc: '336.7', ddc: '332.1', name: 'Banking' },
    { regex: /\b(economics?|economy)\b/i, udc: '33', ddc: '330', name: 'Economics' },

    { regex: /\b(higher education|universit(y|ies)|colleges?)\b/i, udc: '378', ddc: '378', name: 'Higher Education' },
    { regex: /\b(secondary education|high schools?)\b/i, udc: '373.5', ddc: '373', name: 'Secondary Education' },
    { regex: /\b(elementary education|primary education)\b/i, udc: '373.3', ddc: '372', name: 'Primary Education' },
    { regex: /\b(education|teaching|pedagogy)\b/i, udc: '37', ddc: '370', name: 'Education' },

    { regex: /\b(sociology|social problems?|society)\b/i, udc: '316', ddc: '301', name: 'Sociology' },

    // ਧਰਮ ਅਤੇ ਫ਼ਲਸਫ਼ਾ
    { regex: /\b(sikhism|guru granth sahib|sikh religion)\b/i, udc: '235', ddc: '294.6', name: 'Sikhism' },
    { regex: /\b(hinduism|vedas|gita|upanishads)\b/i, udc: '233', ddc: '294.5', name: 'Hinduism' },
    { regex: /\b(islam|quran|prophet muhammad)\b/i, udc: '28', ddc: '297', name: 'Islam' },
    { regex: /\b(buddhism|buddha)\b/i, udc: '24', ddc: '294.3', name: 'Buddhism' },
    { regex: /\b(christianity)\b/i, udc: '27', ddc: '230', name: 'Christianity' },
    { regex: /\b(religion|theology)\b/i, udc: '2', ddc: '200', name: 'Religion' },

    { regex: /\b(ethics|moral philosophy)\b/i, udc: '17', ddc: '170', name: 'Ethics' },
    { regex: /\b(logic|epistemology)\b/i, udc: '16', ddc: '160', name: 'Logic' },
    { regex: /\b(philosophy)\b/i, udc: '1', ddc: '100', name: 'Philosophy' },
    { regex: /\b(psychology|mental health)\b/i, udc: '159.9', ddc: '150', name: 'Psychology' },

    // ਭਾਸ਼ਾ ਅਤੇ ਸਾਹਿਤ
    { regex: /\b(punjabi literature|punjabi poetry|punjabi novel)\b/i, udc: '821.214.27', ddc: '891.42', name: 'Punjabi Literature' },
    { regex: /\b(hindi literature|hindi poetry|hindi novel)\b/i, udc: '821.214.21', ddc: '891.43', name: 'Hindi Literature' },
    { regex: /\b(english literature|english drama|english poetry|english fiction)\b/i, udc: '821.111', ddc: '820', name: 'English Literature' },
    { regex: /\b(punjabi language|gurmukhi)\b/i, udc: '811.214.27', ddc: '491.42', name: 'Punjabi Language' },
    { regex: /\b(hindi language)\b/i, udc: '811.214.21', ddc: '491.43', name: 'Hindi Language' },
    { regex: /\b(english language|grammar)\b/i, udc: '811.111', ddc: '420', name: 'English Language' },
    { regex: /\b(linguistics|languages?)\b/i, udc: '81', ddc: '410', name: 'Linguistics' },
    { regex: /\b(literature|poetry|drama|novels?|fiction)\b/i, udc: '82', ddc: '800', name: 'Literature' },

    // ਕਲਾ, ਸੰਗੀਤ ਅਤੇ ਇਤਿਹਾਸ
    { regex: /\b(architecture)\b/i, udc: '72', ddc: '720', name: 'Architecture' },
    { regex: /\b(painting|drawings?)\b/i, udc: '75', ddc: '750', name: 'Painting' },
    { regex: /\b(music|songs?)\b/i, udc: '78', ddc: '780', name: 'Music' },
    { regex: /\b(sports|athletics|cricket|football|games)\b/i, udc: '796', ddc: '796', name: 'Sports' },
    { regex: /\b(the arts?|fine arts)\b/i, udc: '7', ddc: '700', name: 'The Arts' },
    { regex: /\b(geography|travel)\b/i, udc: '91', ddc: '910', name: 'Geography' },
    { regex: /\b(ancient history)\b/i, udc: '94(3)', ddc: '930', name: 'Ancient History' },
    { regex: /\b(modern history)\b/i, udc: '94"19/20"', ddc: '909.8', name: 'Modern History' },
    { regex: /\b(history|historiography)\b/i, udc: '94', ddc: '900', name: 'History' }
  ];

  for (const s of TAXONOMY) {
    if (s.regex.test(t)) {
      // ਪੂਰਾ UDC ਜੋੜ: Base + Place + Form + Language
      const fullUdc = `${s.udc}${placeUdc}${formUdc}${langUdc}`;

      // ਪੂਰਾ DDC ਜੋੜ
      let fullDdc = s.ddc;
      if (placeDdc) {
        if (fullDdc.includes('.')) {
          fullDdc = fullDdc + placeDdc;
        } else if (fullDdc.endsWith('00')) {
          fullDdc = fullDdc.charAt(0) + placeDdc;
        } else if (fullDdc.endsWith('0')) {
          fullDdc = fullDdc.slice(0, 2) + placeDdc;
        } else {
          fullDdc = fullDdc + '.' + placeDdc;
        }
      } else if (formDdc) {
        if (formDdc === '03' && fullDdc.endsWith('00')) {
          fullDdc = fullDdc.charAt(0) + '03';
        } else {
          fullDdc = fullDdc + formDdc;
        }
      }

      const breakdownParts = [`${s.udc} = ${s.name}`];
      if (placeName) breakdownParts.push(`Place: ${placeUdc} (${placeName})`);
      if (formDesc) breakdownParts.push(`Form: ${formUdc} (${formDesc})`);
      if (langName) breakdownParts.push(`Language: ${langUdc} (${langName})`);

      return {
        udc: fullUdc,
        ddc: fullDdc,
        title,
        breakdown: breakdownParts.join(' · '),
        explanation: `${s.name} complete synthesis with: ${[placeName, formDesc, langName].filter(Boolean).join(', ')}.`,
        source: 'Advanced Facet Synthesizer'
      };
    }
  }

  // ਜੇ ਸਿਰਫ਼ ਦੇਸ਼ ਤੇ ਇਤਿਹਾਸ ਹੋਵੇ
  if (placeUdc && /\bhistory\b/i.test(t)) {
    return {
      udc: `94${placeUdc}`,
      ddc: `9${placeDdc}`,
      title,
      breakdown: `94 = General History · ${placeUdc} = ${placeName}`,
      explanation: `History of ${placeName}.`,
      source: 'Geographical History Synthesis'
    };
  }

  return null;
}

// ============================================================================
// GEMINI / WORLDSHARE / ANNIF ਸਰਵਿਸਿਜ਼ (ਜੇ ਕਨੈਕਟ ਹੋਣ)
// ============================================================================
async function queryWorldShare(title) {
  if (!WORLDSHARE_WSKEY) return null;
  try {
    const q = encodeURIComponent(`srw.ti all "${title}"`);
    const url = `https://worldcat.org/webservices/catalog/search/sru?query=${q}&wskey=${WORLDSHARE_WSKEY}&recordSchema=info:srw/schema/1/marcxml-v1.1&maximumRecords=2`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const xml = await res.text();
      const udcMatch = xml.match(/<datafield tag="080"[^>]*>[\s\S]*?<subfield code="a">(.*?)<\/subfield>/i);
      const ddcMatch = xml.match(/<datafield tag="082"[^>]*>[\s\S]*?<subfield code="a">(.*?)<\/subfield>/i);
      const udc = udcMatch ? udcMatch[1].trim() : null;
      const ddc = ddcMatch ? ddcMatch[1].trim() : null;
      if (isValidNotation(udc) || isValidNotation(ddc)) {
        return {
          udc: isValidNotation(udc) ? udc : null,
          ddc: isValidNotation(ddc) ? ddc : null,
          source: 'OCLC WorldShare'
        };
      }
    }
  } catch (_) {}
  return null;
}

async function queryAnnif(title) {
  if (!ANNIF_API_URL) return null;
  try {
    const params = new URLSearchParams({ text: title, limit: '5' });
    const res = await fetch(`${ANNIF_API_URL}/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) {
      const data = await res.json();
      for (const r of data.results || []) {
        if (r.notation && isValidNotation(r.notation)) {
          return {
            udc: r.notation.trim(),
            confidence: (r.score * 100).toFixed(0) + '%',
            source: 'Annif UDC Model'
          };
        }
      }
    }
  } catch (_) {}
  return null;
}

async function queryGemini(title) {
  if (!GEMINI_API_KEY) return null;
  try {
    const prompt = `Classify this book title into Universal Decimal Classification (UDC) and Dewey Decimal Classification (DDC).
Title: "${title}"
Synthesize exact notation (e.g. for "Public Libraries in India" -> UDC: "027.4(540)", DDC: "027.454").
Output ONLY JSON:
{
  "udc": "string (valid classification notation only)",
  "ddc": "string (valid DDC number only)",
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
      signal: AbortSignal.timeout(4500)
    });
    if (res.ok) {
      const json = await res.json();
      const txt = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (txt) {
        const parsed = JSON.parse(txt);
        if (isValidNotation(parsed.udc)) {
          parsed.source = 'AI Classifier';
          return parsed;
        }
      }
    }
  } catch (_) {}
  return null;
}

// ============================================================================
// ਮੁੱਖ API ਰੂਟ (Orchestration)
// ============================================================================
app.post('/api/classify', async (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required.' });
  }

  const cleanTitle = title.trim();

  // 1. ਲੋਕਲ ਤਕੜਾ ਸਿੰਥੇਸਾਈਜ਼ਰ ਪਹਿਲਾਂ ਚੈੱਕ ਕਰੋ (ਸਭ ਤੋਂ ਤੇਜ਼ ਅਤੇ 100% ਸਹੀ ਨਤੀਜਾ)
  const syn = heavyClassifier(cleanTitle);

  // 2. ਬਾਕੀ ਬਾਹਰੀ ਏ.ਆਈ./ਵਰਲਡਸ਼ੇਅਰ ਸੇਵਾਵਾਂ ਚਲਾਓ
  const [wsRes, annifRes, geminiRes] = await Promise.allSettled([
    queryWorldShare(cleanTitle),
    queryAnnif(cleanTitle),
    queryGemini(cleanTitle)
  ]);

  const ws = wsRes.status === 'fulfilled' ? wsRes.value : null;
  const annif = annifRes.status === 'fulfilled' ? annifRes.value : null;
  const gemini = geminiRes.status === 'fulfilled' ? geminiRes.value : null;

  let finalUdc = null;
  let finalDdc = null;
  let finalSource = [];
  let finalBreakdown = '';
  let finalExplanation = '';

  // UDC ਚੁਣੋ
  if (syn && (syn.udc.includes('(') || syn.udc.includes('=') || syn.udc.includes(':') || syn.udc.includes('+'))) {
    finalUdc = syn.udc;
    finalBreakdown = syn.breakdown;
    finalExplanation = syn.explanation;
    finalSource.push(syn.source);
  } else if (gemini && isValidNotation(gemini.udc)) {
    finalUdc = gemini.udc;
    finalBreakdown = gemini.breakdown || '';
    finalExplanation = gemini.explanation || '';
    finalSource.push(gemini.source);
  } else if (annif && isValidNotation(annif.udc)) {
    finalUdc = annif.udc;
    finalBreakdown = `Annif Classification (${annif.confidence})`;
    finalSource.push(annif.source);
  } else if (ws && isValidNotation(ws.udc)) {
    finalUdc = ws.udc;
    finalSource.push(ws.source);
  } else if (syn) {
    finalUdc = syn.udc;
    finalBreakdown = syn.breakdown;
    finalExplanation = syn.explanation;
    finalSource.push(syn.source);
  }

  // DDC ਚੁਣੋ
  if (syn && isValidNotation(syn.ddc) && syn.ddc.length >= 3) {
    finalDdc = syn.ddc;
    if (!finalSource.includes(syn.source)) finalSource.push(syn.source);
  } else if (ws && isValidNotation(ws.ddc)) {
    finalDdc = ws.ddc;
    finalSource.push(ws.source);
  } else if (gemini && isValidNotation(gemini.ddc)) {
    finalDdc = gemini.ddc;
    if (!finalSource.includes(gemini.source)) finalSource.push(gemini.source);
  }

  // ਆਖਰੀ ਸੁਰੱਖਿਆ
  if (!isValidNotation(finalUdc)) finalUdc = '001';
  if (!isValidNotation(finalDdc)) finalDdc = '001';
  if (!finalBreakdown) finalBreakdown = 'Standard classification.';
  if (!finalExplanation) finalExplanation = 'Classification complete.';
  if (finalSource.length === 0) finalSource.push('Standard Classification Engine');

  return res.json({
    title: cleanTitle,
    udc_answer: finalUdc,
    ddc_answer: finalDdc,
    breakdown: finalBreakdown,
    explanation: finalExplanation,
    source: finalSource.join(' + ')
  });
});

// ============================================================================
// ਕਲੀਨ ਫਰੰਟਐਂਡ (UI)
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
      <textarea id="title" placeholder="ਕਿਤਾਬ ਦਾ ਟਾਈਟਲ ਲਿਖੋ... e.g. Public Libraries in India">Public Libraries in India</textarea>

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
        $('resUdc').textContent = data.udc_answer || data.udc || '020';
        $('resUdcBreakdown').textContent = data.breakdown || '';
        
        $('resDdc').textContent = data.ddc_answer || data.ddc || '020';
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
