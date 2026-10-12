const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Safe JSON file loader function
function loadJsonFile(filename) {
    const filePath = path.join(__dirname, filename);
    if (fs.existsSync(filePath)) {
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        } catch (err) {
            console.error(`Error reading ${filename}:`, err.message);
            return null;
        }
    }
    return null;
}

// References load karna (Fallback ke sath taaki server crash na ho)
const udcIndex = loadJsonFile('udc-1961-reference-index.json') || {};
const ddcIndex = loadJsonFile('ddc-23-reference-index.json') || {};

// Standard Classification Fallback Rules (Random Titles ke liye)
const keywordRules = [
    { regex: /\b(library|libraries|cataloguing|classification|bibliometrics|information science)\b/i, udc: '02', ddc: '020' },
    { regex: /\b(computer|programming|software|algorithm|artificial intelligence|data)\b/i, udc: '004', ddc: '004' },
    { regex: /\b(philosophy|metaphysics|ethics|logic)\b/i, udc: '1', ddc: '100' },
    { regex: /\b(psychology)\b/i, udc: '159.9', ddc: '150' },
    { regex: /\b(religion|theology|islam|christianity|hinduism|sikhism)\b/i, udc: '2', ddc: '200' },
    { regex: /\b(sociology|society)\b/i, udc: '301', ddc: '301' },
    { regex: /\b(politics|political science|government)\b/i, udc: '32', ddc: '320' },
    { regex: /\b(economics|banking|trade|finance)\b/i, udc: '33', ddc: '330' },
    { regex: /\b(law|jurisprudence|legal)\b/i, udc: '34', ddc: '340' },
    { regex: /\b(education|higher education|teaching|pedagogy)\b/i, udc: '37', ddc: '370' },
    { regex: /\b(mathematics|algebra|geometry|calculus)\b/i, udc: '51', ddc: '510' },
    { regex: /\b(physics|mechanics|electricity)\b/i, udc: '53', ddc: '530' },
    { regex: /\b(chemistry|organic|inorganic)\b/i, udc: '54', ddc: '540' },
    { regex: /\b(biology|botany|zoology)\b/i, udc: '57', ddc: '570' },
    { regex: /\b(medicine|health|pathology|surgery)\b/i, udc: '61', ddc: '610' },
    { regex: /\b(engineering|mechanical|electrical|civil)\b/i, udc: '62', ddc: '620' },
    { regex: /\b(agriculture|farming|forestry)\b/i, udc: '63', ddc: '630' },
    { regex: /\b(management|business|commerce)\b/i, udc: '65', ddc: '650' },
    { regex: /\b(art|architecture|painting|music)\b/i, udc: '7', ddc: '700' },
    { regex: /\b(language|linguistics|grammar|english|hindi|punjabi)\b/i, udc: '80', ddc: '400' },
    { regex: /\b(literature|poetry|drama|fiction|novel)\b/i, udc: '82', ddc: '800' },
    { regex: /\b(geography|travel|maps)\b/i, udc: '91', ddc: '910' },
    { regex: /\b(history|biography)\b/i, udc: '93/99', ddc: '900' }
];

function classifyTitle(title) {
    if (!title || typeof title !== 'string') {
        return { udc: '001', ddc: '000', matched: 'Default' };
    }

    const cleanTitle = title.trim().toLowerCase();

    // 1. Direct match JSON index se check karein
    if (udcIndex[cleanTitle] || ddcIndex[cleanTitle]) {
        return {
            udc: udcIndex[cleanTitle] || 'Not indexed',
            ddc: ddcIndex[cleanTitle] || 'Not indexed',
            matched: 'Exact Index'
        };
    }

    // 2. Keyword/Rule matching random titles ke liye
    for (const rule of keywordRules) {
        if (rule.regex.test(cleanTitle)) {
            return {
                udc: rule.udc,
                ddc: rule.ddc,
                matched: 'Keyword Logic'
            };
        }
    }

    // 3. Fallback Generalities
    return {
        udc: '001',
        ddc: '000',
        matched: 'General Knowledge'
    };
}

// API Routes
app.post('/api/classify', (req, res) => {
    try {
        const { title } = req.body;
        if (!title) {
            return res.status(400).json({ error: 'Title zaroori hai' });
        }
        const result = classifyTitle(title);
        res.json({ success: true, title, result });
    } catch (err) {
        console.error('Classification error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/search', (req, res) => {
    try {
        const title = req.query.q || '';
        const result = classifyTitle(title);
        res.json({ success: true, title, result });
    } catch (err) {
        res.status(500).json({ error: 'Search error' });
    }
});

// Front-end serve karna
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.send('Server chal raha hai. index.html file verify karein.');
    }
});

// Global crash protection
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.listen(PORT, () => {
    console.log(`Server successfully port ${PORT} par live hai.`);
});
