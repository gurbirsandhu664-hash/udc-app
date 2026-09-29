const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Main Schedule (UDC BS 1000A:1961)
const UDC_MAIN = [
  { term: "bibliography", code: "01", desc: "Bibliography" },
  { term: "library science", code: "02", desc: "Librarianship. Libraries" },
  { term: "libraries", code: "02", desc: "Libraries" },
  { term: "cybernetics", code: "007", desc: "Activity and organizing. Cybernetics" },
  { term: "philosophy", code: "1", desc: "Philosophy" },
  { term: "child psychology", code: "159.922.7", desc: "Child psychology" },
  { term: "psychology", code: "159.9", desc: "Psychology" },
  { term: "ethics", code: "17", desc: "Ethics. Moral science" },
  { term: "religion", code: "2", desc: "Religion. Theology" },
  { term: "sikhism", code: "294.3", desc: "Sikhism" },
  { term: "hinduism", code: "294.51", desc: "Hinduism" },
  { term: "islam", code: "297", desc: "Islam" },
  { term: "social sciences", code: "3", desc: "Social sciences" },
  { term: "sociology", code: "301", desc: "Sociology" },
  { term: "statistics", code: "31", desc: "Statistics" },
  { term: "political science", code: "32", desc: "Political science" },
  { term: "politics", code: "32", desc: "Politics" },
  { term: "economics", code: "33", desc: "Economics" },
  { term: "banking", code: "332.1", desc: "Banking" },
  { term: "labor", code: "331", desc: "Labor. Employment" },
  { term: "labour", code: "331", desc: "Labour. Employment" },
  { term: "law", code: "34", desc: "Jurisprudence. Law" },
  { term: "public administration", code: "35", desc: "Public administration" },
  { term: "higher education", code: "378", desc: "Higher education. Universities" },
  { term: "universities", code: "378", desc: "Universities" },
  { term: "colleges", code: "378", desc: "Colleges" },
  { term: "teaching methods", code: "371.3", desc: "Teaching methods" },
  { term: "primary education", code: "372", desc: "Elementary and primary education" },
  { term: "elementary education", code: "372", desc: "Elementary and primary education" },
  { term: "secondary education", code: "373", desc: "Secondary education" },
  { term: "education", code: "37", desc: "Education. Teaching" },
  { term: "mathematics", code: "51", desc: "Mathematics" },
  { term: "algebra", code: "512", desc: "Algebra" },
  { term: "geometry", code: "513", desc: "Geometry" },
  { term: "astronomy", code: "52", desc: "Astronomy" },
  { term: "physics", code: "53", desc: "Physics" },
  { term: "electricity", code: "537", desc: "Electricity" },
  { term: "chemistry", code: "54", desc: "Chemistry" },
  { term: "geology", code: "55", desc: "Geology" },
  { term: "biology", code: "57", desc: "Biological sciences" },
  { term: "botany", code: "58", desc: "Botany" },
  { term: "zoology", code: "59", desc: "Zoology" },
  { term: "medicine", code: "61", desc: "Medical sciences. Medicine" },
  { term: "medical sciences", code: "61", desc: "Medical sciences" },
  { term: "public health", code: "614", desc: "Public health" },
  { term: "mechanical engineering", code: "621", desc: "Mechanical engineering" },
  { term: "electrical engineering", code: "621.3", desc: "Electrical engineering" },
  { term: "electronics", code: "621.38", desc: "Electronics" },
  { term: "telecommunication", code: "621.39", desc: "Telecommunication" },
  { term: "civil engineering", code: "624", desc: "Civil engineering" },
  { term: "engineering", code: "62", desc: "Engineering" },
  { term: "agriculture", code: "63", desc: "Agriculture. Farming" },
  { term: "forestry", code: "634.0", desc: "Forestry" },
  { term: "management", code: "65.01", desc: "Management" },
  { term: "accounting", code: "657", desc: "Accountancy" },
  { term: "computers", code: "681.14", desc: "Calculating mechanisms. Computers" },
  { term: "computer", code: "681.14", desc: "Calculating mechanisms. Computers" },
  { term: "data processing", code: "681.14", desc: "Data processing machines" },
  { term: "architecture", code: "72", desc: "Architecture" },
  { term: "music", code: "78", desc: "Music" },
  { term: "sports", code: "796", desc: "Sport. Games" },
  { term: "linguistics", code: "80", desc: "Linguistics. Languages" },
  { term: "literature", code: "82", desc: "Literature" },
  { term: "geography", code: "91", desc: "Geography" },
  { term: "history", code: "93/99", desc: "History" }
];

// Auxiliaries
const UDC_AUX = [
  { term: "punjab", code: "(540.23)", type: "place", desc: "Punjab" },
  { term: "india", code: "(540)", type: "place", desc: "India" },
  { term: "great britain", code: "(410)", type: "place", desc: "Great Britain" },
  { term: "united kingdom", code: "(410)", type: "place", desc: "United Kingdom" },
  { term: "uk", code: "(410)", type: "place", desc: "UK" },
  { term: "usa", code: "(73)", type: "place", desc: "United States" },
  { term: "united states", code: "(73)", type: "place", desc: "United States" },
  { term: "america", code: "(73)", type: "place", desc: "America" },
  { term: "europe", code: "(4)", type: "place", desc: "Europe" },
  { term: "women", code: "-055.2", type: "person", desc: "Women" },
  { term: "female", code: "-055.2", type: "person", desc: "Female persons" },
  { term: "men", code: "-055.1", type: "person", desc: "Men" },
  { term: "male", code: "-055.1", type: "person", desc: "Male persons" },
  { term: "children", code: "-053.2", type: "person", desc: "Children" },
  { term: "research", code: ".001.5", type: "view", desc: "Scientific research" },
  { term: "dictionary", code: "(038)", type: "form", desc: "Dictionary" },
  { term: "encyclopedia", code: "(031)", type: "form", desc: "Encyclopedia" }
];

function classifySubject(title) {
  let text = title.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  let matchedAux = [];
  let matchedMain = [];

  // Match Auxiliaries
  for (let i = 0; i < UDC_AUX.length; i++) {
    let aux = UDC_AUX[i];
    let reg = new RegExp("\\b" + aux.term + "\\b", "i");
    if (reg.test(text)) {
      matchedAux.push(aux);
      text = text.replace(reg, " ");
    }
  }

  // Match Main Schedule
  for (let i = 0; i < UDC_MAIN.length; i++) {
    let item = UDC_MAIN[i];
    let reg = new RegExp("\\b" + item.term + "\\b", "i");
    if (reg.test(text)) {
      let alreadyExists = false;
      for (let j = 0; j < matchedMain.length; j++) {
        if (matchedMain[j].code === item.code) {
          alreadyExists = true;
          break;
        }
      }
      if (!alreadyExists) {
        matchedMain.push(item);
      }
      text = text.replace(reg, " ");
    }
  }

  if (matchedMain.length === 0) {
    return {
      code: "001",
      description: "Science and knowledge in general"
    };
  }

  // Compound (Colon relation)
  if (matchedMain.length >= 2) {
    let codes = [];
    let descs = [];
    for (let k = 0; k < matchedMain.length; k++) {
      codes.push(matchedMain[k].code);
      descs.push(matchedMain[k].desc);
    }
    return {
      code: codes.join(":"),
      description: descs.join(" in relation to ")
    };
  }

  // Single with auxiliaries
  let finalCode = matchedMain[0].code;
  let finalDesc = matchedMain[0].desc;

  for (let a = 0; a < matchedAux.length; a++) {
    finalCode += matchedAux[a].code;
    finalDesc += " - " + matchedAux[a].desc;
  }

  return {
    code: finalCode,
    description: finalDesc
  };
}

// UI
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>UDC Classifier (BS 1000A:1961)</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 40px 15px; text-align: center; }
        .box { max-width: 600px; margin: auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        input { width: 75%; padding: 12px; font-size: 16px; border: 1px solid #ccc; border-radius: 4px; outline: none; }
        button { padding: 12px 20px; font-size: 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
        button:hover { background: #0056b3; }
        .res { display: none; margin-top: 25px; padding: 20px; background: #e9ecef; border-radius: 6px; text-align: left; }
        .code { font-size: 24px; font-weight: bold; color: #0056b3; font-family: monospace; }
      </style>
    </head>
    <body>
      <div class="box">
        <h2>UDC Classifier (BS 1000A:1961)</h2>
        <p style="color: #666;">Enter subject title below</p>
        <input type="text" id="term" placeholder="e.g. Higher education and computers">
        <button onclick="run()">Classify</button>
        <div id="resBox" class="res">
          <p><strong>UDC Code:</strong> <span id="outCode" class="code"></span></p>
          <p><strong>Description:</strong> <span id="outDesc"></span></p>
        </div>
      </div>
      <script>
        async function run() {
          const val = document.getElementById('term').value;
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
        }
      </script>
    </body>
    </html>
  `);
});

// API
app.post('/api/classify', (req, res) => {
  const title = req.body.title || "";
  if (!title.trim()) {
    return res.status(400).json({ error: "Title is required" });
  }
  const result = classifySubject(title);
  return res.json({
    title: title,
    code: result.code,
    description: result.description,
    standard: "UDC BS 1000A:1961 Edition"
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log("Server listening on port " + PORT);
});
