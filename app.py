import json
import requests
from flask import Flask, request, jsonify, render_template_string

# ==========================================
# 1. DEEPSEEK API CONFIG
# ==========================================
DEEPSEEK_API_KEY = "YOUR_API_KEY_HERE"  # <-- ETTE APNI API KEY PAO
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"

# ==========================================
# 2. RULE-BASED DICTIONARY (Sahi Numbers)
# ==========================================
UDC_1961_RULES = {
    "knowledge": "001", "epistemology": "001", "metaphysics": "11",
    "logic": "16", "philosophy": "1", "psychology": "159.9",
    "ethics": "17", "religion": "2", "social": "3", "language": "8",
    "science": "5", "technology": "6", "arts": "7", "history": "9"
}

DDC_23_RULES = {
    "knowledge": "121", "epistemology": "121", "metaphysics": "110",
    "logic": "160", "philosophy": "100", "psychology": "150",
    "ethics": "170", "religion": "200", "social": "300", "language": "400",
    "science": "500", "technology": "600", "arts": "700", "history": "900"
}

# ==========================================
# 3. AI TON SIRF KEYWORDS KADHO
# ==========================================
def extract_keywords_from_ai(query):
    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json"
    }
    prompt = f"""
    You are a strict librarian. Extract ONLY the main subjects/topics from the user's query.
    DO NOT assign any classification numbers.
    Return the result as a valid JSON list of strings.
    If a subject is unclear, return "UNKNOWN".
    
    User Query: "{query}"
    Example Output format: ["knowledge", "metaphysics", "logic"]
    """
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": "You are a helpful librarian assistant."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.0,
        "response_format": {"type": "json_object"}
    }
    try:
        response = requests.post(DEEPSEEK_API_URL, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
        content = data['choices'][0]['message']['content']
        parsed = json.loads(content)
        if isinstance(parsed, list):
            return parsed
        elif isinstance(parsed, dict) and "subjects" in parsed:
            return parsed["subjects"]
        else:
            return ["UNKNOWN"]
    except Exception as e:
        print(f"AI Error: {e}")
        return ["UNKNOWN"]

# ==========================================
# 4. MAIN CLASSIFIER LOGIC (Zero-Error)
# ==========================================
def get_classification(query, standard="UDC"):
    keywords = extract_keywords_from_ai(query)
    rules = UDC_1961_RULES if standard.upper() == "UDC" else DDC_23_RULES
    standard_name = "UDC 1961" if standard.upper() == "UDC" else "DDC 23"
    
    final_numbers = []
    audit_log = []
    error_found = False
    
    for word in keywords:
        word_clean = str(word).strip().lower()
        if word_clean in rules:
            num = rules[word_clean]
            final_numbers.append(num)
            audit_log.append(f"✅ '{word}' -> {num}")
        else:
            error_found = True
            audit_log.append(f"❌ '{word}' -> NO RULE FOUND (Manual Check Required)")
    
    if error_found or not final_numbers:
        return {
            "status": "ERROR",
            "message": "Kuch title dictionary vich nahi mile. Manual check karo.",
            "standard": standard_name,
            "audit": audit_log,
            "final_answer": "MANUAL CHECK"
        }
    
    answer = " + ".join(final_numbers) if len(final_numbers) > 1 else final_numbers[0]
    return {
        "status": "SUCCESS",
        "message": "Sahi classification mil gayi.",
        "standard": standard_name,
        "audit": audit_log,
        "final_answer": answer
    }

# ==========================================
# 5. FLASK APP (Frontend + Backend)
# ==========================================
app = Flask(__name__)

# HTML Code (Frontend) - Eh file vich hi hai
HTML_PAGE = """
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DeepSeek AI Classifier</title>
    <style>
        body { font-family: Arial, sans-serif; background: #f0f0ff; padding: 20px; }
        .container { max-width: 500px; margin: auto; background: white; padding: 20px; border-radius: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        h2 { color: #5a3eb5; text-align: center; }
        h4 { color: #666; text-align: center; margin-top: -10px; }
        input { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #ccc; border-radius: 8px; box-sizing: border-box; }
        button { width: 100%; padding: 14px; background: #5a3eb5; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; }
        button:hover { background: #48309b; }
        .result-box { margin-top: 20px; padding: 15px; background: #f9f9f9; border-radius: 10px; border: 1px solid #ddd; }
        .success { color: green; font-weight: bold; }
        .error { color: red; font-weight: bold; }
        .audit { font-size: 13px; color: #555; margin-top: 10px; line-height: 1.6; }
    </style>
</head>
<body>
    <div class="container">
        <h2>DeepSeek AI Classifier</h2>
        <h4>LIVE UDC 1961 & DDC 23 STANDARD</h4>
        
        <label><b>ENTER YOUR FULL QUERY</b></label>
        <input type="text" id="queryInput" placeholder="e.g. Knowledge and Metaphysics and Logic">
        
        <label><b>STANDARD</b></label>
        <select id="standardInput" style="width:100%; padding:10px; margin:10px 0; border-radius:8px; border:1px solid #ccc;">
            <option value="UDC">UDC 1961</option>
            <option value="DDC">DDC 23</option>
        </select>
        
        <button onclick="getClassification()">Get Live Classification</button>
        
        <div id="resultBox"></div>
    </div>

    <script>
        async function getClassification() {
            const query = document.getElementById('queryInput').value;
            const standard = document.getElementById('standardInput').value;
            const resultBox = document.getElementById('resultBox');
            
            resultBox.innerHTML = "<p>Loading...</p>";
            
            const response = await fetch('/classify', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({query: query, standard: standard})
            });
            
            const data = await response.json();
            
            if (data.status === 'SUCCESS') {
                resultBox.innerHTML = `
                    <div class="result-box">
                        <p><b>${data.standard}</b></p>
                        <p class="success" style="font-size:24px;">${data.final_answer}</p>
                        <hr>
                        <p class="audit"><b>Audit:</b><br>${data.audit.join('<br>')}</p>
                    </div>
                `;
            } else {
                resultBox.innerHTML = `
                    <div class="result-box">
                        <p class="error">${data.message}</p>
                        <hr>
                        <p class="audit"><b>Audit:</b><br>${data.audit.join('<br>')}</p>
                    </div>
                `;
            }
        }
    </script>
</body>
</html>
"""

@app.route('/')
def home():
    return render_template_string(HTML_PAGE)

@app.route('/classify', methods=['POST'])
def classify():
    data = request.json
    query = data.get('query', '')
    standard = data.get('standard', 'UDC')
    result = get_classification(query, standard)
    return jsonify(result)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
