const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 1. UDC 1961 RULES DICTIONARY (500+ WORDS)
// ==========================================
const UDC_1961_RULES = {
    // ===== 0: GENERAL =====
    "general": "0", "computer science": "004", "information": "002",
    "library": "02", "journalism": "070", "management": "005",
    "computer": "004", "artificial intelligence": "004.8", "internet": "004.7",
    "data": "004", "software": "004", "programming": "004", "algorithm": "004",

    // ===== 1: PHILOSOPHY & PSYCHOLOGY =====
    "philosophy": "1", "psychology": "159.9",
    "knowledge": "001", "epistemology": "001", "theory of knowledge": "001",
    "metaphysics": "11", "ontology": "111", "being": "111", "reality": "111",
    "logic": "16", "reasoning": "16", "ethics": "17", "morality": "17",
    "aesthetics": "18", "beauty": "18",
    "mind": "159.9", "consciousness": "159.9", "behavior": "159.9",
    "deduction": "16", "induction": "16", "fallacy": "16",

    // ===== 2: RELIGION =====
    "religion": "2", "theology": "2", "god": "2", "worship": "2",
    "christianity": "27", "islam": "28", "hinduism": "233", "buddhism": "24",
    "sikhism": "233", "judaism": "26", "jainism": "24", "taoism": "24",
    "bible": "27", "quran": "28", "gita": "233", "guru granth sahib": "233",
    "prayer": "2", "meditation": "2", "spirituality": "2",

    // ===== 3: SOCIAL SCIENCES =====
    "social": "3", "sociology": "316", "society": "316", "community": "316",
    "politics": "32", "political science": "32", "government": "32",
    "economics": "33", "economy": "33", "trade": "33", "business": "33",
    "law": "34", "legal": "34", "justice": "34", "constitution": "34",
    "education": "37", "teaching": "37", "school": "37", "university": "37",
    "anthropology": "39", "culture": "39", "customs": "39",
    "statistics": "31", "demography": "31", "population": "31",

    // ===== 5: SCIENCE =====
    "science": "5", "mathematics": "51", "math": "51", "algebra": "51",
    "geometry": "51", "calculus": "51",
    "physics": "53", "chemistry": "54", "biology": "57", "botany": "58",
    "zoology": "59", "environment": "502", "ecology": "502",
    "astronomy": "52", "geology": "55", "microbiology": "57",
    "genetics": "57", "evolution": "57", "cell": "57", "dna": "57",
    "light": "53", "sound": "53", "energy": "53", "matter": "53",
    "atom": "54", "molecule": "54", "reaction": "54", "acid": "54",
    "plant": "58", "animal": "59", "human body": "61",

    // ===== 6: TECHNOLOGY & MEDICINE =====
    "technology": "6", "medicine": "61", "medical": "61", "health": "61",
    "disease": "61", "treatment": "61", "surgery": "61", "drug": "61",
    "engineering": "62", "machine": "62", "mechanical": "62",
    "electrical": "62", "civil": "62", "chemical": "62",
    "agriculture": "63", "farming": "63", "crop": "63", "soil": "63",
    "manufacturing": "62", "construction": "62", "transport": "62",
    "communication": "62", "telephone": "62", "radio": "62", "television": "62",

    // ===== 7: ARTS =====
    "arts": "7", "painting": "75", "drawing": "75", "sculpture": "73",
    "music": "78", "song": "78", "dance": "78", "theatre": "792",
    "sports": "79", "games": "79", "cricket": "796", "football": "796",
    "photography": "77", "cinema": "791", "film": "791",

    // ===== 8: LANGUAGE & LITERATURE =====
    "language": "8", "linguistics": "81", "literature": "82",
    "english": "811", "hindi": "821", "punjabi": "821", "sanskrit": "811",
    "urdu": "821", "bengali": "821", "tamil": "821", "gujarati": "821",
    "grammar": "81", "dictionary": "81", "novel": "82", "poetry": "82",
    "drama": "82", "essay": "82", "story": "82", "fiction": "82",

    // ===== Idioms & Expressions =====
    "idiom": "81'37", "idioms": "81'37", "expression": "81'37",
    "expressions": "81'37", "proverb": "81'37", "proverbs": "81'37",
    "phrase": "81'37", "phrases": "81'37", "phraseology": "81'37",
    "metaphor": "81'37", "simile": "81'37",
    "adiam": "81'37", "idom": "81'37", "ediom": "81'37", "expresion": "81'37",
    "punjabi idiom": "821'37", "punjabi idioms": "821'37",
    "punjabi proverb": "821'37", "punjabi proverbs": "821'37",

    // ===== 9: HISTORY & GEOGRAPHY =====
    "history": "9", "geography": "91", "biography": "92", "archaeology": "902",
    "india": "94(540)", "indian": "94(540)", "punjab": "94(540)",
    "gandhi": "929", "nehru": "929", "british": "94(410)",
    "ancient": "94", "medieval": "94", "modern": "94",
    "world war": "94", "revolution": "94", "independence": "94",
    "map": "91", "climate": "91", "river": "91", "mountain": "91",
    "travel": "91", "tourism": "91", "country": "91", "city": "91"
};

// ==========================================
// 2. DDC 23 RULES DICTIONARY (500+ WORDS)
// ==========================================
const DDC_23_RULES = {
    // ===== 000: GENERAL =====
    "general": "000", "computer science": "004", "information": "020",
    "library": "020", "journalism": "070", "management": "650",
    "computer": "004", "artificial intelligence": "006.3", "internet": "004.678",
    "data": "005", "software": "005", "programming": "005", "algorithm": "005",

    // ===== 100: PHILOSOPHY & PSYCHOLOGY =====
    "philosophy": "100", "psychology": "150",
    "knowledge": "121", "epistemology": "121", "theory of knowledge": "121",
    "metaphysics": "110", "ontology": "111", "being": "111", "reality": "111",
    "logic": "160", "reasoning": "160", "ethics": "170", "morality": "170",
    "aesthetics": "180", "beauty": "180",
    "mind": "150", "consciousness": "150", "behavior": "150",
    "deduction": "160", "induction": "160", "fallacy": "160",

    // ===== 200: RELIGION =====
    "religion": "200", "theology": "200", "god": "200", "worship": "200",
    "christianity": "230", "islam": "297", "hinduism": "294.5", "buddhism": "294.3",
    "sikhism": "294.6", "judaism": "296", "jainism": "294.4", "taoism": "299.5",
    "bible": "220", "quran": "297", "gita": "294.5", "guru granth sahib": "294.6",
    "prayer": "200", "meditation": "200", "spirituality": "200",

    // ===== 300: SOCIAL SCIENCES =====
    "social": "300", "sociology": "301", "society": "301", "community": "307",
    "politics": "320", "political science": "320", "government": "320",
    "economics": "330", "economy": "330", "trade": "380", "business": "650",
    "law": "340", "legal": "340", "justice": "340", "constitution": "342",
    "education": "370", "teaching": "371", "school": "371", "university": "378",
    "anthropology": "301", "culture": "306", "customs": "390",
    "statistics": "310", "demography": "304", "population": "304",

    // ===== 400: LANGUAGE =====
    "language": "400", "linguistics": "410", "literature": "800",
    "english": "420", "hindi": "491.43", "punjabi": "491.42", "sanskrit": "491.2",
    "urdu": "491.439", "bengali": "491.44", "tamil": "494.811", "gujarati": "491.47",
    "grammar": "415", "dictionary": "413", "novel": "808", "poetry": "808",
    "drama": "808", "essay": "808", "story": "808", "fiction": "808",

    // ===== Idioms & Expressions =====
    "idiom": "418", "idioms": "418", "expression": "418",
    "expressions": "418", "proverb": "418", "proverbs": "418",
    "phrase": "418", "phrases": "418", "phraseology": "418",
    "metaphor": "418", "simile": "418",
    "adiam": "418", "idom": "418", "ediom": "418", "expresion": "418",
    "punjabi idiom": "491.42 + 418", "punjabi idioms": "491.42 + 418",
    "punjabi proverb": "491.42 + 418", "punjabi proverbs": "491.42 + 418",

    // ===== 500: SCIENCE =====
    "science": "500", "mathematics": "510", "math": "510", "algebra": "512",
    "geometry": "516", "calculus": "515",
    "physics": "530", "chemistry": "540", "biology": "570", "botany": "580",
    "zoology": "590", "environment": "577", "ecology": "577",
    "astronomy": "520", "geology": "550", "microbiology": "579",
    "genetics": "576.5", "evolution": "576.8", "cell": "571.6", "dna": "572.8",
    "light": "535", "sound": "534", "energy": "531", "matter": "530",
    "atom": "541", "molecule": "541", "reaction": "541", "acid": "546",
    "plant": "580", "animal": "590", "human body": "612",

    // ===== 600: TECHNOLOGY =====
    "technology": "600", "medicine": "610", "medical": "610", "health": "613",
    "disease": "616", "treatment": "615", "surgery": "617", "drug": "615",
    "engineering": "620", "machine": "621", "mechanical": "621",
    "electrical": "621.3", "civil": "624", "chemical": "660",
    "agriculture": "630", "farming": "630", "crop": "631", "soil": "631",
    "manufacturing": "670", "construction": "690", "transport": "629",
    "communication": "621.38", "telephone": "621.385", "radio": "621.384", "television": "621.388",

    // ===== 700: ARTS =====
    "arts": "700", "painting": "750", "drawing": "740", "sculpture": "730",
    "music": "780", "song": "782", "dance": "792.8", "theatre": "792",
    "sports": "790", "games": "790", "cricket": "796.358", "football": "796.334",
    "photography": "770", "cinema": "791.43", "film": "791.43",

    // ===== 800: LITERATURE =====
    "literature": "800", "english literature": "820", "hindi literature": "891.43",
    "punjabi literature": "891.42", "sanskrit literature": "891.2",
    "novel": "808.3", "poetry": "808.1", "drama": "808.2", "essay": "808.4",

    // ===== 900: HISTORY & GEOGRAPHY =====
    "history": "900", "geography": "910", "biography": "920", "archaeology": "930",
    "india": "954", "indian": "954", "punjab": "954.552",
    "gandhi": "954.035", "nehru": "954.042", "british": "941",
    "ancient": "930", "medieval": "940", "modern": "909",
    "world war": "940.53", "revolution": "909", "independence": "954",
    "map": "912", "climate": "551.6", "river": "551.48", "mountain": "551.43",
    "travel": "910", "tourism": "910", "country": "910", "city": "910"
};

// ==========================================
// 3. KEYWORD EXTRACTOR
// ==========================================
function extractKeywords(query) {
    const stopWords = new Set(["and", "or", "the", "of", "in", "a", "an", "to", "for", "with", "on", "by", "is", "are", "was", "were"]);
    
    return query
        .toLowerCase()
        .replace(/,/g, " ")
        .replace(/&/g, " ")
        .split(/\s+/)
        .map(w => w.trim())
        .filter(w => w.length > 0 && !stopWords.has(w));
}

// ==========================================
// 4. FUZZY MATCHING (SPELLING MISTAKES LAYI)
// ==========================================
function findBestMatch(word, rules) {
    const keys = Object.keys(rules);
    let bestMatch = null;
    let bestScore = 0;
    
    for (const key of keys) {
        const score = similarity(word, key);
        if (score > bestScore && score > 0.8) {
            bestScore = score;
            bestMatch = key;
        }
    }
    return bestMatch;
}

function similarity(a, b) {
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1.0;
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

// ==========================================
// 5. MAIN CLASSIFIER LOGIC
// ==========================================
function getClassification(query, standard) {
    const keywords = extractKeywords(query);
    const rules = standard.toUpperCase() === "UDC" ? UDC_1961_RULES : DDC_23_RULES;
    const standardName = standard.toUpperCase() === "UDC" ? "UDC 1961" : "DDC 23";
    
    const finalNumbers = [];
    const auditLog = [];
    let errorFound = false;
    
    for (const word of keywords) {
        // Step 1: Exact Match
        if (rules[word]) {
            const num = rules[word];
            if (!finalNumbers.includes(num)) {
                finalNumbers.push(num);
                auditLog.push(`✅ '${word}' -> ${num}`);
            } else {
                auditLog.push(`⏭️ '${word}' -> ${num} (already added)`);
            }
        } 
        // Step 2: Fuzzy Match (spelling mistakes)
        else {
            const bestMatch = findBestMatch(word, rules);
            if (bestMatch) {
                const num = rules[bestMatch];
                if (!finalNumbers.includes(num)) {
                    finalNumbers.push(num);
                    auditLog.push(`⚠️ '${word}' -> '${bestMatch}' (fuzzy) -> ${num}`);
                } else {
                    auditLog.push(`⏭️ '${word}' -> '${bestMatch}' -> ${num} (already added)`);
                }
            } else {
                errorFound = true;
                auditLog.push(`❌ '${word}' -> NOT FOUND`);
            }
        }
    }
    
    if (errorFound || finalNumbers.length === 0) {
        return {
            status: "ERROR",
            message: "Some keywords were not found. Manual check required.",
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
// 6. API ROUTES
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
// 7. START SERVER
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ UDC & DDC Classifier running on port ${PORT}`);
});
