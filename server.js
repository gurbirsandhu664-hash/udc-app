const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Full Main Schedule (UDC BS 1000A:1961)
const SCHEDULE = [
  { term: "metaphysics", code: "111", desc: "General metaphysics. Ontology" },
  { term: "ontology", code: "111", desc: "Ontology" },
  { term: "epistemology", code: "165", desc: "Theory of knowledge. Epistemology" },
  { term: "logic", code: "16", desc: "Logic" },
  { term: "ethics", code: "17", desc: "Ethics. Moral science" },
  { term: "child psychology", code: "159.922.7", desc: "Child psychology" },
  { term: "psychology", code: "159.9", desc: "Psychology" },
  { term: "philosophy", code: "1", desc: "Philosophy" },

  { term: "knowledge", code: "001", desc: "Science and knowledge in general" },
  { term: "cybernetics", code: "007", desc: "Cybernetics. Information theory" },
  { term: "bibliography", code: "01", desc: "Bibliography" },
  { term: "library science", code: "02", desc: "Libraries. Librarianship" },
  { term: "libraries", code: "02", desc: "Libraries" },
  { term: "encyclopaedia", code: "03", desc: "Encyclopaedias" },
  { term: "encyclopedia", code: "03", desc: "Encyclopaedias" },

  { term: "religion", code: "2", desc: "Religion. Theology" },
  { term: "christianity", code: "22/28", desc: "Christianity" },
  { term: "sikhism", code: "294.3", desc: "Sikhism" },
  { term: "hinduism", code: "294.51", desc: "Hinduism" },
  { term: "islam", code: "297", desc: "Islam" },

  { term: "higher education", code: "378", desc: "Higher education. Universities" },
  { term: "universities", code: "378", desc: "Universities" },
  { term: "colleges", code: "378", desc: "Colleges" },
  { term: "teaching methods", code: "371.3", desc: "Teaching methods" },
  { term: "primary education", code: "372", desc: "Primary education" },
  { term: "secondary education", code: "373", desc: "Secondary education" },
  { term: "education", code: "37", desc: "Education. Teaching" },
  { term: "sociology", code: "301", desc: "Sociology" },
  { term: "statistics", code: "31", desc: "Statistics" },
  { term: "political science", code: "32", desc: "Political science" },
  { term: "economics", code: "33", desc: "Economics" },
  { term: "banking", code: "332.1", desc: "Banking" },
  { term: "labor", code: "331", desc: "Labour. Work" },
  { term: "labour", code: "331", desc: "Labour. Work" },
  { term: "law", code: "34", desc: "Law. Jurisprudence" },
  { term: "public administration", code: "35", desc: "Public administration" },

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

  { term: "computers", code: "681.14", desc: "Calculating mechanisms. Computers" },
  { term: "computer", code: "681.14", desc: "Calculating mechanisms. Computers" },
  { term: "data processing", code: "681.14", desc: "Data processing machines" },
  { term: "medicine", code: "61", desc: "Medical sciences" },
  { term: "public health", code: "614", desc: "Public health" },
  { term: "engineering", code: "62", desc: "Engineering" },
  { term: "electrical engineering", code: "621.3", desc: "Electrical engineering" },
  { term: "electronics", code: "621.38", desc: "Electronics" },
  { term: "telecommunication", code: "621.39", desc: "Telecommunication" },
  { term: "agriculture", code: "63", desc: "Agriculture. Farming" },
  { term: "management", code: "65.01", desc: "Business management" },

  { term: "architecture", code: "72", desc: "Architecture" },
  { term: "music", code: "78", desc: "Music" },
  { term: "sports", code: "796", desc: "Sport. Games" },
  { term: "linguistics", code: "80", desc: "Linguistics" },
  { term: "literature", code: "82", desc: "Literature" },
  { term: "geography", code: "91", desc: "Geography" },
  { term: "biography", code: "929", desc: "Biographies" },
  { term: "history", code: "93/99", desc: "History" }
];

const LIT_LANGUAGES = [
  { term: "english", code: "820", name: "English literature" },
  { term: "french", code: "840", name: "French literature" },
  { term: "german", code: "830", name: "German literature" },
  { term: "hindi", code: "891.43", name: "Hindi literature" },
  { term: "punjabi", code: "891.42", name: "Punjabi literature" }
];

const LIT_FORMS = [
  { term: "drama", code: "-2", name: "Drama. Plays" },
  { term: "plays", code: "-2", name: "Drama. Plays" },
  { term: "poetry", code: "-1", name: "Poetry" },
  { term: "poems", code: "-1", name: "Poetry" },
  { term: "fiction", code: "-3", name: "Fiction. Novels" },
  { term: "novels", code: "-3", name: "Novels" },
  { term: "essays", code: "-4", name: "Essays" }
];

const AUXILIARIES = [
  { term: "punjab", code: "(540.23)", desc: "Place: Punjab" },
  { term: "india", code: "(540)", desc: "Place: India" },
  { term: "great britain", code: "(410)", desc: "Place: Great Britain" },
  { term: "united kingdom", code: "(410)", desc: "Place: United Kingdom" },
  { term: "uk", code: "(410)", desc: "Place: UK" },
  { term: "usa", code: "(73)", desc: "Place: United States" },
  { term: "women", code: "-055.2", desc: "Persons: Women" },
  { term: "female", code: "-055.2", desc: "Persons: Female" },
  { term: "men", code: "-055.1", desc: "Persons: Men" },
  { term: "children", code: "-053.2", desc: "Persons: Children" },
  { term: "research", code: ".001.5", desc: "Point of View: Scientific research" },
  { term: "dictionary", code: "(038)", desc: "Form: Dictionary" },
  { term: "encyclopedia", code: "(031)", desc: "Form: Encyclopedia" }
];

function classifyUDC(rawTitle) {
  let title = rawTitle.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  // Typo Auto-Correction
  title = title.replace(/\bhiger\b/g, "higher");
  title = title.replace(/\bcomputr\b/g, "computer");
  title = title.replace(/\beductaion\b/g, "education");
  title = title.replace(/\band l\b/g, "and logic");
  title = title.replace(/\band co\b/g, "and computers");

  // 1. Biography / Life of Rule (e.g. Biography of Dr S.R. Ranganathan -> 929(Ranganathan))
  let bioRegex = /(?:biography|life)\s+of\s+(?:dr\.?\s*)?([a-z\s\.]+)/i;
  let bioMatch = title.match(bioRegex);
  if (bioMatch) {
    let nameWords = bioMatch[1].trim().split(' ');
    // Pick the last significant word as the surname/name key (e.g. Ranganathan)
    let keyName = nameWords[nameWords.length - 1];
    let formattedName = keyName.charAt(0).toUpperCase() + keyName.slice(1);
    
    return {
      code: 929(${formattedName}),
      description: Biography of ${formattedName},
      breakdown: [
        { part: "929", label: "Biographies" },
        { part: (${formattedName}), label: Individual: ${formattedName} }
      ],
      standard: "UDC BS 1000A:1961 Edition (Individual Biography)"
    };
  }

  // 2. Literature Form Check
  let langMatch = null;
  let formMatch = null;

  for (let l of LIT_LANGUAGES) {
    if (new RegExp("\\b" + l.term + "\\b", "i").test(title)) {
      langMatch = l;
      break;
    }
  }

  for (let f of LIT_FORMS) {
    if (new RegExp("\\b" + f.term + "\\b", "i").test(title)) {
      formMatch = f;
      break;
    }
  }

  if (langMatch && formMatch) {
    return {
      code: langMatch.code + formMatch.code,
      description: langMatch.name + " - " + formMatch.name,
      breakdown: [
        { part: langMatch.code, label: langMatch.name },
        { part: formMatch.code, label: formMatch.name }
      ],
      standard: "UDC BS 1000A:1961 Edition"
    };
  }

  // 3. Auxiliary Detection
  let matchedAux = [];
  let workingText = title;

  for (let aux of AUXILIARIES) {
    let reg = new RegExp("\\b" + aux.term + "\\b", "i");
    if (reg.test(workingText)) {
      matchedAux.push(aux);
      workingText = workingText.replace(reg, " ");
    }
  }

  // 4. Main Schedule Matching
  let sortedSchedule = SCHEDULE.slice().sort((a, b) => b.term.length - a.term.length);
  let matchedBases = [];

  for (let item of sortedSchedule) {
    let reg = new RegExp("\\b" + item.term + "\\b", "i");
    if (reg.test(workingText)) {
      let exists = false;
      for (let m of matchedBases) {
        if (m.code === item.code) {
          exists = true;
          break;
        }
      }
      if (!exists) {
        matchedBases.push(item);
      }
      workingText = workingText.replace(reg, " ");
    }
  }

  // Filter out general '001' if specific subjects exist
  if (matchedBases.length > 1) {
    let hasSpecific = matchedBases.some(b => b.code !== "001");
    if (hasSpecific) {
      matchedBases = matchedBases.filter(b => b.code !== "001");
    }
  }

  // 5. Stroke (/) Sign Check for Range / Extension
  const isRange = title.includes(" to ") || title.includes(" through ") || title.includes("/");
  if (isRange && matchedBases.length >= 2) {
    let codes = matchedBases.map(b => b.code);
    let descs = matchedBases.map(b => b.desc);
    let parts = matchedBases.map(b => ({ part: b.code, label: b.desc }));

    return {
      code: codes[0] + "/" + codes[codes.length - 1],
      description: descs[0] + " through " + descs[descs.length - 1],
      breakdown: parts,
      standard: "UDC BS 1000A:1961 Edition (Stroke Extension /)"
    };
  }

  // 6. Plus (+) Sign Check for Coordinate Subjects
  const isCoordination = title.includes(" and ") || title.includes(",") || matchedBases.length > 2;
  if (matchedBases.length >= 2 && isCoordination && !title.includes(" relation ")) {
    let codes = matchedBases.map(b => b.code);
    let descs = matchedBases.map(b => b.desc);
    let parts = matchedBases.map(b => ({ part: b.code, label: b.desc }));

    return {
      code: codes.join(" + "),
      description: descs.join(" + "),
      breakdown: parts,
      standard: "UDC BS 1000A:1961 Edition (Coordinate Subjects +)"
    };
  }

  // 7. Colon (:) Sign Check for Interacting Subjects
  if (matchedBases.length >= 2) {
    let codes = matchedBases.map(b => b.code);
    let descs = matchedBases.map(b => b.desc);
    let parts = matchedBases.map(b => ({ part: b.code, label: b.desc }));

    return {
      code: codes.join(":"),
      description: descs.join(" : "),
      breakdown: parts,
      standard: "UDC BS 1000A:1961 Edition (Compound Subject :)"
    };
  }

  // 8. Single Subject + Auxiliaries
  if (matchedBases.length === 1) {
    let finalCode = matchedBases[0].code;
    let finalDesc = matchedBases[0].desc;
    let parts = [{ part: matchedBases[0].code, label: matchedBases[0].desc }];

    for (let a of matchedAux) {
      finalCode += a.code;
      finalDesc += " + " + a.desc;
      parts.push({ part: a.code, label: a.desc });
    }

    return {
      code: finalCode,
      description: finalDesc,
      breakdown: parts,
      standard: "UDC BS 1000A:1961 Edition"
    };
  }

  return {
    code: "001",
    description: "Science and knowledge in general",
    breakdown: [{ part: "001", label: "General knowledge" }],
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
      <title>Universal UDC Classifier (BS 1000A:1961)</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f3f4f6; margin: 0; padding: 40px 15px; text-align: center; }
        .box { max-width: 620px; margin: auto; background: white; padding: 35px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }
        h2 { color: #1f2937; margin-top: 0; }
        p { color: #6b7280; font-size: 15px; margin-bottom: 25px; }
        input { width: 75%; padding: 12px; font-size: 16px; border: 1.5px solid #d1d5db; border-radius: 6px; outline: none; }
        input:focus { border-color: #2563eb; }
        button { padding: 12px 22px; font-size: 16px; background: #2563eb; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }
        button:hover { background: #1d4ed8; }
        .res { display: none; margin-top: 25px; padding: 20px; background: #f9fafb; border: 1.5px solid #e5e7eb; border-left: 5px solid #2563eb; border-radius: 8px; text-align: left; }
        .code { font-size: 28px; font-weight: bold; color: #1e40af; font-family: monospace; }
        .desc { font-size: 16px; color: #374151; margin-top: 6px; }
        .breakdown-box { margin-top: 15px; padding-top: 12px; border-top: 1px dashed #cbd5e1; }
        .item-row { font-size: 14px; color: #475569; margin: 4px 0; }
        .badge { background: #e0e7ff; color: #3730a3; padding: 2px 7px; border-radius: 4px; font-family: monospace; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="box">
        <h2>UDC Classifier (BS 1000A:1961)</h2>
        <p>Supports Biographies, Colon (:), Plus (+), Stroke (/), and all Auxiliaries</p>
        <input type="text" id="subject" placeholder="e.g. Biography of Dr S.R. Ranganathan">
        <button onclick="run()">Classify</button>
        <div id="resBox" class="res">
          <div><strong>UDC Code:</strong> <span id="outCode" class="code"></span></div>
          <div class="desc"><strong>Full Description:</strong> <span id="outDesc"></span></div>
          <div id="breakdownSection" class="breakdown-box">
            <strong>Facet & Element Breakdown:</strong>
            <div id="breakdownList"></div>
          </div>
          <div style="font-size: 13px; color: #9ca3af; margin-top: 10px;" id="outStd"></div>
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

          let listHtml = '';
          if(d.breakdown && d.breakdown.length > 0) {
            d.breakdown.forEach(item => {
              listHtml += '<div class="item-row"><span class="badge">' + item.part + '</span> ' + item.label + '</div>';
            });
          }
          document.getElementById('breakdownList').innerHTML = listHtml;
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
    breakdown: result.breakdown,
    standard: result.standard
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log("UDC Engine live on port " + PORT);
});
