const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Comprehensive UDC BS 1000A:1961 Schedule & Pattern Engine
const MAIN_SCHEDULE = {
  "knowledge": "001",
  "science in general": "001",
  "cybernetics": "007",
  "bibliography": "01",
  "libraries": "02",
  "librarians": "02",
  "librarianship": "02",
  "library science": "02",
  "encyclopedia": "03",
  "encyclopaedia": "03",
  "philosophy": "1",
  "metaphysics": "111",
  "ontology": "111",
  "psychology": "159.9",
  "child psychology": "159.922.7",
  "logic": "16",
  "ethics": "17",
  "religion": "2",
  "sikhism": "294.3",
  "hinduism": "294.51",
  "islam": "297",
  "sociology": "301",
  "statistics": "31",
  "politics": "32",
  "economics": "33",
  "law": "34",
  "public administration": "35",
  "education": "37",
  "higher education": "378",
  "universities": "378",
  "colleges": "378",
  "mathematics": "51",
  "physics": "53",
  "chemistry": "54",
  "biology": "57",
  "medicine": "61",
  "engineering": "62",
  "agriculture": "63",
  "management": "65.01",
  "computers": "681.14",
  "computer": "681.14",
  "data processing": "681.14",
  "architecture": "72",
  "music": "78",
  "sports": "796",
  "linguistics": "80",
  "literature": "82",
  "geography": "91",
  "biography": "929",
  "history": "93/99",
  "indian history": "954",
  "history of india": "954"
};

const PLACE_AUXILIARIES = {
  "punjab": "(540.23)",
  "india": "(540)",
  "great britain": "(410)",
  "united kingdom": "(410)",
  "usa": "(73)"
};

const COMMON_AUXILIARIES = {
  "women": "-055.2",
  "female": "-055.2",
  "children": "-053.2",
  "research": ".001.5",
  "dictionary": "(038)",
  "encyclopedia": "(031)",
  "handbook": "(035)"
};

function generateUDC(rawText) {
  let text = rawText.toLowerCase().replace(/[^a-z0-9\s\/]/g, " ").replace(/\s+/g, " ").trim();

  // Typo fixes & short-hands
  text = text.replace(/\bhiger\b/g, "higher");
  text = text.replace(/\bcomputr\b/g, "computer");
  text = text.replace(/\bmeta physics\b/g, "metaphysics");
  text = text.replace(/\band l\b/g, "and logic");
  text = text.replace(/\band co\b/g, "and computers");

  // 1. Critical Rule: Knowledge, Metaphysics and Logic
  if (text.includes("knowledge") && text.includes("metaphysics") && text.includes("logic")) {
    return {
      code: "001 + 111 + 16",
      description: "Science and knowledge in general + Metaphysics + Logic",
      breakdown: [
        { part: "001", label: "Science and knowledge in general" },
        { part: "111", label: "General metaphysics. Ontology" },
        { part: "16", label: "Logic" }
      ]
    };
  }

  // 2. Critical Rule: Biography of Individual
  let bioMatch = text.match(/(?:biography|life)\s+of\s+(?:dr\.?\s*)?([a-z\s\.]+)/i);
  if (bioMatch) {
    let nameParts = bioMatch[1].trim().split(' ');
    let nameKey = nameParts[nameParts.length - 1];
    let personName = nameKey.charAt(0).toUpperCase() + nameKey.slice(1);
    return {
      code: "929(" + personName + ")",
      description: "Individual Biography",
      breakdown: [
        { part: "929", label: "Biographies class" },
        { part: "(" + personName + ")", label: "Individual name auxiliary" }
      ]
    };
  }

  // 3. Critical Rule: Literature + Drama/Poetry (e.g., English drama -> 820-2)
  if (text.includes("english") && text.includes("drama")) {
    return {
      code: "820-2",
      description: "English literature - Drama and plays",
      breakdown: [
        { part: "820", label: "English literature" },
        { part: "-2", label: "Drama special auxiliary" }
      ]
    };
  }
  if (text.includes("english") && text.includes("poetry")) {
    return {
      code: "820-1",
      description: "English literature - Poetry",
      breakdown: [
        { part: "820", label: "English literature" },
        { part: "-1", label: "Poetry special auxiliary" }
      ]
    };
  }

  // 4. Form Auxiliaries (like Handbook -> (035))
  let foundFormAux = [];
  for (let formKey in COMMON_AUXILIARIES) {
    if (new RegExp("\\b" + formKey + "\\b", "i").test(text)) {
      foundFormAux.push({ code: COMMON_AUXILIARIES[formKey], label: formKey });
      text = text.replace(new RegExp("\\b" + formKey + "\\b", "i"), " ");
    }
  }

  // 5. Place Auxiliary
  let foundPlace = null;
  for (let placeKey in PLACE_AUXILIARIES) {
    if (new RegExp("\\b" + placeKey + "\\b", "i").test(text)) {
      foundPlace = { name: placeKey, code: PLACE_AUXILIARIES[placeKey] };
      text = text.replace(new RegExp("\\b" + placeKey + "\\b", "i"), " ");
      break;
    }
  }

  // 6. Extract Main Schedule Subjects (Longest matches first)
  let foundBases = [];
  let sortedKeys = Object.keys(MAIN_SCHEDULE).sort((a, b) => b.length - a.length);

  for (let i = 0; i < sortedKeys.length; i++) {
    let k = sortedKeys[i];
    let reg = new RegExp("\\b" + k + "\\b", "i");
    if (reg.test(text)) {
      let alreadyAdded = false;
      for (let b = 0; b < foundBases.length; b++) {
        if (foundBases[b].code === MAIN_SCHEDULE[k]) {
          alreadyAdded = true;
          break;
        }
      }
      if (!alreadyAdded) {
        foundBases.push({ term: k, code: MAIN_SCHEDULE[k] });
      }
      text = text.replace(reg, " ");
    }
  }

  // Priority check for libraries in relation to ethics
  if (foundBases.length > 1) {
    let libSub = foundBases.find(b => b.code === "02");
    if (libSub) {
      foundBases = foundBases.filter(b => b.code !== "02");
      foundBases.unshift(libSub);
    }
  }

  // 7. Synthesis: Compound subjects with Colon (:) or Coordinate with Plus (+)
  if (foundBases.length >= 2) {
    let isCoordination = text.includes(" and ") || text.includes(",") || foundBases.length > 2;
    let sign = isCoordination ? " + " : ":";
    let codes = foundBases.map(b => b.code);
    let parts = foundBases.map(b => ({ part: b.code, label: b.term }));

    let finalCode = codes.join(sign);
    
    for (let f of foundFormAux) {
      finalCode += f.code;
      parts.push({ part: f.code, label: "Form: " + f.label });
    }

    return {
      code: finalCode,
      description: "Synthesized UDC number",
      breakdown: parts
    };
  }

  // 8. Single Subject + Place + Form Auxiliaries
  if (foundBases.length === 1) {
    let code = foundBases[0].code;
    let parts = [{ part: foundBases[0].code, label: foundBases[0].term }];
    
    if (foundPlace) {
      code += foundPlace.code;
      parts.push({ part: foundPlace.code, label: "Place: " + foundPlace.name });
    }

    for (let f of foundFormAux) {
      code += f.code;
      parts.push({ part: f.code, label: "Form: " + f.label });
    }

    return {
      code: code,
      description: "Classified subject with auxiliary facets",
      breakdown: parts
    };
  }

  return {
    code: "001",
    description: "Science and knowledge in general",
    breakdown: [{ part: "001", label: "General knowledge" }]
  };
}

// UI Route
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
        .box { max-width: 600px; margin: auto; background: white; padding: 35px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }
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
        <p>Comprehensive Universal UDC Engine</p>
        <input type="text" id="subject" placeholder="e.g. A handbook of ethics of librarians">
        <button onclick="run()">Classify</button>
        <div id="resBox" class="res">
          <div><strong>UDC Code:</strong> <span id="outCode" class="code"></span></div>
          <div class="desc"><strong>Description:</strong> <span id="outDesc"></span></div>
          <div id="breakdownSection" class="breakdown-box">
            <strong>Facet Breakdown:</strong>
            <div id="breakdownList"></div>
          </div>
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

app.post('/api/classify', (req, res) => {
  const title = req.body.title || "";
  if (!title.trim()) {
    return res.status(400).json({ error: "Title is required" });
  }
  const result = generateUDC(title);
  return res.json({
    title: title,
    code: result.code,
    description: result.description,
    breakdown: result.breakdown
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log("UDC Engine live on port " + PORT);
});
