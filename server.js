const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 10000;
const ROOT = __dirname;

function send(res, status, type, body) {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function json(res, status, data) {
  send(res, status, "application/json; charset=utf-8", JSON.stringify(data));
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s:().+\/-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasWord(text, word) {
  return new RegExp("(^|\\s)" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\s|$)", "i").test(text);
}

function classify(title) {
  const raw = String(title || "").trim();
  const t = normalize(raw);

  if (!t) {
    return {
      title: raw,
      udc: "",
      mainSubject: "Enter a book title",
      subSubject: "",
      explanation: "Please enter a title to classify.",
      confidence: "Low",
      verified: false
    };
  }

  // Exact/common UDC patterns first.
  const exact = [
    ["history of india", "94(540)", "History", "India", "94 = General history; (540) = India.", "High"],
    ["geography of india", "91(540)", "Geography", "India", "91 = Geography; (540) = India.", "High"],
    ["indian constitution", "342(540)", "Law / Constitutional law", "India", "342 = Constitutional law; (540) = India.", "High"],
    ["economy of india", "330(540)", "Economics", "India", "330 = Economics; (540) = India.", "High"],
    ["indian philosophy", "1(540)", "Philosophy", "India", "1 = Philosophy; (540) = India.", "High"],
    ["indian art", "7(540)", "Arts", "India", "7 = Arts; (540) = India.", "High"],
    ["indian literature", "821.21(540)", "Literature", "Indian literature", "821.21 = Indian literature; (540) = India.", "High"],
    ["science and arts", "5+7", "Mathematics and natural sciences + Arts", "Two equally important subjects", "5 = Mathematics and natural sciences; + = coordination; 7 = Arts.", "High"],
    ["science and technology", "5/6", "Mathematics and natural sciences / Applied sciences and technology", "Science and technology", "5 = Mathematics and natural sciences; / = consecutive relationship; 6 = Applied sciences, medicine and technology.", "High"],
    ["heart disease", "616.1", "Pathology / Diseases of the cardiovascular system", "Heart and cardiovascular diseases", "616 = Pathology; .1 = diseases of the cardiovascular system.", "Medium"],
    ["cardiovascular disease", "616.1", "Pathology", "Cardiovascular diseases", "616 = Pathology; .1 = diseases of the cardiovascular system.", "Medium"],
    ["hindi language", "811.21", "Language", "Hindi", "811 = Indo-European languages; .21 = Hindi.", "Medium"],
    ["english language", "811.111", "Language", "English", "811 = Indo-European languages; .111 = English.", "Medium"],
    ["english literature", "821.111", "Literature", "English literature", "821 = Literature of individual languages; .111 = English.", "Medium"]
  ];

  for (const [key, udc, mainSubject, subSubject, explanation, confidence] of exact) {
    if (t === key) {
      return { title: raw, udc, mainSubject, subSubject, explanation, confidence, verified: true };
    }
  }

  // Whole-word subject detection. This prevents "art" matching "heart".
  if (hasWord(t, "heart") || hasWord(t, "cardiac") || hasWord(t, "cardiovascular")) {
    return {
      title: raw,
      udc: "616.1",
      mainSubject: "Pathology",
      subSubject: "Diseases of the cardiovascular system",
      explanation: "The title is about the heart/cardiovascular system. 616 = Pathology; .1 = cardiovascular diseases.",
      confidence: "Medium",
      verified: false
    };
  }

  if (hasWord(t, "disease") || hasWord(t, "diseases") || hasWord(t, "pathology")) {
    return {
      title: raw,
      udc: "616",
      mainSubject: "Pathology",
      subSubject: "Diseases",
      explanation: "616 is the UDC main class for pathology and diseases. A more specific organ/system number should be used when the title identifies it.",
      confidence: "Medium",
      verified: false
    };
  }

  if (hasWord(t, "mathematics") || hasWord(t, "math")) {
    return {
      title: raw,
      udc: "51",
      mainSubject: "Mathematics",
      subSubject: "Mathematics",
      explanation: "51 = Mathematics.",
      confidence: "Medium",
      verified: false
    };
  }

  if (hasWord(t, "physics")) {
    return {
      title: raw,
      udc: "53",
      mainSubject: "Physics",
      subSubject: "Physics",
      explanation: "53 = Physics.",
      confidence: "Medium",
      verified: false
    };
  }

  if (hasWord(t, "chemistry") || hasWord(t, "chemical")) {
    return {
      title: raw,
      udc: "54",
      mainSubject: "Chemistry",
      subSubject: "Chemistry",
      explanation: "54 = Chemistry.",
      confidence: "Medium",
      verified: false
    };
  }

  if (hasWord(t, "biology") || hasWord(t, "botany") || hasWord(t, "zoology")) {
    return {
      title: raw,
      udc: "57",
      mainSubject: "Biological sciences",
      subSubject: "Biology",
      explanation: "57 = Biological sciences.",
      confidence: "Medium",
      verified: false
    };
  }

  if (hasWord(t, "technology") || hasWord(t, "engineering")) {
    return {
      title: raw,
      udc: "6",
      mainSubject: "Applied sciences and technology",
      subSubject: "Technology / engineering",
      explanation: "6 = Applied sciences, medicine and technology. A more specific engineering or technology subdivision should be selected when the title provides enough detail.",
      confidence: "Low",
      verified: false
    };
  }

  if (hasWord(t, "history")) {
    return {
      title: raw,
      udc: "94",
      mainSubject: "History",
      subSubject: "General history",
      explanation: "94 = General history. A place auxiliary can be added when a country or region is specified.",
      confidence: "Medium",
      verified: false
    };
  }

  if (hasWord(t, "geography")) {
    return {
      title: raw,
      udc: "91",
      mainSubject: "Geography",
      subSubject: "General geography",
      explanation: "91 = Geography. A place auxiliary can be added when a country or region is specified.",
      confidence: "Medium",
      verified: false
    };
  }

  if (hasWord(t, "philosophy")) {
    return {
      title: raw,
      udc: "1",
      mainSubject: "Philosophy",
      subSubject: "Philosophy",
      explanation: "1 = Philosophy.",
      confidence: "Medium",
      verified: false
    };
  }

  if (hasWord(t, "art") || hasWord(t, "arts")) {
    return {
      title: raw,
      udc: "7",
      mainSubject: "Arts",
      subSubject: "The arts",
      explanation: "7 = The arts.",
      confidence: "Medium",
      verified: false
    };
  }

  if (hasWord(t, "literature") || hasWord(t, "novel") || hasWord(t, "poetry") || hasWord(t, "drama")) {
    return {
      title: raw,
      udc: "82",
      mainSubject: "Literature",
      subSubject: "Literature",
      explanation: "82 = Literature. Language and literary-form auxiliaries may be required for a more specific classification.",
      confidence: "Low",
      verified: false
    };
  }

  if (hasWord(t, "language") || hasWord(t, "linguistics") || hasWord(t, "linguistic")) {
    return {
      title: raw,
      udc: "81",
      mainSubject: "Language and linguistics",
      subSubject: "Language",
      explanation: "81 = Language and linguistics. A specific language subdivision should be selected when the language is identified.",
      confidence: "Low",
      verified: false
    };
  }

  if (hasWord(t, "law") || hasWord(t, "legal") || hasWord(t, "constitution")) {
    return {
      title: raw,
      udc: "34",
      mainSubject: "Law",
      subSubject: "Legal studies",
      explanation: "34 = Law. More specific legal subdivisions should be used when the title identifies the subject.",
      confidence: "Low",
      verified: false
    };
  }

  if (hasWord(t, "economics") || hasWord(t, "economy") || hasWord(t, "finance") || hasWord(t, "business")) {
    return {
      title: raw,
      udc: "33",
      mainSubject: "Economics",
      subSubject: "Economic sciences",
      explanation: "33 = Economics. A more specific subdivision should be used when the title identifies the economic topic.",
      confidence: "Low",
      verified: false
    };
  }

  if (hasWord(t, "education") || hasWord(t, "teaching") || hasWord(t, "school")) {
    return {
      title: raw,
      udc: "37",
      mainSubject: "Education",
      subSubject: "Education and teaching",
      explanation: "37 = Education.",
      confidence: "Low",
      verified: false
    };
  }

  if (hasWord(t, "religion") || hasWord(t, "theology")) {
    return {
      title: raw,
      udc: "2",
      mainSubject: "Religion and theology",
      subSubject: "Religion",
      explanation: "2 = Religion and theology.",
      confidence: "Low",
      verified: false
    };
  }

  // Never return the old misleading "0 = Science and knowledge" result.
  return {
    title: raw,
    udc: "0",
    mainSubject: "Subject requires further identification",
    subSubject: "General / interdisciplinary",
    explanation: "No sufficiently specific local rule matched this title. The classifier did not invent a specific UDC number.",
    confidence: "Low",
    verified: false
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
      if (data.length > 1024 * 1024) {
        req.destroy();
        reject(new Error("Request too large"));
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");

    if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/api/health")) {
      return json(res, 200, { ok: true, service: "UDC Classifier", version: "V8-fixed" });
    }

    if (req.method === "POST" && (url.pathname === "/api/classify" || url.pathname === "/classify")) {
      const body = await readBody(req);
      let payload = {};
      try { payload = JSON.parse(body || "{}"); } catch (_) {}
      const title = payload.title || payload.bookTitle || payload.query || "";
      return json(res, 200, classify(title));
    }

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      const file = path.join(ROOT, "index.html");
      if (!fs.existsSync(file)) return send(res, 404, "text/plain; charset=utf-8", "index.html not found");
      return send(res, 200, "text/html; charset=utf-8", fs.readFileSync(file));
    }

    // Static assets.
    if (req.method === "GET") {
      const safe = path.normalize(url.pathname).replace(/^(\.\.[\/\\])+/, "");
      const file = path.join(ROOT, safe);
      if (file.startsWith(ROOT) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        const ext = path.extname(file).toLowerCase();
        const types = {
          ".css": "text/css; charset=utf-8",
          ".js": "application/javascript; charset=utf-8",
          ".json": "application/json; charset=utf-8",
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".svg": "image/svg+xml",
          ".ico": "image/x-icon"
        };
        return send(res, 200, types[ext] || "application/octet-stream", fs.readFileSync(file));
      }
    }

    return send(res, 404, "application/json; charset=utf-8", JSON.stringify({ error: "Not found" }));
  } catch (err) {
    console.error(err);
    return json(res, 500, { error: "Server error" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`UDC Classifier V8-fixed listening on ${PORT}`);
});
