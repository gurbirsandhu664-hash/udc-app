import os
from flask import Flask, request, jsonify, render_template_string

# ==========================================
# 1. RULE-BASED DICTIONARY (Sahi Numbers)
# ==========================================
UDC_1961_RULES = {
    # Philosophy
    "knowledge": "001", "epistemology": "001", "theory of knowledge": "001",
    "metaphysics": "11", "ontology": "111", "being": "111", "reality": "111",
    "logic": "16", "reasoning": "16", "philosophy": "1", "ethics": "17",
    "morality": "17", "aesthetics": "18", "psychology": "159.9",
    
    # Religion
    "religion": "2", "christianity": "27", "islam": "28", "hinduism": "233",
    "buddhism": "24", "sikhism": "233", "judaism": "26", "theology": "2",
    
    # Social Sciences
    "social": "3", "sociology": "316", "politics": "32", "economics": "33",
    "law": "34", "education": "37", "anthropology": "39",
    
    # Language & Literature
    "language": "8", "linguistics": "81", "literature": "82", "english": "811",
    "hindi": "821", "punjabi": "821", "sanskrit": "811",
    
    # Science
    "science": "5", "mathematics": "51", "physics": "53", "chemistry": "54",
    "biology": "57", "botany": "58", "zoology": "59", "environment": "502",
    
    # Technology
    "technology": "6", "medicine": "61", "engineering": "62", "agriculture": "63",
    "computer": "004", "artificial intelligence": "004.8", "internet": "004.7",
    
    # Arts
    "arts": "7", "painting": "75", "music": "78", "sports": "79", "photography": "77",
    
    # History & Geography
    "history": "9", "geography": "91", "biography": "92", "archaeology": "902",
    "india": "94(540)", "indian": "94(540)", "punjab": "94(540)",
    "gandhi": "929", "nehru": "929", "british": "94(410)",
    
    # General
    "general": "0", "computer science": "004", "information": "002",
    "library": "02", "journalism": "070", "management": "005"
}

DDC_23_RULES = {
    # Philosophy
    "knowledge": "121", "epistemology": "121", "theory of knowledge": "121",
    "metaphysics": "110", "ontology": "111", "being": "111", "reality": "111",
    "logic": "160", "reasoning": "160", "philosophy": "100", "ethics": "170",
    "morality": "170", "aesthetics": "180", "psychology": "150",
    
    # Religion
    "religion": "200", "christianity": "230", "islam": "297", "hinduism": "294.5",
    "buddhism": "294.3", "sikhism": "294.6", "judaism": "296", "theology": "200",
    
    # Social Sciences
    "social": "300", "sociology": "301", "politics": "320", "economics": "330",
    "law": "340", "education": "370", "anthropology": "301",
    
    # Language & Literature
    "language": "400", "linguistics": "410", "literature": "800", "english": "420",
    "hindi": "491.43", "punjabi": "491.42", "sanskrit": "491.2",
    
    # Science
    "science": "500", "mathematics": "510", "physics": "530", "chemistry": "540",
    "biology": "570", "botany": "580", "zoology": "590", "environment": "577",
    
    # Technology
    "technology": "600", "medicine": "610", "engineering": "620", "agriculture": "630",
    "computer": "004", "artificial intelligence": "006.3", "internet": "004.678",
    
    # Arts
    "arts": "700", "painting": "750", "music": "780", "sports": "790", "photography": "770",
    
    # History & Geography
    "history": "900", "geography": "910", "biography": "920", "archaeology": "930",
    "india": "954", "indian": "954", "punjab": "954.552",
    "gandhi": "954.035", "nehru": "954.042", "british": "941",
    
    # General
    "general": "000", "computer science": "004", "information": "020",
    "library": "020", "journalism": "070", "management": "650"
}

# ==========================================
# 2. KEYWORD EXTRACTOR (NO AI - PURE PYTHON)
# ==========================================
def extract_keywords(query):
    """
    Simple rule: 'and', ',', te spaces ton title nu todo.
    """
    # 'and', 'or', 'the' jaise words hatao
    stop_words = {"and", "or", "the", "of", "in", "a", "an", "to", "for", "with", "on", "by"}
    
    # Title nu words vich todo
    words = query.lower().replace(",", " ").replace("&", " ").split()
    
    keywords = []
    for w in words:
        w = w.strip()
        if w and w not in stop_words:
            keywords.append(w)
    
    return keywords

# ==========================================
# 3. MAIN CLASSIFIER LOGIC (PURE RULE-BASED)
# ==========================================
def get_classification(query, standard="UDC"):
    keywords = extract_keywords(query)
    
    rules = UDC_1961_RULES if standard.upper() == "UDC" else DDC_23_RULES
    standard_name = "UDC 1961" if standard.upper() == "UDC" else "DDC 23"
    
    final_numbers = []
    audit_log = []
    error_found = False
    
    for word in keywords:
        if word in rules:
            num = rules[word]
            if num not in final_numbers:
                final_numbers.append(num)
                audit_log.append(f"✅ '{word}' -> {num}")
            else:
                audit_log.append(f"⏭️ '{word}' -> {num} (already added)")
        else:
            error_found = True
            audit_log.append(f"❌ '{word}' -> NOT FOUND")
    
    if error_found or not final_numbers:
        return {
            "status": "ERROR",
            "message": "Kuch keywords dictionary vich nahi mile. Manual check karo.",
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
# 4. FLASK APP
# ==========================================
app = Flask(__name__)

HTML_PAGE = """
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UDC & DDC Classifier</title>
    <style>
        body { font-family: Arial, sans-serif; background: #f0f0ff; padding: 20px; }
        .container { max-width: 500px; margin: auto; background: white; padding: 20px; border-radius: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        h2 { color: #5a3eb5; text-align: center; }
        h4 { color: #666; text-align: center; margin-top: -10px; }
        input, select { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #ccc; border-radius: 8px; box-sizing: border-box; }
        button { width: 100%; padding: 14px; background: #5a3eb5; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; }
        button:hover { background: #48309b; }
        .result-box { margin-top: 20px; padding: 15px; background: #f9f9f9; border-radius: 10px; border: 1px solid #ddd; }
        .success { color: green; font-weight: bold; }
        .error { color: red; font-weight: bold; }
        .audit { font-size: 13px; color: #555; margin-top: 10px; line-height: 1.6; }
        .manual-box { margin-top: 15px; padding: 15px; background: #fff3cd; border-radius: 10px; border: 1px solid #ffc107; display: none; }
    </style>
</head>
<body>
    <div class="container">
        <h2>UDC & DDC Classifier</h2>
        <h4>LIVE UDC 1961 & DDC 23 STANDARD</h4>
        
        <label><b>ENTER YOUR FULL QUERY</b></label>
        <input type="text" id="queryInput" placeholder="e.g. Knowledge and Metaphysics and Logic">
        
        <label><b>STANDARD</b></label>
        <select id="standardInput">
            <option value="UDC">UDC 1961</option>
            <option value="DDC">DDC 23</option>
        </select>
        
        <button onclick="getClassification()">Get Classification</button>
        
        <div id="resultBox"></div>
        
        <div id="manualBox" class="manual-box">
            <p><b>⚠️ Manual Check Required:</b></p>
            <p style="font-size:13px;">Kuch keywords dictionary vich nahi mile. Khud number pao:</p>
            <input type="text" id="manualInput" placeholder="Enter number (e.g. 001 + 11 + 16)">
            <button onclick="saveManual()" style="background:#ffc107; color:#000;">Save Manual Answer</button>
        </div>
    </div>

    <script>
        let currentStandard = 'UDC';
        
        async function getClassification() {
            const query = document.getElementById('queryInput').value;
            const standard = document.getElementById('standardInput').value;
            const resultBox = document.getElementById('resultBox');
            const manualBox = document.getElementById('manualBox');
            
            currentStandard = standard;
            manualBox.style.display = 'none';
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
                manualBox.style.display = 'block';
            }
        }
        
        function saveManual() {
            const manualValue = document.getElementById('manualInput').value;
            const resultBox = document.getElementById('resultBox');
            
            if (!manualValue) {
                alert("Pehla number pao!");
                return;
            }
            
            resultBox.innerHTML = `
                <div class="result-box">
                    <p><b>${currentStandard === 'UDC' ? 'UDC 1961' : 'DDC 23'}</b></p>
                    <p class="success" style="font-size:24px;">${manualValue}</p>
                    <p style="color:orange; font-size:12px;">⚠️ Manual Entry</p>
                </div>
            `;
            document.getElementById('manualBox').style.display = 'none';
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
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
