const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Core UDC BS 1000A:1961 Engine
const MAIN_MAP = {
  "higher education": "378",
  "universities": "378",
  "university": "378",
  "colleges": "378",
  "computers": "681.14",
  "computer": "681.14",
  "data processing": "681.14",
  "knowledge": "001",
  "metaphysics": "111",
  "ontology": "111",
  "logic": "16",
  "ethics": "17",
  "psychology": "159.9",
  "child psychology": "159.922.7",
  "philosophy": "1",
  "religion": "2",
  "sikhism": "294.3",
  "hinduism": "294.51",
  "islam": "297",
  "sociology": "301",
  "statistics": "31",
  "economics": "33",
  "law": "34",
  "education": "37",
  "mathematics": "51",
  "physics": "53",
  "chemistry": "54",
  "biology": "57",
  "medicine": "61",
  "engineering": "62",
  "electrical engineering": "621.3",
  "agriculture": "63",
  "architecture": "72",
  "music": "78",
  "linguistics": "80",
  "literature": "82",
  "geography": "91",
  "history": "93/99"
};

const AUX_MAP = {
  "punjab": "(540.23)",
  "india": "(540)",
  "women": "-055.2",
  "female": "-055.2",
  "children": "-053.2",
  "research": ".001.5",
  "dictionary": "(038)",
  "encyclopedia": "(031)"
};

function processUDC(rawText) {
  let text = rawText.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  // Typo fixes
  text = text.replace(/\bhiger\b/g, "higher");
  text = text.replace(/\bcomputr\b/g, "computer");

  // 1. Biography Rule (e.g., Biography of Dr S.R. Ranganathan)
  let bioMatch = text.match(/(?:biography|life)\s+of\s+(?:dr\.?\s*)?([a-z\s\.]+)/i);
  if (bioMatch) {
    let nameParts = bioMatch[1].trim().split(' ');
    let nameKey = nameParts[nameParts.length - 1];
    let personName = nameKey.charAt(0).toUpperCase() + nameKey.slice(1);
    return {
      code: "929(" + personName + ")",
      description: "Biography of individual: " + personName,
      breakdown: [
        { part: "929", label: "Biographies" },
        { part: "(" + personName + ")", label: "Individual name auxiliary" }
      ]
    };
  }

  // 2. Literature Forms Rule (e.g., English drama -> 820-2)
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

  // 3. Match Auxiliaries
  let foundAux = [];
  for (let key in AUX_MAP) {
    if (new RegExp("\\b" + key + "\\b", "i").test(text)) {
      foundAux.push({ code: AUX_MAP[key], label: key });
      text = text.replace(new RegExp("\\b" + key + "\\b", "i"), " ");
    }
  }

  // 4. Match Main Schedule Subjects
  let foundBases = [];
  let sortedKeys = Object.keys(MAIN_MAP).sort((a, b) => b.length - a.length);

  for (let i = 0; i < sortedKeys.length; i++) {
    let k = sortedKeys[i];
    let reg = new RegExp("\\b" + k + "\\b", "i");
    if (reg.test(text)) {
      let alreadyAdded = false;
      for (let b = 0; b < foundBases.length; b++) {
        if (foundBases[b].code === MAIN_MAP[k]) {
          alreadyAdded = true;
          break;
        }
      }
      if (!alreadyAdded) {
        foundBases.push({ term: k, code: MAIN_MAP[k] });
      }
      text = text.replace(reg, " ");
    }
  }

  // Filter general 001 if specific subjects exist
  if (foundBases.length > 1) {
    foundBases = foundBases.filter(b => b.code !== "001");
  }

  // 5. Synthesis Rules: Plus (+) for coordination, Colon (:) for compound
  if (foundBases.length >= 2) {
    let isCoordination = text.includes(" and ") || text.includes(",") || foundBases.length > 2;
    let sign = isCoordination ? " + " : ":";
    let codes = foundBases.map(b => b.code);
    let parts = foundBases.map(b => ({ part: b.code, label: b.term }));

    return {
      code: codes.join(sign),
      description: "Synthesized UDC number using sign (" + sign.trim() + ")",
      breakdown: parts
    };
  }

  // 6. Single Subject + Auxiliaries
  if (foundBases.length === 1) {
    let code = foundBases[0].code;
    let parts = [{ part: foundBases[0].code, label: foundBases[0].term }];
    
    for (let i = 0; i < foundAux.length; i++) {
      code += foundAux[i].code;
      parts.push({ part: foundAux[i].code, label: foundAux[i].label });
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
        <p>Reliable and lightweight classification engine</p>
        <input type="text" id="subject" placeholder="e.g. Higher education and computers">
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

// API Route
app.post('/api/classify', (req, res) => {
  const title = req.body.title || "";
  if (!title.trim()) {
    return res.status(400).json({ error: "Title is required" });
  }
  const result = processUDC(title);
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
