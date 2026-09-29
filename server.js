
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const CONFIG = {
  version: "27",
  appTitle: "UDC AI V27",
  systemPrompt:
    "You are a Universal Decimal Classification (UDC) expert. Classify the user's book title using UDC, not DDC. Give the most appropriate UDC number, main subject, and a short explanation. If the exact number cannot be verified, clearly say so."
};

// IMPORTANT: Put your real Gemini API key in Render Environment Variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const GEMINI_MODEL = "gemini-1.5-flash";

const GEMINI_URL =
  https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=;

// ---------------- HOME PAGE ----------------

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>UDC AI V27</title>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Arial, sans-serif;
  background: #f4f7fb;
  color: #172033;
}

.container {
  max-width: 850px;
  margin: 0 auto;
  padding: 25px 18px 50px;
}

.header {
  background: #172033;
  color: white;
  padding: 24px;
  border-radius: 18px;
  margin-bottom: 22px;
}

.header h1 {
  margin: 0 0 8px;
  font-size: 28px;
}

.badge {
  display: inline-block;
  background: #ffffff;
  color: #172033;
  padding: 6px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: bold;
}

.card {
  background: white;
  padding: 22px;
  border-radius: 18px;
  box-shadow: 0 5px 20px rgba(0,0,0,0.08);
}

label {
  display: block;
  font-weight: bold;
  margin-bottom: 10px;
}

textarea {
  width: 100%;
  min-height: 130px;
  border: 1px solid #ccd3df;
  border-radius: 12px;
  padding: 15px;
  font-size: 16px;
  resize: vertical;
  outline: none;
}

textarea:focus {
  border-color: #172033;
}

button {
  width: 100%;
  margin-top: 15px;
  padding: 15px;
  border: 0;
  border-radius: 12px;
  background: #172033;
  color: white;
  font-size: 17px;
  font-weight: bold;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
}

.result {
  margin-top: 22px;
  display: none;
}

.udc {
  font-size: 38px;
  font-weight: bold;
  margin: 12px 0;
  color: #172033;
}

.row {
  padding: 12px 0;
  border-bottom: 1px solid #e6e9ef;
}

.row strong {
  display: block;
  margin-bottom: 5px;
}

.loading {
  text-align: center;
  padding: 15px;
  display: none;
}

.error {
  color: #b00020;
  background: #fff0f2;
  padding: 12px;
  border-radius: 10px;
  margin-top: 15px;
  display: none;
}
</style>
</head>

<body>

<div class="container">

  <div class="header">
    <span class="badge">VERSION 27</span>
    <h1>UDC AI Classifier</h1>
    <div>Universal Decimal Classification • Never DDC</div>
  </div>

  <div class="card">

    <label for="question">Enter Book Title</label>

    <textarea
      id="question"
      placeholder="Example: History of India"
    ></textarea>

    <button id="classifyBtn" onclick="classifyBook()">
      CLASSIFY BOOK
    </button>

    <div id="loading" class="loading">
      Classifying with UDC AI...
    </div>

    <div id="error" class="error"></div>

    <div id="result" class="result">

      <h2>Classification Result</h2>

      <div class="row">
        <strong>Book Title</strong>
        <span id="bookTitle"></span>
      </div>

      <div class="row">
        <strong>FINAL UDC NUMBER</strong>
        <div id="udcNumber" class="udc"></div>
      </div>

      <div class="row">
        <strong>Main Subject</strong>
        <span id="mainSubject"></span>
      </div>

      <div class="row">
        <strong>Explanation</strong>
        <span id="explanation"></span>
      </div>

      <div class="row">
        <strong>AI Answer</strong>
        <div id="fullAnswer"></div>
      </div>

    </div>

  </div>
</div>

<script>

async function classifyBook() {

  const question =
    document.getElementById("question").value.trim();

  const result =
    document.getElementById("result");

  const error =
    document.getElementById("error");

  const loading =
    document.getElementById("loading");

  const button =
    document.getElementById("classifyBtn");

  if (!question) {
    error.textContent = "Please enter a book title.";
    error.style.display = "block";
    return;
  }

  error.style.display = "none";
  result.style.display = "none";
  loading.style.display = "block";
  button.disabled = true;

  try {

    const response = await fetch("/api/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: question
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Server error");
    }

    document.getElementById("bookTitle").textContent =
      question;

    document.getElementById("fullAnswer").textContent =
      data.answer || "No answer received.";

    // Try to extract UDC number from AI response
    const match =
      (data.answer || "").match(
        /(?:UDC\\s*(?:NUMBER)?\\s*[:=-]?\\s*)?([0-9]{1,3}(?:\\.[0-9]+)?(?:\$begin:math:text$\[\^\)\]\*\\$end:math:text$)?)/i
      );

    document.getElementById("udcNumber").textContent =
      match ? match[1] : "See AI Answer";

    document.getElementById("mainSubject").textContent =
      "See AI classification";

    document.getElementById("explanation").textContent =
      "Classification generated using the UDC-focused system prompt.";

    result.style.display = "block";

  } catch (err) {

    error.textContent =
      err.message || "Something went wrong.";

    error.style.display = "block";

  } finally {

    loading.style.display = "none";
    button.disabled = false;

  }
}

</script>

</body>
</html>
  `);
});

// ---------------- API CONFIG ----------------

app.get("/api/config", (req, res) => {
  res.json(CONFIG);
});

// ---------------- AI API ----------------

app.post("/api/ask", async (req, res) => {

  try {

    const { question } = req.body;

    if (!question) {
      return res.status(400).json({
        error: "Question required"
      });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        error:
          "Gemini API key is not configured on Render."
      });
    }

    const finalPrompt =
`${CONFIG.systemPrompt}

Book title / question:
${question}

Return:
1. FINAL UDC NUMBER
2. Main Subject
3. Short Explanation

Do not use DDC.`;

    const response = await fetch(
      GEMINI_URL + GEMINI_API_KEY,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: finalPrompt
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data.error?.message ||
          "Gemini API error"
      });
    }

    const answer =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No answer received.";

    res.json({
      answer: answer,
      version: CONFIG.version
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: error.message
    });

  }

});

// ---------------- START SERVER ----------------

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(UDC AI V${CONFIG.version} Running on port ${PORT});
});
