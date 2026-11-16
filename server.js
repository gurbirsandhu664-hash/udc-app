import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Powerful rule-based AI function for UDC/DDC synthesis
 */
async function classifyLibraryTitle(title, description) {
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash", 
        generationConfig: {
            responseMimeType: "application/json", 
        },
        systemInstruction: `You are an expert Library Classifier AI processing requests for the LSP5003 Knowledge Organisation syllabus. Your task is to generate highly accurate UDC and DDC classifications, combining principles from authoritative manuals.

        ### Universal Decimal Classification (UDC)
        - Section A: Assign standard Main Tables classes (0-9).
        - Section B: Apply symbols for Coordination (+), Extension (/), Relation (:), Language (=), Form (0), Place (1/9), Race (=), and Time "".
        - Section C: Apply the Hyphen series (-1/-9), Point-Nought series (.01/.09), and Apostrophe series ('1/'9).

        ### Dewey Decimal Classification (DDC) 22nd Edition
        - Section D: Construct class numbers demanding multiple synthesis by executing repeated use of "add to..." instructions to a given base number from more than one place (using the schedules and Tables 1-6).
        - Resolve multi-faceted overlapping aspects by strictly observing the Tables of Precedence. 

        OUTPUT FORMAT MUST BE A VALID JSON OBJECT:
        {
          "udc_classification": "[Final UDC Number]",
          "udc_synthesis_steps": "[Step-by-step mapping of Main Class + Auxiliaries]",
          "ddc_classification": "[Final DDC Number]",
          "ddc_synthesis_steps": "[Step-by-step mapping of Base Number + Multiple Synthesis Additions]"
        }`
    });

    const prompt = `Classify this document exactly strictly following the rules:\nTitle: ${title}\nDescription: ${description || "No description provided"}`;

    try {
        const result = await model.generateContent(prompt);
        return JSON.parse(result.response.text());
    } catch (error) {
        console.error("AI Engine/Parsing Error:", error);
        throw new Error("Google AI da jawaab nahi aaya. API Key check karo.");
    }
}

// ----------------------------------------------------
// 1. API KEY HEALTH CHECK ROUTE
// ----------------------------------------------------
app.get('/api/health', (req, res) => {
    if (process.env.GEMINI_API_KEY) {
        res.status(200).json({ status: "Success", message: "GEMINI_API_KEY is SET properly on Render." });
    } else {
        res.status(500).json({ status: "Error", message: "GEMINI_API_KEY is MISSING!" });
    }
});


// ----------------------------------------------------
// 2. MAIN CLASSIFICATION ROUTE FOR FRONTEND
// ----------------------------------------------------
app.post('/api/classify', async (req, res) => {
    try {
        if (!process.env.GEMINI_API_KEY) {
             return res.status(500).json({ error: "Server Configuration Error: GEMINI_API_KEY is missing." });
        }

        const { title, description } = req.body;
        
        if (!title) {
            return res.status(400).json({ error: "Title is required" });
        }
        
        const classificationData = await classifyLibraryTitle(title, description);
        res.status(200).json(classificationData);
        
    } catch (error) {
        console.error("Server API Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// BIND TO 0.0.0.0 FOR RENDER TO PREVENT DEPLOYMENT FAILURE
app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on port ${port}`);
});
