const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 1. UDC BS 1000A:1961 Main Schedule Tables
const UDC_MAIN_SCHEDULE = [
  // 0 - Generalities
  { term: "bibliography", code: "01", desc: "Bibliography" },
  { term: "library science", code: "02", desc: "Librarianship. Libraries" },
  { term: "libraries", code: "02", desc: "Libraries" },
  { term: "encyclopaedia", code: "03", desc: "Encyclopaedias" },
  { term: "cybernetics", code: "007", desc: "Activity and organizing. Information theory. Cybernetics" },
  { term: "information science", code: "002", desc: "Documentation. Information science" },

  // 1 - Philosophy & Psychology
  { term: "philosophy", code: "1", desc: "Philosophy" },
  { term: "psychology", code: "159.9", desc: "Psychology" },
  { term: "child psychology", code: "159.922.7", desc: "Child psychology" },
  { term: "ethics", code: "17", desc: "Ethics. Moral science" },

  // 2 - Religion
  { term: "religion", code: "2", desc: "Religion. Theology" },
  { term: "christianity", code: "22/28", desc: "Christianity" },
  { term: "hinduism", code: "294.51", desc: "Hinduism" },
  { term: "islam", code: "297", desc: "Islam" },
  { term: "sikhism", code: "294.3", desc: "Sikhism" },

  // 3 - Social Sciences
  { term: "social sciences", code: "3", desc: "Social sciences" },
  { term: "sociology", code: "301", desc: "Sociology" },
  { term: "statistics", code: "31", desc: "Statistics" },
  { term: "political science", code: "32", desc: "Political science" },
  { term: "politics", code: "32", desc: "Politics" },
  { term: "economics", code: "33", desc: "Economics" },
  { term: "banking", code: "332.1", desc: "Banking" },
  { term: "labor", code: "331", desc: "Labor. Work. Employment" },
  { term: "labour", code: "331", desc: "Labour" },
  { term: "law", code: "34", desc: "Jurisprudence. Law. Legislation" },
  { term: "public administration", code: "35", desc: "Public administration" },
  { term: "education", code: "37", desc: "Education. Teaching. Training" },
  { term: "higher education", code: "378", desc: "Higher education. Universities. Colleges" },
  { term: "universities", code: "378", desc: "Higher education. Universities" },
  { term: "colleges", code: "378", desc: "Higher education. Colleges" },
  { term: "secondary education", code: "373", desc: "Secondary education" },
  { term: "primary education", code: "372", desc: "Elementary and primary education" },
  { term: "elementary education", code: "372", desc: "Elementary and primary education" },
  { term: "teaching methods", code: "371.3", desc: "Methods of instruction and teaching" },

  // 5 - Pure Sciences
  { term: "mathematics", code: "51", desc: "Mathematics" },
  { term: "algebra", code: "512", desc: "Algebra" },
  { term: "geometry", code: "513", desc: "Geometry" },
  { term: "astronomy", code: "52", desc: "Astronomy. Astrophysics" },
  { term: "physics", code: "53", desc: "Physics" },
  { term: "electricity", code: "537", desc: "Electricity" },
  { term: "chemistry", code: "54", desc: "Chemistry" },
  { term: "geology", code: "55", desc: "Geology. Meteorology" },
  { term: "biology", code: "57", desc: "Biological sciences" },
  { term: "botany", code: "58", desc: "Botany" },
  { term: "zoology", code: "59", desc: "Zoology" },

  // 6 - Applied Sciences, Medicine, Engineering, Computing (1961 Edition: 681.14)
  { term: "medical sciences", code: "61", desc: "Medical sciences" },
  { term: "medicine", code: "61", desc: "Medical sciences. Medicine" },
  { term: "public health", code: "614", desc: "Public health. Hygiene" },
  { term: "engineering", code: "62", desc: "Engineering" },
  { term: "mechanical engineering", code: "621", desc: "Mechanical engineering" },
  { term: "electrical engineering", code: "621.3", desc: "Electrical engineering" },
  { term: "electronics", code: "621.38", desc: "Electronics" },
  { term: "telecommunication", code: "621.39", desc: "Telecommunication" },
  { term: "mining", code: "622", desc: "Mining" },
  { term: "civil engineering", code: "624", desc: "Civil engineering" },
  { term: "railway engineering", code: "625", desc: "Railway engineering" },
  { term: "agriculture", code: "63", desc: "Agriculture. Farming" },
  { term: "crops", code: "633", desc: "Field crops" },
  { term: "horticulture", code: "635", desc: "Horticulture. Gardening" },
  { term: "animal husbandry", code: "636", desc: "Stockbreeding. Livestock" },
  { term: "forestry", code: "634.0", desc: "Forestry" },
  { term: "business management", code: "65", desc: "Management. Commercial practice" },
  { term: "management", code: "65.01", desc: "Management theory" },
  { term: "accounting", code: "657", desc: "Accountancy. Bookkeeping" },
  { term: "chemical engineering", code: "66", desc: "Chemical technology" },
  { term: "metallurgy", code: "669", desc: "Metallurgy" },
  { term: "computers", code: "681.14", desc: "Calculating mechanisms. Computers" },
  { term: "computer", code: "681.14", desc: "Calculating mechanisms. Computers" },
  { term: "data processing", code: "681.14", desc: "Data processing machines" },

  // 7 - Arts & Recreation
  { term: "architecture", code: "72", desc: "Architecture" },
  { term: "photography", code: "77", desc: "Photography" },
  { term: "music", code: "78", desc: "Music" },
  { term: "sports", code: "796", desc: "Sport. Games" },

  // 8 & 9 - Literature, Geography & History
  { term: "linguistics", code: "80", desc: "Linguistics. Languages" },
  { term: "literature", code: "82", desc: "Literature" },
  { term: "geography", code: "91", desc: "Geography" },
  { term: "history", code: "93/99", desc: "History" }
];

// 2. Auxiliaries (Place, Persons, Point of View, Form)
const UDC_AUXILIARIES = [
  // Place (1/9)
  { term: "punjab", code: "(540.23)", type: "place", desc: "Punjab" },
  { term: "india", code: "(540)", type: "place", desc: "India" },
  { term: "great britain", code: "(410)", type: "place", desc: "Great Britain" },
  { term: "united kingdom", code: "(410)", type: "place", desc: "United Kingdom" },
  { term: "uk", code: "(410)", type: "place", desc: "UK" },
  { term: "england", code: "(420)", type: "place", desc: "England" },
  { term: "usa", code: "(73)", type: "place", desc: "United States" },
  { term: "united states", code: "(73)", type: "place", desc: "United States" },
  { term: "america", code: "(73)", type: "place", desc: "America" },
  { term: "europe", code: "(4)", type: "place", desc: "Europe" },
  { term: "asia", code: "(5)", type: "place", desc: "Asia" },

  // Persons -05
  { term: "women", code: "-055.2", type: "person", desc: "Women" },
  { term: "female", code: "-055.2", type: "person", desc: "Female persons" },
  { term: "men", code: "-055.1", type: "person", desc: "Men" },
  { term: "male", code: "-055.1", type: "person", desc: "Male persons" },
  { term: "children", code: "-053.2", type: "person", desc: "Children" },
  { term: "youth", code: "-053.6", type: "person", desc: "Youth" },
  { term: "students", code: "-057.87", type: "person", desc: "Students" },

  // Point of View .00
  { term: "research", code: ".001.5", type: "view", desc: "Scientific research" },
  { term: "theoretical", code: ".001", type: "view", desc: "Theoretical viewpoint" },
  { term: "economic aspect", code: ".003", type: "view", desc: "Economic point of view" },
  { term: "social aspect", code: ".004", type: "view", desc: "Social point of view" },

  // Form (0...)
  { term: "dictionary", code: "(038)", type: "form", desc: "Dictionary" },
  { term: "encyclopedia", code: "(031)", type: "form", desc: "Encyclopedia" },
  { term: "handbook", code: "(035)", type: "form", desc: "Handbook. Manual" },
  { term: "periodical", code: "(05)", type: "form", desc: "Periodical. Journal" }
];

function parseAndSynthesize(title) {
  let cleanTitle = title.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  const sortedMain = [...UDC_MAIN_SCHEDULE].sort((a, b) => b.term.length - a.term.length);
  const sortedAux = [...UDC_AUXILIARIES].sort((a, b) => b.term.length - a.term.length);

  let matchedMain = [];
  let matchedAux = [];
  let remainingText = cleanTitle;

  // 1. Match Auxiliaries
  for (const aux of sortedAux) {
    const regex = new RegExp(\\b${aux.term}\\b, 'i');
    if (regex.test(remainingText)) {
      matchedAux.push(aux);
      remainingText = remainingText.replace(regex, " ");
    }
  }

  // 2. Match Main Classes
  for (const item of sortedMain) {
    const regex = new RegExp(\\b${item.term}\\b, 'i');
    if (regex.test(remainingText)) {
      if (!matchedMain.some(m => m.code === item.code)) {
        matchedMain.push(item);
      }
      remainingText = remainingText.replace(regex, " ");
    }
  }

  if (matchedMain.length === 0) {
    return {
      code: "001",
      description: "Science and knowledge in general",
      facet: "Unclassified Subject"
    };
  }

  // 3. Compound subjects with Colon relation (:)
  if (matchedMain.length >= 2) {
    const combinedCode = matchedMain.map(m => m.code).join(':');
    const combinedDesc = matchedMain.map(m => m.desc).join(' in relation to ');
    return {
      code: combinedCode,
      description: combinedDesc,
      facet: "Compound Subject with Colon Synthesis (:)"
    };
  }

  // 4. Single subject with attached Auxiliaries
  let finalCode = matchedMain[0].code;
  let descParts = [matchedMain[0].desc];

  const person = matchedAux.find(a => a.type === "person");
  const view = matchedAux.find(a => a.type === "view");
  const place = matchedAux.find(a => a.type === "place");
  const form = matchedAux.find(a => a.type === "form");

  if (person) {
    finalCode += person.code;
    descParts.push(person.desc);
  }
  if (view) {
    finalCode += view.code;
    descParts.push(view.desc);
  }
  if (place) {
    finalCode += place.code;
    descParts.push(place.desc);
  }
  if (form) {
    finalCode += form.code;
    descParts.push(form.desc);
  }

  return {
    code: finalCode,
    description: descParts.join(" - "),
    facet: matchedAux.length > 0 ? "Complex Subject with Auxiliaries" : "Single Main Class"
  };
}

// Clean English UI Route
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Universal UDC Classifier (BS 1000A:1961 Edition)</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #eef2f6; margin: 0; padding: 40px 15px; }
        .box { max-width: 680px; margin: auto; background: white; padding: 35px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        h2 { color: #1e3a8a; text-align: center; margin-top: 0; }
        p.subtitle { text-align: center; color: #64748b; margin-bottom: 25px; font-size: 14px; }
        .search-area { display: flex; gap: 10px; margin-bottom: 25px; }
        input { flex: 1; padding: 14px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 16px; outline: none; }
        input:focus { border-color: #2563eb; }
        button { padding: 14px 24px; background: #2563eb; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 16px; }
        button:hover { background: #1d4ed8; }
        .res { display: none; background: #f8fafc; border: 1.5px solid #e2e8f0; border-left: 6px solid #2563eb; border-radius: 8px; padding: 20px; }
        .code { font-size: 26px; font-weight: 800; color: #1e40af; font-family: monospace; margin: 5px 0; }
        .desc { font-size: 16px; color: #334155; margin-bottom: 8px; }
        .tag { display: inline-block; background: #dbeafe; color: #1e40af; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="box">
        <h2>UDC Classifier (BS 1000A:1961 Edition)</h2>
        <p class="subtitle">Supports main classes, colon relation (:), and auxiliary tables</p>
        <div class="search-area">
          <input type="text" id="t" placeholder="e.g. Higher education and computers">
          <button onclick="calc()">Classify</button>
        </div>
        <div id="res" class="res">
          <div><span id="facet" class="tag"></span></div>
          <div id="c" class="code"></div>
          <div id="d" class="desc"></div>
        </div>
      </div>
      <script>
        async function calc() {
          const val = document.getElementById('t').value;
          if(!val.trim()) return;
          const r = await fetch('/api/classify', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({title: val})
          });
          const d = await r.json();
          document.getElementById('res').style.display = 'block';
          document.getElementById('c').innerText = d.code;
          document.getElementById('d').innerText = d.description;
          document.getElementById('facet').innerText = d.facet;
        }
      </script>
    </body>
    </html>
  `);
});

// Classification API
app.post('/api/classify', (req, res) => {
  const title = req.body.title || "";
  if (!title.trim()) {
    return res.status(400).json({ error: "Title required" });
  }

  const result = parseAndSynthesize(title);
  return res.json({
    title: title,
    code: result.code,
    description: result.description,
    facet: result.facet,
    standard: "Universal Decimal Classification BS 1000A:1961"
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(Server live on port ${PORT});
});
