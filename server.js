import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function classifyLibraryTitle(title, description) {
    // FIX: Changed back to 'gemini-1.5-flash'. 
    // Eh model 100% chalega, isdi limit 1500 requests/day hai (sab ton zyada).
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash", 
        generationConfig: {
            responseMimeType: "application/json", 
        },
        systemInstruction: `You are an expert Library Classifier AI processing requests for the LSP5003 Knowledge Organisation syllabus. Generate highly accurate UDC and DDC classifications.
        OUTPUT FORMAT MUST BE EXACTLY THIS JSON AND NOTHING ELSE:
        {
          "udc_classification": "[Final UDC Number]",
          "udc_synthesis_steps": "[Step-by-step mapping]",
          "ddc_classification": "[Final DDC Number]",
          "ddc_synthesis_steps": "[Step-by-step mapping]"
        }`
    });

    const prompt = `Classify this document exactly strictly following the rules:\nTitle: ${title}\nDescription: ${description || "None"}\n\nRETURN ONLY VALID JSON.`;

    try {
        const result = await model.generateContent(prompt);
        let textResponse = result.response.text();
        
        const startIndex = textResponse.indexOf('{');
        const endIndex = textResponse.lastIndexOf('}');
        
        if (startIndex !== -1 && endIndex !== -1) {
            textResponse = textResponse.substring(startIndex, endIndex + 1);
        }
        
        return JSON.parse(textResponse);
    } catch (error) {
        console.error("AI Error:", error);
        return {
            "udc_classification": "Error",
            "udc_synthesis_steps": "Google API Issue: " + error.message,
            "ddc_classification": "Error",
            "ddc_synthesis_steps": "Please check API Key or try again."
        };
    }
}

app.get('/api/health', (req, res) => {
    if (process.env.GEMINI_API_KEY) {
        res.status(200).json({ status: "Success", message: "Google AI is SET properly." });
    } else {
        res.status(500).json({ status: "Error", message: "API Key MISSING!" });
    }
});

app.post('/api/classify', async (req, res) => {
    try {
        if (!process.env.GEMINI_API_KEY) {
             return res.status(500).json({ error: "Google AI Key is missing in Render Environment." });
        }

        const { title, description } = req.body;
        if (!title) return res.status(400).json({ error: "Book Title is required" });
        
        const classificationData = await classifyLibraryTitle(title, description);
        res.status(200).json(classificationData);
    } catch (error) {
        console.error("Server API Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on port ${port}`);
});
