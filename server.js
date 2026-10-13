async function gemini(title, referenceEvidence = "", udcReferenceEvidence = "") {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY is missing in environment variables.");
  
  const body = {
    contents: [{
      role: "user",
      parts: [{
        text: `${UDC_RULES}
Classify this complete book title: "${title}".
DDC-23 Reference Excerpts:
${referenceEvidence || "None supplied."}

UDC B.S. 1000A:1961 Reference Excerpts:
${udcReferenceEvidence || "None supplied."}

Perform a high-accuracy classification. Provide exact 'udc_number' and 'ddc_number'. JSON format only.`
      }]
    }],
    generationConfig: {
      temperature: 0.0,
      responseMimeType: "application/json",
      responseSchema: schema,
      maxOutputTokens: 1600
    }
  };

  const ac = new AbortController();
  const tm = setTimeout(() => ac.abort(), 28000);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(DEFAULT_MODEL)}:generateContent`;
    const r = await fetch(url, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_KEY
      },
      body: JSON.stringify(body),
      signal: ac.signal
    });
    
    const txt = await r.text();
    let j;
    try { j = JSON.parse(txt); } catch { throw Error("Bad Gemini response"); }
    if (!r.ok) throw Error(j?.error?.message || `Gemini HTTP ${r.status}`);

    const rawContent = j?.candidates?.[0]?.content?.parts?.map(x => x.text || "").join("");
    const parsed = parseJSON(rawContent);
    const validated = validate(parsed, title);
    return { ...validated, engine: "Gemini 2.5 Flash", model: DEFAULT_MODEL, grounded: true };
  } finally {
    clearTimeout(tm);
  }
}
