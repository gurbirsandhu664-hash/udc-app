import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Load environment variables safely
dotenv.config();

const app = express();
// Render assigns a dynamic PORT, default to 3000 for local testing
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Powerful rule-based AI function for UDC/DDC synthesis
 */
async function classifyLibraryTitle(title, description) {
    // Using a robust reasoning model 
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-pro", 
        systemInstruction: `You are an expert Library Classifier AI processing requests for the LSP5003 Knowledge Organisation syllabus. Your task is to generate highly accurate UDC and DDC classifications, combining principles from authoritative manuals.

        ### Universal Decimal Classification (UDC)
        - Section A: Assign standard Main Tables classes (0-9).
        - Section B: Apply symbols for Coordination (+), Extension (/), Relation (:), Language (=), Form (0), Place (1/9), Race (=), and Time "".
        - Section C: Apply the Hyphen series (-1/-9), Point-Nought series (.01/.09), and Apostrophe series ('1/'9).

        ### Dewey Decimal Classification (DDC) 22nd Edition
        - Section D: Construct class numbers demanding multiple synthesis by executing repeated use of "add to..." instructions to a given base number from more than one place (using the schedules and Tables 1-6).
        - Resolve multi-faceted overlapping aspects by strictly observing the Tables of Precedence. 

        OUTPUT FORMAT:
        Return ONLY a valid JSON object with no markdown formatting (do not include \`\`\`json or \`\`\`):
        {
          "udc_classification": "[Final UDC Number]",
          "udc_synthesis_steps": "[Step-by-step mapping of Main Class + Auxiliaries]",
          "ddc_classification": "[Final DDC Number]",
          "ddc_synthesis_steps": "[Step-by-step mapping of Base Number + Multiple Synthesis Additions]"
        }`
    });

    const prompt = `Classify this document exactly strictly following the rules:\nTitle: ${title}\nDescription: ${description}`;

    try {
        const result = await model.generateContent(prompt);
        let textResponse = result.response.text();
        
        // Strip markdown formatting completely to prevent JSON parse crashes
        textResponse = textResponse.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        
        return JSON.parse(textResponse);
    } catch (error) {
        console.error("AI Engine/Parsing Error:", error);
        throw new Error("Failed to parse classification data from AI.");
    }
}

// API Route for Frontend
app.post('/api/classify', async (req, res) => {
    try {
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

// Health check route for Render
app.get('/', (req, res) => {
    res.send("UDC/DDC Classification API Engine is running.");
});

// BIND TO 0.0.0.0 FOR RENDER TO PREVENT DEPLOYMENT FAILURE
app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on port ${port}`);
});
