const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = "gemini-1.5-flash";

const CONFIG = {
  version: "27",
  appTitle: "UDC AI V27"
};

app.get("/", function (req, res) {
  const page = [
    "<!DOCTYPE html>",
    "<html>",
    "<head>",
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    "<title>UDC AI V27</title>",
    "<style>",
    "body{margin:0;font-family:Arial;background:#f4f7fb;color:#172033}",
    ".container{max-width:800px;margin:auto;padding:20px}",
    ".header{background:#172033;color:white;padding:25px;border-radius:16px}",
    ".card{background:white;padding:22px;margin-top:20px;border-radius:16px}",
    "textarea{width:100%;height:130px;padding:12px;font-size:16px;box-sizing:border-box;border:1px solid #ccc;border-radius:10px}",
    "button{width:100%;padding:15px;margin-top:12px;background:#172033;color:white;border:0;border-radius:10px;font-size:17px;font-weight:bold}",
    ".result{display:none;margin-top:20px}",
    ".udc{font-size:38px;font-weight:bold;margin:10px 0}",
    "#error{color:#b00020;margin-top:15px}",
    "</style>",
    "</head>",
    "<body>",
    '<div class="container">',
    '<div class="header">',
    "<b>VERSION 27</b>",
    "<h1>UDC AI Classifier</h1>",
    "<div>Universal Decimal Classification - Never DDC</div>",
    "</div>",
    '<div class="card">',
    "<b>Enter Book Title</b>",
    '<textarea id="question" placeholder="Example: History of India"></textarea>',
    '<button id="btn" onclick="classifyBook()">CLASSIFY BOOK</button>',
    '<div id="loading" style="display:none;margin-top:15px">Classifying...</div>',
    '<div id="error"></div>',
    '<div id="result" class="result">',
    "<h2>Classification Result</h2>",
    "<p><b>Book Title</b></p>",
    '<div id="title"></div>',
    "<p><b>FINAL UDC NUMBER</b></p>",
    '<div id="udc" class="udc">-</div>',
    "<p><b>AI Answer</b></p>",
    '<div id="answer"></div>',
    "</div>",
    "</div>",
    "</div>",
    "<script>",
    "async function classifyBook(){",
    "var q=document.getElementById('question').value.trim();",
    "var btn=document.getElementById('btn');",
    "var loading=document.getElementById('loading');",
    "var error=document.getElementById('error');",
    "var result=document.getElementById('result');",
    "if(!q){error.textContent='Please enter a book title.';return;}",
    "error.textContent='';",
    "result.style.display='none';",
    "loading.style.display='block';",
    "btn.disabled=true;",
    "try{",
    "var r=await fetch('/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q})});",
    "var data=await r.json();",
    "if(!r.ok){throw new Error(data.error||'Server error');}",
    "document.getElementById('title').textContent=q;",
    "document.getElementById('answer').textContent=data.answer||'No answer';",
    "var m=(data.answer||'').match(/\\b\\d{1,3}(?:\\.\\d+)*(?:\\([^)]*\\))?/);",
    "document.getElementById('udc').textContent=m?m[0]:'See AI Answer';",
    "result.style.display='block';",
    "}catch(e){error.textContent=e.message;}",
    "loading.style.display='none';",
    "btn.disabled=false;",
    "}",
    "</script>",
    "</body>",
    "</html>"
  ].join("\n");

  res.send(page);
});

app.get("/api/config", function (req, res) {
  res.json(CONFIG);
});

app.get("/health", function (req, res) {
  res.json({ status: "ok", version: "27" });
});

app.post("/api/ask", async function (req, res) {
  try {
    const question = String(req.body.question || "").trim();

    if (!question) {
      return res.status(400).json({ error: "Question required" });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing in Render Environment Variables."
      });
    }

    const prompt =
      "You are a Universal Decimal Classification UDC expert. " +
      "Use UDC, NEVER DDC. Understand the complete meaning of the book title. " +
      "Give the most appropriate UDC number. " +
      "Return FINAL UDC NUMBER, MAIN SUBJECT and SHORT EXPLANATION. " +
      "Book title: " + question;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" +
        GEMINI_MODEL +
        ":generateContent?key=" +
        encodeURIComponent(GEMINI_API_KEY),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data && data.error && data.error.message
            ? data.error.message
            : "Gemini API error"
      });
    }

    const answer =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0]
        ? data.candidates[0].content.parts[0].text
        : "No answer received.";

    res.json({ answer: answer, version: "27" });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message || "Internal server error"
    });
  }
});

app.listen(PORT, function () {
  console.log("UDC AI V27 Running on port " + PORT);
});
