const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 1. UDC 1961 RULES DICTIONARY
// ==========================================
const UDC_1961_RULES = {
    // Main Classes
    "philosophy": "1", "psychology": "159.9",
    "religion": "2", "theology": "2",
    "social": "3", "sociology": "316", "politics": "32", "economics": "33",
    "law": "34", "education": "37", "anthropology": "39",
    "language": "8", "linguistics": "81", "literature": "82",
    "science": "5", "mathematics": "51", "physics": "53", "chemistry": "54",
    "biology": "57", "botany": "58", "zoology": "59", "environment": "502",
    "technology": "6", "medicine": "61", "engineering": "62", "agriculture": "63",
    "arts": "7", "painting": "75", "music": "78", "sports": "79", "photography": "77",
    "history": "9", "geography": "91", "biography": "92", "archaeology": "902",
    
    // Philosophy (Detailed)
    "knowledge": "001", "epistemology": "001", "theory of knowledge": "001",
    "metaphysics": "11", "ontology": "111", "being": "111", "reality": "111",
    "logic": "16", "reasoning": "16", "ethics": "17", "morality": "17",
    "aesthetics": "18",
    
    // Religion (Detailed)
    "christianity": "27", "islam": "28", "hinduism": "233", "buddhism": "24",
    "sikhism": "233", "judaism": "26",
    
    // Language (Detailed)
    "english": "811", "hindi": "821", "punjabi": "821", "sanskrit": "811",
    
    // Technology (Detailed)
    "computer": "004", "artificial intelligence": "004.8", "internet": "004.7",
    
    // History (Detailed)
    "india": "94(540)", "indian": "94(540)", "punjab": "94(540)",
    "gandhi": "929", "nehru": "929", "british": "94(410)",
    
    // General
    "general": "0", "computer science": "004", "information": "002",
    "library": "02", "journalism": "070", "management": "005"
};

// ==========================================
// 2. DDC 23 RULES DICTIONARY
// ==========================================
const DDC_23_RULES = {
    // Main Classes
    "philosophy": "100", "psychology": "150",
    "religion": "200", "theology": "200",
    "social": "300", "sociology": "301", "politics": "320", "economics": "330",
    "law": "340", "education": "370", "anthropology": "301",
    "language": "400", "linguistics": "410", "literature": "800",
    "science": "500", "mathematics": "510", "physics": "530", "chemistry": "540",
    "biology": "570", "botany": "580", "zoology": "590", "environment": "577",
    "technology": "600", "medicine": "610", "engineering": "620", "agriculture": "630",
    "arts": "700", "painting": "750", "music": "780", "sports": "790", "photography": "770",
    "history": "900", "geography": "910", "biography": "920", "archaeology": "930",
    
    // Philosophy (Detailed)
    "knowledge": "121", "epistemology": "121", "theory of knowledge": "121",
    "metaphysics": "110", "ontology": "111", "being": "111", "reality": "111",
    "logic": "160", "reasoning": "160", "ethics": "170", "morality": "170",
    "aesthetics": "180",
    
    // Religion (Detailed)
    "christianity": "230", "islam": "297", "hinduism": "294.5", "buddhism": "294.3",
    "sikhism": "294.6", "judaism": "296",
    
    // Language (Detailed)
    "english": "420", "hindi": "491.43", "punjabi": "491.42", "sanskrit": "491.2",
    
    // Technology (Detailed)
    "computer": "004", "artificial intelligence": "006.3", "internet": "004.678",
    
    // History (Detailed)
    "india": "954", "indian": "954", "punjab": "954.552",
    "gandhi": "954.035", "nehru": "954.042", "british": "941",
    
    // General
    "general": "000", "computer science": "004", "information": "020",
    "library": "020", "journalism": "070", "management": "650"
};

// ==========================================
// 3. KEYWORD EXTRACTOR
// ==========================================
function extractKeywords(query) {
    const stopWords = new Set(["and", "or", "the", "of", "in", "a", "an", "to", "for", "with", "on", "by"]);
    
    return query
        .toLowerCase()
        .replace(/,/g, " ")
        .replace(/&/g, " ")
        .split(/\s+/)
        .map(w => w.trim())
        .filter(w => w.length > 0 && !stopWords.has(w));
}

// ==========================================
// 4. MAIN CLASSIFIER LOGIC
// ==========================================
function getClassification(query, standard) {
    const keywords = extractKeywords(query);
    const rules = standard.toUpperCase() === "UDC" ? UDC_1961_RULES : DDC_23_RULES;
    const standardName = standard.toUpperCase() === "UDC" ? "UDC 1961" : "DDC 23";
    
    const finalNumbers = [];
    const auditLog = [];
    let errorFound = false;
    
    for (const word of keywords) {
        if (rules[word]) {
            const num = rules[word];
            if (!finalNumbers.includes(num)) {
                finalNumbers.push(num);
                auditLog.push(`✅ '${word}' -> ${num}`);
            } else {
                auditLog.push(`⏭️ '${word}' -> ${num} (already added)`);
            }
        } else {
            errorFound = true;
            auditLog.push(`❌ '${word}' -> NOT FOUND`);
        }
    }
    
    if (errorFound || finalNumbers.length === 0) {
        return {
            status: "ERROR",
            message: "Some keywords were not found in the dictionary. Manual check required.",
            standard: standardName,
            audit: auditLog,
            final_answer: "MANUAL CHECK"
        };
    }
    
    const answer = finalNumbers.length > 1 ? finalNumbers.join(" + ") : finalNumbers[0];
    return {
        status: "SUCCESS",
        message: "Classification successful.",
        standard: standardName,
        audit: auditLog,
        final_answer: answer
    };
}

// ==========================================
// 5. API ROUTES
// ==========================================
app.post('/api/classify', (req, res) => {
    const { query, standard } = req.body;
    
    if (!query || !standard) {
        return res.status(400).json({
            status: "ERROR",
            message: "Query and standard are required.",
            audit: [],
            final_answer: "MANUAL CHECK"
        });
    }
    
    const result = getClassification(query, standard);
    res.json(result);
});

// ==========================================
// 6. START SERVER
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ UDC & DDC Classifier running on port ${PORT}`);
});
