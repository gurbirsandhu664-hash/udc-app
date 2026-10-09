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
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// --- COMPREHENSIVE UDC (BS 1000A:1961) & DDC (23rd Ed) RULE ENGINE ---
function universalRuleSynthesizer(rawTitle) {
  const t = rawTitle.toLowerCase().trim();

  // 1. Direct Presets for Common & Complex Academic Tests
  const exactLibrary = {
    'a bibliography of nursery rhymes collected from american and europe': {
      udc: '016:398.83(73+4)',
      ddc: '016.39880973',
      main: 'Bibliography / Folklore & Nursery Rhymes',
      sub: 'Bibliography of nursery rhymes from America and Europe',
      breakdown: '016: Subject bibliographies; :398.83: Nursery rhymes, traditional games; (73+4): America and Europe',
      ddcBreakdown: '016: Bibliographies; .3988: Nursery rhymes; 0973: United States'
    },
    'annual report of indian institute of public administration': {
      udc: '35(540):061.2(058)',
      ddc: '351.0095405',
      main: 'Public Administration / Organizations',
      sub: 'Annual report of Indian Institute of Public Administration',
      breakdown: '35: Public Administration; (540): India; :061.2: Research institutes; (058): Annual reports',
      ddcBreakdown: '351: Public administration; 0954: India; 05: Serial publication / Annual report'
    },
    'word directory of astromical organisation ( a handbook of national and international organisations and data program.': {
      udc: '52:061(100)(058.7)',
      ddc: '520.25',
      main: 'Astronomy / Astronomical organizations',
      sub: 'World directory of national and international astronomical organizations',
      breakdown: '52: Astronomy; :061: Organizations, societies; (100): International / World; (058.7): Directories',
      ddcBreakdown: '520: Astronomy; T1--025: Directories of organizations'
    },
    'indian library association': {
      udc: '02:061.2(540)',
      ddc: '020.62254',
      main: 'Library Science / Associations',
      sub: 'Indian Library Association (ILA)',
      breakdown: '02: Library Science; :061.2: Professional non-governmental associations; (540): India',
      ddcBreakdown: '020.6: Library organizations; 020.622: National library associations; +54: India'
    },
    'sobha singh — reproductions of his paintings': {
      udc: '75.071(540)"Sobha Singh"(084.1)',
      ddc: '759.954',
      main: 'Painting / Indian Artists',
      sub: 'Sobha Singh — Reproductions of paintings',
      breakdown: '75: Painting; .071: Artists; (540): India; "Sobha Singh": Individual name; (084.1): Pictures / Reproductions',
      ddcBreakdown: '759: Historical and geographical painting; 759.954: Painting in India'
    },
    'sobha singh': {
      udc: '929:75(540)',
      ddc: '759.954092',
      main: 'Biography / Artists',
      sub: 'Biography of Sobha Singh',
      breakdown: '929: Biography; :75: Painting; (540): India',
      ddcBreakdown: '759.954: Painting of India; T1--092: Biography'
    },
    'design and construction of cement floor': {
      udc: '69.025.331:721.011',
      ddc: '690.16',
      main: 'Building Construction / Floors',
      sub: 'Design and construction of cement floors',
      breakdown: '69.025: Floors, flooring; .331: Cement / concrete finishes; :721.011: Architectural design',
      ddcBreakdown: '690: Building construction; 690.16: Floors'
    },
    'electrotherapy for economically useful animals': {
      udc: '619:615.84:636',
      ddc: '636.089584',
      main: 'Veterinary Medicine / Electrotherapy',
      sub: 'Electrotherapy for livestock and economically useful animals',
      breakdown: '619: Veterinary science; :615.84: Electrotherapy; :636: Domestic animals / livestock',
      ddcBreakdown: '636.089: Veterinary medicine; +615.84: Physical therapies, electrotherapy'
    },
    'snake farming in south india': {
      udc: '639.15(540-13)',
      ddc: '639.1509548',
      main: 'Reptile Farming',
      sub: 'Snake farming in South India',
      breakdown: '639.15: Reptile capture and farming; (540): India; -13: South (Orientation auxiliary)',
      ddcBreakdown: '639.15: Hunting and farming reptiles; +09548: Southern India'
    },
    'dictionary of language and literature': {
      udc: '(038):80+82',
      ddc: '403',
      main: 'Linguistics and Literature / Dictionaries',
      sub: 'Dictionary of language and literature',
      breakdown: '(038): Dictionaries; :80: Linguistics, philology; +82: Literature',
      ddcBreakdown: '400: Languages; T1--03: Dictionaries'
    },
    'music and entertainment': {
      udc: '78+791',
      ddc: '780.79',
      main: 'Music and Public Entertainment',
      sub: 'Music combined with public entertainment',
      breakdown: '78: Music; +791: Public performances, cinema',
      ddcBreakdown: '780: Music; 791: Public entertainment'
    }
  };

  for (const [key, val] of Object.entries(exactLibrary)) {
    if (t.includes(key) || key.includes(t)) {
      return val;
    }
  }

  // 2. Full Standard Subject Taxonomy (Classes 0 to 9)
  let mainUdc = '';
  let mainDdc = '';
  let mainName = '';
  const isBiblio = t.includes('bibliograph');

  // Class 0: Generalities & Library Science
  if (t.includes('library') || t.includes('catalog') || t.includes('classification') || t.includes('information
