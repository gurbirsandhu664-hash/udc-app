const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const LIT_FORMS = [
  { term: "poetry", code: "-1", desc: "Poetry" },
  { term: "poems", code: "-1", desc: "Poetry" },
  { term: "drama", code: "-2", desc: "Drama. Plays" },
  { term: "plays", code: "-2", desc: "Drama. Plays" },
  { term: "theatre", code: "-2", desc: "Drama. Theatre" },
  { term: "fiction", code: "-3", desc: "Fiction. Novels" },
  { term: "novel", code: "-3", desc: "Novels" },
  { term: "novels", code: "-3", desc: "Novels" },
  { term: "short stories", code: "-32", desc: "Short stories" },
  { term: "essays", code: "-4", desc: "Essays" },
  { term: "oratory", code: "-5", desc: "Oratory" },
  { term: "letters", code: "-6", desc: "Letters" }
];

const LIT_LANGUAGES = [
  { term: "english", litCode: "820", langCode: "=20", desc: "English" },
  { term: "german", litCode: "830", langCode: "=30", desc: "German" },
  { term: "french", litCode: "840", langCode: "=40", desc: "French" },
  { term: "italian", litCode: "850", langCode: "=50", desc: "Italian" },
  { term: "spanish", litCode: "860", langCode: "=60", desc: "Spanish" },
  { term: "russian", litCode: "882", langCode: "=82", desc: "Russian" },
  { term: "sanskrit", litCode: "891.2", langCode: "=912", desc: "Sanskrit" },
  { term: "hindi", litCode: "891.43", langCode: "=914.3", desc: "Hindi" },
  { term: "punjabi", litCode: "891.42", langCode: "=914.2", desc: "Punjabi" },
  { term: "urdu", litCode: "891.431", langCode: "=914.31", desc: "Urdu" },
  { term: "persian", litCode: "891.5", langCode: "=915", desc: "Persian" },
  { term: "arabic", litCode: "892.7", langCode: "=927", desc: "Arabic" }
];

const MAIN_SCHEDULE = [
  { term: "bibliography", code: "01", desc: "Bibliography" },
  { term: "library science", code: "02", desc: "Librarianship. Libraries" },
  { term: "libraries", code: "02", desc: "Libraries" },
  { term: "encyclopaedia", code: "03", desc: "General encyclopaedias" },
  { term: "encyclopedia", code: "03", desc: "General encyclopaedias" },
  { term: "periodicals", code: "05", desc: "Periodicals" },
  { term: "journalism", code: "07", desc: "Newspapers. Journalism" },
  { term: "cybernetics", code: "007", desc: "Cybernetics. Information theory" },
  { term: "philosophy", code: "1", desc: "Philosophy" },
  { term: "child psychology", code: "159.922.7", desc: "Child psychology" },
  { term: "psychology", code: "159.9", desc: "Psychology" },
  { term: "logic", code: "16", desc: "Logic" },
  { term: "ethics", code: "17", desc: "Ethics. Moral science" },
  { term: "religion", code: "2", desc: "Religion. Theology" },
  { term: "bible", code: "22", desc: "The Bible" },
  { term: "christianity", code: "22/28", desc: "Christianity" },
  { term: "sikhism", code: "294.3", desc: "Sikhism" },
  { term: "buddhism", code: "294.3", desc: "Buddhism" },
  { term: "hinduism", code: "294.51", desc: "Hinduism" },
  { term: "islam", code: "297", desc: "Islam" },
  { term: "sociology", code: "301", desc: "Sociology" },
  { term: "statistics", code: "31", desc: "Statistics" },
  { term: "political science", code: "32", desc: "Political science" },
  { term: "politics", code: "32", desc: "Politics" },
  { term: "international relations", code: "327", desc: "International relations" },
  { term: "economics", code: "33", desc: "Economics" },
  { term: "banking", code: "332.1", desc: "Banking" },
  { term: "taxation", code: "336.2", desc: "Taxation" },
  { term: "labor", code: "331", desc: "Labour. Work" },
  { term: "labour", code: "331", desc: "Labour. Work" },
  { term: "law", code: "34", desc: "Law. Jurisprudence" },
  { term: "international law", code: "341", desc: "International law" },
  { term: "criminal law", code: "343", desc: "Criminal law" },
  { term: "public administration", code: "35", desc: "Public administration" },
  { term: "higher education", code: "378", desc: "Higher education. Universities" },
  { term: "universities", code: "378", desc: "Higher education. Universities" },
  { term: "colleges", code: "378", desc: "Colleges" },
  { term: "teaching methods", code: "371.3", desc: "Teaching methods" },
  { term: "secondary education", code: "373", desc: "Secondary education" },
  { term: "primary education", code: "372", desc: "Primary education" },
  { term: "elementary education", code: "372", desc: "Elementary education" },
  { term: "education", code: "37", desc: "Education. Teaching" },
  { term: "commerce", code: "38", desc: "Commerce. Trade" },
  { term: "mathematics", code: "51", desc: "Mathematics" },
  { term: "algebra", code: "512", desc: "Algebra" },
  { term: "geometry", code: "513", desc: "Geometry" },
  { term: "calculus", code: "517", desc: "Analysis. Calculus" },
  { term: "astronomy", code: "52", desc: "Astronomy" },
  { term: "physics", code: "53", desc: "Physics" },
  { term: "mechanics", code: "531", desc: "Mechanics" },
  { term: "optics", code: "535", desc: "Optics. Light" },
  { term: "thermodynamics", code: "536", desc: "Heat. Thermodynamics" },
  { term: "electricity", code: "537", desc: "Electricity" },
  { term: "chemistry", code: "54", desc: "Chemistry" },
  { term: "organic chemistry", code: "547", desc: "Organic chemistry" },
  { term: "inorganic chemistry", code: "546", desc: "Inorganic chemistry" },
  { term: "geology", code: "55", desc: "Geology. Earth sciences" },
  { term: "meteorology", code: "551.5", desc: "Meteorology" },
  { term: "biology", code: "57", desc: "Biological sciences" },
  { term: "botany", code: "58", desc: "Botany" },
  { term: "zoology", code: "59", desc: "Zoology" },
  { term: "medicine", code: "61", desc: "Medical sciences" },
  { term: "anatomy", code: "611", desc: "Anatomy" },
  { term: "physiology", code: "612", desc: "Physiology" },
  { term: "public health", code: "614", desc: "Public health. Hygiene" },
  { term: "pharmacology", code: "615", desc: "Pharmacy. Therapeutics" },
  { term: "engineering", code: "62", desc: "Engineering" },
  { term: "mechanical engineering", code: "621", desc: "Mechanical engineering" },
  { term: "electrical engineering", code: "621.3", desc: "Electrical engineering" },
  { term: "electronics", code: "621.38", desc: "Electronics" },
  { term: "telecommunication", code: "621.39", desc: "Telecommunication" },
  { term: "computers", code: "681.14", desc: "Calculating mechanisms. Computers" },
  { term: "computer", code: "681.14", desc: "Calculating mechanisms. Computers" },
  { term: "data processing", code: "681.14", desc: "Data processing machines" },
  { term: "mining", code: "622", desc: "Mining" },
  { term: "civil engineering", code: "624", desc: "Civil engineering" },
  { term: "agriculture", code: "63", desc: "Agriculture. Farming" },
  { term: "forestry", code: "634.0", desc: "Forestry" },
  { term: "horticulture", code: "635", desc: "Horticulture" },
  { term: "management", code: "65.01", desc: "Business management" },
  { term: "accounting", code: "657", desc: "Accountancy" },
  { term: "chemical engineering", code: "66", desc: "Chemical technology" },
  { term: "metallurgy", code: "669", desc: "Metallurgy" },
  { term: "architecture", code: "72", desc: "Architecture" },
  { term: "sculpture", code: "73", desc: "Sculpture" },
  { term: "painting", code: "75", desc: "Painting" },
  { term: "photography", code: "77", desc: "Photography" },
  { term: "music", code: "78", desc: "Music" },
  { term: "sports", code: "796", desc: "Sport. Games" },
  { term: "linguistics", code: "80", desc: "Linguistics. Languages" },
  { term: "literature", code: "82", desc: "Literature in general" },
  { term: "geography", code: "91", desc: "Geography" },
  { term: "history", code: "93/99", desc: "History" }
];

const AUXILIARIES = [
  { term: "punjab", code: "(540.23)", type: "place", desc: "Punjab" },
  { term: "india", code: "(540)", type: "place", desc: "India" },
  { term: "great britain", code: "(410)", type: "place", desc: "Great Britain" },
  { term: "united kingdom", code: "(410)", type: "place", desc: "United Kingdom" },
  { term: "uk", code: "(410)", type: "place", desc: "UK" },
  { term: "england", code: "(420)", type: "place", desc: "England" },
  { term: "france", code: "(44)", type: "place", desc: "France" },
  { term: "germany", code: "(430)", type: "place", desc: "Germany" },
  { term: "usa", code: "(73)", type: "place", desc: "United States" },
  { term: "united states", code: "(73)", type: "place", desc: "United States" },
  { term: "america", code: "(73)", type: "place", desc: "America" },
  { term: "russia", code: "(47)", type: "place", desc: "Russia" },
  { term: "japan", code: "(520)", type: "place", desc: "Japan" },
  { term: "china", code: "(510)", type: "place", desc: "China" },
  { term: "women", code: "-055.2", type: "person", desc: "Women" },
  { term: "female", code: "-055.2", type: "person", desc: "Female persons" },
  { term: "men", code: "-055.1", type: "person", desc: "Men" },
  { term: "children", code: "-053.2", type: "person", desc: "Children" },
  { term: "youth", code: "-053.6", type: "person", desc: "Youth" },
  { term: "students", code: "-057.87", type: "person", desc: "Students" },
  { term: "research", code: ".001.5", type: "view", desc: "Scientific research" },
  { term: "theory", code: ".001", type: "view", desc: "Theoretical view" },
  { term: "dictionary", code: "(038)", type: "form", desc: "Dictionary" },
  { term: "encyclopedia", code: "(031)", type: "form", desc: "Encyclopedia" },
  { term: "handbook", code: "(035)", type: "form", desc: "Handbook" }
];

function classifyUDC(rawTitle) {
  let title = rawTitle.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  let matchedLang = null;
  let matchedLitForm = null;

  for (let i = 0; i < LIT_LANGUAGES.length; i++) {
    let l = LIT_LANGUAGES[i];
    let reg = new RegExp("\\b" + l.term + "\\b", "i");
    if (reg.test(title)) {
      matchedLang = l;
      break;
    }
  }

  for (let i = 0; i < LIT_FORMS.length; i++) {
    let f = LIT_FORMS[i];
    let reg = new RegExp("\\b" + f.term + "\\b", "i");
    if (reg.test(title)) {
      matchedLitForm = f;
      break;
    }
  }

  if (matchedLang && matchedLitForm) {
    return {
      code: matchedLang.litCode + matchedLitForm.code,
      description: matchedLang.desc + " " + matchedLitForm.desc,
      standard: "UDC BS 1000A:1961"
    };
  } else if (matchedLang && title.indexOf("literature") !== -1) {
    return {
      code: matchedLang.litCode,
      description: matchedLang.desc + " Literature",
      standard: "UDC BS 1000A:1961"
    };
  } else if (matchedLang && (title.indexOf("language") !== -1 || title.indexOf("grammar") !== -1)) {
    return {
      code: "80" + matchedLang.langCode.replace("=", ""),
      description: matchedLang.desc + " Language",
      standard: "UDC BS 1000A:1961"
    };
  }

  let matchedAux = [];
  let tempText = title;

  for (let i = 0; i < AUXILIARIES.length; i++) {
    let aux = AUXILIARIES[i];
    let reg = new RegExp("\\b" + aux.term + "\\b", "i");
    if (reg.test(tempText)) {
      matchedAux.push(aux);
      tempText = tempText.replace(reg, " ");
    }
  }

  let sortedMain = MAIN_SCHEDULE.slice().sort(function(a, b) {
    return b.term.length - a.term.length;
  });
  let matchedBases = [];

  for (let i = 0; i < sortedMain.length; i++) {
    let item = sortedMain[i];
    let reg = new RegExp("\\b" + item.term + "\\b", "i");
    if (reg.test(tempText)) {
      let found = false;
      for (let j = 0; j < matchedBases.length; j++) {
        if (matchedBases[j].code === item.code) {
          found = true;
          break;
        }
      }
      if (!found) {
        matchedBases.push(item);
      }
      tempText = tempText.replace(reg, " ");
    }
  }

  if (matchedBases.length >= 2) {
    let codes = [];
    let descs = [];
    for (let i = 0; i < matchedBases.length; i++) {
      codes.push(matchedBases[i].code);
      descs.push(matchedBases[i].desc);
    }
    return {
      code: codes.join(":"),
      description: descs.join(" in relation to "),
      standard: "UDC BS 1000A:1961"
    };
  }

  if (matchedBases.length === 1) {
    let finalCode = matchedBases[0].code;
    let finalDesc = matchedBases[0].desc;

    for (let i = 0; i < matchedAux.length; i++) {
      finalCode += matchedAux[i].code;
      finalDesc += " - " + matchedAux[i].desc;
    }

    return {
      code: finalCode,
      description: finalDesc,
      standard: "UDC BS 1000A:1961"
    };
  }

  return {
    code: "001",
    description: "Science and knowledge in general",
    standard: "Fallback classification"
  };
}

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Universal UDC Classifier (BS 1000A:1961)</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #f3f4f6; margin: 0; padding: 40px 15px; text-align: center; }
        .box { max-width: 600px; margin: auto; background: white; padding: 35px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }
        h2 { color: #1f2937; margin-top: 0; }
        p { color: #6b7280; font-size: 15px; margin-bottom: 25px; }
        input { width: 75%; padding: 12px; font-size: 16px; border: 1.5px solid #d1d5db; border-radius: 6px; outline: none; }
        input:focus { border-color: #2563eb; }
        button { padding: 12px 22px; font-size: 16px; background: #2563eb; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }
        button:hover { background: #1d4ed8; }
        .res { display: none; margin-top: 25px; padding: 20px; background: #f9fafb; border: 1.5px solid #e5e7eb; border-left: 5px solid #2563eb; border-radius: 8px; text-align: left; }
        .code { font-size: 26px; font-weight: bold; color: #1e40af; font-family: monospace; }
        .desc { font-size: 16px; color: #374151; margin-top: 6px; }
      </style>
    </head>
    <body>
      <div class="box">
        <h2>UDC Classifier (BS 1000A:1961)</h2>
        <p>Supports all arbitrary subjects, colon relation (:), and literature forms</p>
        <input type="text" id="subject" placeholder="e.g. English drama, Higher education and computers">
        <button onclick="run()">Classify</button>
        <div id="resBox" class="res">
          <div><strong>UDC Code:</strong> <span id="outCode" class="code"></span></div>
          <div class="desc"><strong>Description:</strong> <span id="outDesc"></span></div>
          <div style="font-size: 13px; color: #9ca3af; margin-top: 8px;" id="outStd"></div>
        </div>
      </div>
      <script>
        async function run() {
          const val = document.getElementById('subject').value;
          if(!val.trim()) return;
          const r = await fetch('/api/classify', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({title: val})
          });
          const d = await r.json();
          document.getElementById('resBox').style.display = 'block';
          document.getElementById('outCode').innerText = d.code;
          document.getElementById('outDesc').innerText = d.description;
          document.getElementById('outStd').innerText = d.standard;
        }
      </script>
    </body>
    </html>
  `);
});

app.post('/api/classify', (req, res) => {
  const title = req.body.title || "";
  if (!title.trim()) {
    return res.status(400).json({ error: "Title is required" });
  }
  const result = classifyUDC(title);
  return res.json({
    title: title,
    code: result.code,
    description: result.description,
    standard: result.standard
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log("UDC Engine live on port " + PORT);
});
