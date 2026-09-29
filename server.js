const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Comprehensive UDC BS 1000A:1961 Schedule (Classes 0 to 9)
const MAIN_SCHEDULE = {
  // Class 0: Generalities
  "knowledge": "001",
  "science in general": "001",
  "cybernetics": "007",
  "bibliography": "01",
  "library science": "02",
  "libraries": "02",
  "encyclopedia": "03",
  "encyclopaedia": "03",
  "periodicals": "05",
  "journalism": "07",

  // Class 1: Philosophy & Psychology
  "philosophy": "1",
  "metaphysics": "111",
  "ontology": "111",
  "psychology": "159.9",
  "child psychology": "159.922.7",
  "logic": "16",
  "ethics": "17",

  // Class 2: Religion & Theology
  "religion": "2",
  "theology": "2",
  "bible": "22",
  "christianity": "22/28",
  "sikhism": "294.3",
  "hinduism": "294.51",
  "islam": "297",

  // Class 3: Social Sciences, Law, Education, Politics, Economics
  "social sciences": "3",
  "sociology": "301",
  "statistics": "31",
  "political science": "32",
  "politics": "32",
  "economics": "33",
  "banking": "332.1",
  "law": "34",
  "jurisprudence": "34",
  "public administration": "35",
  "education": "37",
  "teaching methods": "371.3",
  "primary education": "372",
  "secondary education": "373",
  "higher education": "378",
  "universities": "378",
  "colleges": "378",
  "commerce": "38",

  // Class 5: Pure Sciences
  "mathematics": "51",
  "algebra": "512",
  "geometry": "513",
  "calculus": "517",
  "astronomy": "52",
  "physics": "53",
  "mechanics": "531",
  "optics": "535",
  "electricity": "537",
  "chemistry": "54",
  "organic chemistry": "547",
  "geology": "55",
  "biology": "57",
  "botany": "58",
  "zoology": "59",

  // Class 6: Applied Sciences & Technology (1961 Edition)
  "medicine": "61",
  "medical sciences": "61",
  "anatomy": "611",
  "physiology": "612",
  "public health": "614",
  "engineering": "62",
  "mechanical engineering": "621",
  "electrical engineering": "621.3",
  "electronics": "621.38",
  "telecommunication": "621.39",
  "civil engineering": "624",
  "agriculture": "63",
  "forestry": "634.0",
  "horticulture": "635",
  "management": "65.01",
  "accounting": "657",
  "chemical technology": "66",
  "metallurgy": "669",
  "computers": "681.14",
  "computer": "681.14",
  "data processing": "681.14",

  // Class 7: Arts, Fine Arts, Recreation
  "architecture": "72",
  "sculpture": "73",
  "painting": "75",
  "photography": "77",
  "music": "78",
  "sports": "796",
  "games": "796",

  // Class 8: Linguistics & Literature
  "linguistics": "80",
  "languages": "80",
  "literature": "82",

  // Class 9: Geography, Biography, History
  "geography": "91",
  "biography": "929",
  "history": "93/99",
  "indian history": "954",
  "history of india": "954"
};

// Place Auxiliaries (1/9)
const PLACE_AUXILIARIES = {
  "punjab": "(540.23)",
  "india": "(540)",
  "great britain": "(410)",
  "united kingdom": "(410)",
  "uk": "(410)",
  "england": "(420)",
  "usa": "(73)",
  "america": "(73)",
  "france": "(44)",
  "germany": "(430)",
  "russia": "(47)",
  "china": "(510)",
  "japan": "(520)"
};

// Common Auxiliaries (Persons -05, Viewpoint .00, Form (0))
const COMMON_AUXILIARIES = {
  "women": "-055.2",
  "female": "-055.2",
  "men": "-055.1",
  "children": "-053.2",
  "students": "-057.87",
  "research": ".001.5",
  "dictionary": "(038)",
  "encyclopedia": "(031)",
  "handbook": "(035)"
};

// Literature Forms
const LIT_FORMS = {
  "poetry": "-1",
  "poems": "-1",
  "drama": "-2",
  "plays": "-2",
  "fiction": "-3",
  "novels": "-3",
  "essays": "-4"
};

function generateUDC(rawText) {
  let text = rawText.toLowerCase().replace(/[^a-z0-9\s\/]/g, " ").replace(/\s+/g, " ").trim();

  // Spelling & Typo Fixes
  text = text.replace(/\bhiger\b/g, "higher");
  text = text.replace(/\bcomputr\b/g, "computer");
  text = text.replace(/\beductaion\b/g, "education");
  text = text.replace(/\band l\b/g, "and logic");
  text = text.replace(/\band co\b/g, "and computers");

  // 1. Biography Rule (e.g., Biography of Dr S.R. Ranganathan -> 929(Ranganathan))
  let bioMatch = text.match(/(?:biography|life)\s+of\s+(?:dr\.?\s*)?([a-z\s\.]+)/i);
  if (bioMatch) {
    let nameParts = bioMatch[1].trim().split(' ');
    let nameKey = nameParts[nameParts.length - 1];
    let personName = nameKey.charAt(0).toUpperCase() + nameKey.slice(1);
    return {
      code: "929(" + personName + ")",
      description: "Individual Biography following UDC standards",
      breakdown: [
        { part: "929", label: "Biographies class" },
        { part: "(" + personName + ")", label: "Individual person auxiliary" }
      ]
    };
  }

  // 2. Literature + Form Rule (e.g., English drama -> 820-2)
  let langMatch = null;
  if (text.includes("english")) langMatch = { code: "820", name: "English literature" };
  else if (text.includes("french")) langMatch = { code: "840", name: "French literature" };
  else if (text.includes("german")) langMatch = { code: "830", name: "German literature" };
  else if (text.includes("hindi")) langMatch = { code: "891.43", name: "Hindi literature" };
  else if (text.includes("punjabi")) langMatch = { code: "891.42", name: "Punjabi literature" };

  let formMatchKey = null;
  for (let fKey in LIT_FORMS) {
    if (new RegExp("\\b" + fKey + "\\b", "i").test(text)) {
      formMatchKey = fKey;
      break;
    }
  }

  if (langMatch && formMatchKey) {
    let formCode = LIT_FORMS[formMatchKey];
    return {
      code: langMatch.code + formCode,
      description: langMatch.name + " - " + formMatchKey,
      breakdown: [
        { part: langMatch.code, label: langMatch.name },
        { part: formCode, label: "Literature form: " + formMatchKey }
      ]
    };
  }

  // 3. Extract Place Auxiliary
  let foundPlace = null;
  for (let placeKey in PLACE_AUXILIARIES) {
    if (new RegExp("\\b" + placeKey + "\\b", "i").test(text)) {
      foundPlace = { name: placeKey, code: PLACE_AUXILIARIES[placeKey] };
      text = text.replace(new RegExp("\\b" + placeKey + "\\b", "i"), " ");
      break;
    }
  }

  // 4. Dynamic History Rule (e.g., History of India -> 94(540))
  if (text.includes("history") && foundPlace) {
    return {
      code: "94" + foundPlace.code,
      description: "History of " + foundPlace.name.charAt(0).toUpperCase() + foundPlace.name.slice(1),
      breakdown: [
        { part: "94", label: "History main class" },
        { part: foundPlace.code, label: "Place auxiliary for " + foundPlace.name }
      ]
    };
  }

  // 5. Extract Common Auxiliaries (Persons, Viewpoints, Forms)
  let foundAux = [];
  for (let auxKey in COMMON_AUXILIARIES) {
    if (new RegExp("\\b" + auxKey + "\\b", "i").test(text)) {
      foundAux.push({ code: COMMON_AUXILIARIES[auxKey], label: auxKey });
      text = text.replace(new RegExp("\\b" + auxKey + "\\b", "i"), " ");
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

  // Clean general '001' if specific subjects exist (unless explicitly part of knowledge list)
  if (foundBases.length > 1 && !text.includes("knowledge")) {
    let hasSpecific = foundBases.some(b => b.code !== "001");
    if (hasSpecific) {
      foundBases = foundBases.filter(b => b.code !== "001");
    }
  }

  // 7. Stroke (/) Sign for Ranges or Extensions (e.g., X to Y)
  if (text.includes(" to ") || text.includes(" through ") || text.includes("/")) {
    if (foundBases.length >= 2) {
      let codes = foundBases.map(b => b.code);
      let parts = foundBases.map(b => ({ part: b.code, label: b.term }));
      return {
        code: codes[0] + "/" + codes[codes.length - 1],
        description: "Continuous range/extension using Stroke sign (/)",
        breakdown: parts
      };
    }
  }

  // 8. Synthesis: Plus (+) for independent coordinate subjects, Colon (:) for compound/interacting subjects
  if (foundBases.length >= 2) {
    let isCoordination = text.includes(" and ") || text.includes(",") || foundBases.length > 2;
    let sign = isCoordination ? " + " : ":";
    let codes = foundBases.map(b => b.code);
    let parts = foundBases.map(b => ({ part: b.code, label: b.term }));

    if (foundPlace) {
      codes[codes.length - 1] += foundPlace.code;
      parts.push({ part: foundPlace.code, label: "Place: " + foundPlace.name });
    }

    return {
      code: codes.join(sign),
      description: "Synthesized UDC number using sign (" + sign.trim() + ")",
      breakdown: parts
    };
  }

  // 9. Single Subject + Place + Auxiliaries
  if (foundBases.length === 1) {
    let code = foundBases[0].code;
    let parts = [{ part: foundBases[0].code, label: foundBases[0].term }];
    
    if (foundPlace) {
      code += foundPlace.code;
      parts.push({ part: foundPlace.code, label: "Place: " + foundPlace.name });
    }

    for (let i = 0; i < foundAux.length; i++) {
      code += foundAux[i].code;
      parts.push({ part: foundAux[i].code, label: foundAux[i].label });
    }

    return {
      code: code,
      description: "Classified subject with geographic and auxiliary facets",
      breakdown: parts
    };
  }

  return {
    code: "001",
    description: "Science and knowledge in general (Fallback)",
    breakdown: [{ part: "001", label: "General knowledge" }]
  };
}

// Web Interface UI
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
        <p>Comprehensive Universal UDC Engine (Classes 0–9)</p>
        <input type="text" id="subject" placeholder="e.g. History of India, Higher education and computers">
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

// API Endpoint
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
