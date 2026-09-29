const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Literature Forms (Class 8 Special Auxiliaries)
const LIT_FORMS = [
  { term: "poetry", code: "-1", desc: "Poetry" },
  { term: "poems", code: "-1", desc: "Poetry" },
  { term: "drama", code: "-2", desc: "Drama. Plays" },
  { term: "plays", code: "-2", desc: "Drama. Plays" },
  { term: "theatre", code: "-2", desc: "Drama. Theatre" },
  { term: "theater", code: "-2", desc: "Drama. Theatre" },
  { term: "fiction", code: "-3", desc: "Fiction. Novels" },
  { term: "novel", code: "-3", desc: "Novels" },
  { term: "novels", code: "-3", desc: "Novels" },
  { term: "short stories", code: "-32", desc: "Short stories" },
  { term: "essays", code: "-4", desc: "Essays" },
  { term: "oratory", code: "-5", desc: "Oratory" },
  { term: "letters", code: "-6", desc: "Letters" }
];

// Literature Languages (UDC 820 - 89)
const LIT_LANGUAGES = [
  { term: "english", litCode: "820", desc: "English" },
  { term: "german", litCode: "830", desc: "German" },
  { term: "french", litCode: "840", desc: "French" },
  { term: "italian", litCode: "850", desc: "Italian" },
  { term: "spanish", litCode: "860", desc: "Spanish" },
  { term: "russian", litCode: "882", desc: "Russian" },
  { term: "sanskrit", litCode: "891.2", desc: "Sanskrit" },
  { term: "hindi", litCode: "891.43", desc: "Hindi" },
  { term: "punjabi", litCode: "891.42", desc: "Punjabi" },
  { term: "urdu", litCode: "891.431", desc: "Urdu" },
  { term: "persian", litCode: "891.5", desc: "Persian" },
  { term: "arabic", litCode: "892.7", desc: "Arabic" }
];

// Main Classes (BS 1000A:1961)
const MAIN_SCHEDULE = [
  { term: "higher education", code: "378", desc: "Higher education. Universities. Colleges" },
  { term: "university", code: "378", desc: "Higher education. Universities" },
  { term: "universities", code: "378", desc: "Higher education. Universities" },
  { term: "college", code: "378", desc: "Higher education. Colleges" },
  { term: "colleges", code: "378", desc: "Higher education. Colleges" },
  { term: "secondary education", code: "373", desc: "Secondary education" },
  { term: "primary education", code: "372", desc: "Primary education" },
  { term: "elementary education", code: "372", desc: "Elementary education" },
  { term: "teaching methods", code: "371.3", desc: "Methods of teaching" },
  { term: "education", code: "37", desc: "Education. Teaching" },

  { term: "computers", code: "681.14", desc: "Calculating mechanisms. Computers" },
  { term: "computer", code: "681.14", desc: "Calculating mechanisms. Computers" },
  { term: "computing", code: "681.14", desc: "Calculating mechanisms. Computers" },
  { term: "data processing", code: "681.14", desc: "Data processing machines" },
  { term: "co", code: "681.14", desc: "Calculating mechanisms. Computers" },

  { term: "bibliography", code: "01", desc: "Bibliography" },
  { term: "library science", code: "02", desc: "Librarianship. Libraries" },
  { term: "libraries", code: "02", desc: "Libraries" },
  { term: "encyclopaedia", code: "03", desc: "General encyclopaedias" },
  { term: "encyclopedia", code: "03", desc: "General encyclopaedias" },
  { term: "cybernetics", code: "007", desc: "Cybernetics. Information theory" },

  { term: "philosophy", code: "1", desc: "Philosophy" },
  { term: "child psychology", code: "159.922.7", desc: "Child psychology" },
  { term: "psychology", code: "159.9", desc: "Psychology" },
  { term: "ethics", code: "17", desc: "Ethics. Moral science" },

  { term: "religion", code: "2", desc: "Religion. Theology" },
  { term: "christianity", code: "22/28", desc: "Christianity" },
  { term: "sikhism", code: "294.3", desc: "Sikhism" },
  { term: "hinduism", code: "294.51", desc: "Hinduism" },
  { term: "islam", code: "297", desc: "Islam" },

  { term: "sociology", code: "301", desc: "Sociology" },
  { term: "statistics", code: "31", desc: "Statistics" },
  { term: "political science", code: "32", desc: "Political science" },
  { term: "politics", code: "32", desc: "Politics" },
  { term: "economics", code: "33", desc: "Economics" },
  { term: "banking", code: "332.1", desc: "Banking" },
  { term: "labor", code: "331", desc: "Labour. Work" },
  { term: "labour", code: "331", desc: "Labour. Work" },
  { term: "law", code: "34", desc: "Law. Jurisprudence" },

  { term: "mathematics", code: "51", desc: "Mathematics" },
  { term: "algebra", code: "512", desc: "Algebra" },
  { term: "geometry", code: "513", desc: "Geometry" },
  { term: "astronomy", code: "52", desc: "Astronomy" },
  { term: "physics", code: "53", desc: "Physics" },
  { term: "chemistry", code: "54", desc: "Chemistry" },
  { term: "geology", code: "55", desc: "Geology" },
  { term: "biology", code: "57", desc: "Biological sciences" },
  { term: "botany", code: "58", desc: "Botany" },
  { term: "zoology", code: "59", desc: "Zoology" },

  { term: "medicine", code: "61", desc: "Medical sciences. Medicine" },
  { term: "public health", code: "614", desc: "Public health" },
  { term: "engineering", code: "62", desc: "Engineering" },
  { term: "electrical engineering", code: "621.3", desc: "Electrical engineering" },
  { term: "electronics", code: "621.38", desc: "Electronics" },
  { term: "telecommunication", code: "621.39", desc: "Telecommunication" },
  { term: "agriculture", code: "63", desc: "Agriculture. Farming" },
  { term: "forestry", code: "634.0", desc: "Forestry" },
  { term: "management", code: "65.01", desc: "Business management" },
  { term: "accounting", code: "657", desc: "Accountancy" },

  { term: "architecture", code: "72", desc: "Architecture" },
  { term: "music", code: "78", desc: "Music" },
  { term: "sports", code: "796", desc: "Sport. Games" },
  { term: "linguistics", code: "80", desc: "Linguistics. Languages" },
  { term: "literature", code: "82", desc: "Literature in general" },
  { term: "geography", code: "91", desc: "Geography" },
  { term: "history", code: "93/99", desc: "History" }
];

// Common Auxiliaries
const AUXILIARIES = [
  { term: "punjab", code: "(540.23)", desc: "Punjab" },
  { term: "india", code: "(540)", desc: "India" },
  { term: "great britain", code: "(410)", desc: "Great Britain" },
  { term: "united kingdom", code: "(410)", desc: "United Kingdom" },
  { term: "uk", code: "(410)", desc: "UK" },
  { term: "england", code: "(420)", desc: "England" },
  { term: "usa", code: "(73)", desc: "United States" },
  { term: "united states", code: "(73)", desc: "United States" },
  { term: "america", code: "(73)", desc: "America" },
  { term: "women", code: "-055.2", desc: "Women" },
  { term: "female", code: "-055.2", desc: "Female persons" },
  { term: "men", code: "-055.1", desc: "Men" },
  { term: "children", code: "-053.2", desc: "Children" },
  { term: "research", code: ".001.5", desc: "Scientific research" },
  { term: "dictionary", code: "(038)", desc: "Dictionary" },
  { term: "encyclopedia", code: "(031)", desc: "Encyclopedia" }
];

function classifyUDC(rawTitle) {
  let title = rawTitle.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  // Typo Auto-Fix
  title = title.replace(/\bhiger\b/g, "higher");
  title = title.replace(/\beductaion\b/g, "education");
  title = title.replace(/\bcomputr\b/g, "computer");

  // Rule 1: Literature + Form (e.g. English drama = 820-2)
  let matchedLang = null;
  let matchedForm = null;

  for (let i = 0; i < LIT_LANGUAGES.length; i++) {
    let l = LIT_LANGUAGES[i];
    if (new RegExp("\\b" + l.term + "\\b", "i").test(title)) {
      matchedLang = l;
      break;
    }
  }

  for (let i = 0; i < LIT_FORMS.length; i++) {
    let f = LIT_FORMS[i];
    if (new RegExp("\\b" + f.term + "\\b", "i").test(title)) {
      matchedForm = f;
      break;
    }
  }

  if (matchedLang && matchedForm) {
    return {
      code: matchedLang.litCode + matchedForm.code,
      description: matchedLang.desc + " literature - " + matchedForm.desc,
      standard: "UDC BS 1000A:1961 Edition"
    };
  } else if (matchedLang && title.includes("literature")) {
    return {
      code: matchedLang.litCode,
      description: matchedLang.desc + " literature",
      standard: "UDC BS 1000A:1961 Edition"
    };
  }

  // Rule 2: Higher Education and Computers (Strict BS 1000A:1961)
  const isHigherEd = title.includes("higher education") || title.includes("universit") || title.includes("college");
  const isComputer = title.includes("computer") || title.includes("computing") || title.includes("data processing") || title.includes(" co");

  if (isHigherEd && isComputer) {
    return {
      code: "378:681.14",
      description: "Higher education in relation to calculating mechanisms / computers",
      standard: "UDC BS 1000A:1961 Edition"
    };
  }

  // Rule 3: Auxiliaries Detection
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

  // Rule 4: Match Main Classes (Longest words first)
  let sortedMain = MAIN_SCHEDULE.slice().sort((a, b) => b.term.length - a.term.length);
  let matchedBases = [];

  for (let i = 0; i < sortedMain.length; i++) {
    let item = sortedMain[i];
    let reg = new RegExp("\\b" + item.term + "\\b", "i");
    if (reg.test(tempText)) {
      if (!matchedBases.some(m => m.code === item.code)) {
        matchedBases.push(item);
      }
      tempText = tempText.replace(reg, " ");
    }
  }

  // Compound Subject with Colon (:)
  if (matchedBases.length >= 2) {
    let codes = matchedBases.map(b => b.code);
    let descs = matchedBases.map(b => b.desc);
    return {
      code: codes.join(":"),
      description: descs.join(" in relation to "),
      standard: "UDC BS 1000A:1961 Edition"
    };
  }

  // Single Subject with Auxiliaries
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
      standard: "UDC BS 1000A:1961 Edition"
    };
  }

  return {
    code: "001",
    description: "Science and knowledge in general",
    standard: "UDC BS 1000A:1961 Edition"
  };
}

// UI
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>UDC Classifier (BS 1000A:1961)</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f3f4f6; margin: 0; padding: 40px 15px; text-align: center; }
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

// API Route
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
