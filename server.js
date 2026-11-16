import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Load environment variables (Render te GEMINI_API_KEY set honi chahidi hai)
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Gemini API Initialize kar rahe haan
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * UDC te DDC di classification generate karan layi main AI function
 */
async function classifyLibraryTitle(title, description) {
    // Advanced reasoning layi gemini-3.8-pro (ya current active version) use kar rahe haan
    const model = genAI.getGenerativeModel({
        model: "gemini-3.8-pro", 
        systemInstruction: `You are an expert Library Classifier AI processing requests for the LSP5003 Knowledge Organisation syllabus[span_0](start_span)[span_0](end_span). Your task is to generate highly accurate UDC and DDC classifications, combining principles from two authoritative manuals.

        ### MANUAL 1: Universal Decimal Classification (UDC)
        Apply the analytical classification process outlined by Mallinath Kumbar & Niveditha B.[span_1](start_span)[span_1](end_span): establish the primary class, select subdivisions, identify secondary classes, and connect them[span_2](start_span)[span_2](end_span).
        - Section A (Simple Titles): Assign standard Main Tables classes (0-9)[span_3](start_span)[span_3](end_span).
        - Section B (Common Auxiliaries): Apply symbols for Coordination (+), Extension (/), Relation (:), Language (=), Form (0), Place (1/9), Race (=), and Time "[span_4](start_span)[span_5](start_span)"[span_4](end_span)[span_5](end_span).
        - Section C (Special Auxiliaries): Apply the Hyphen series (-1/-9), Point-Nought series (.01/.09), and Apostrophe series ('1/'9) to express locally recurrent characteristics[span_6](start_span)[span_6](end_span)[span_7](start_span)[span_7](end_span).

        ### MANUAL 2: Dewey Decimal Classification (DDC) 22nd Edition
        Apply the number-building mechanics outlined by M.P. Satija[span_8](start_span)[span_8](end_span).
        - Section D (Multiple Synthesis): Construct class numbers demanding multiple synthesis by executing repeated use of "add to..." instructions to a given base number from more than one place (using the schedules and Tables 1-6)[span_9](start_span)[span_9](end_span)[span_10](start_span)[span_10](end_span).
        - Precedence & Rules: Resolve multi-faceted overlapping aspects by strictly observing the provided Tables of Precedence[span_11](start_span)[span_11](end_span). If no explicit instruction exists, fall back on the First-of-the-two rule, the Rule of three, the Rule of application, or the Rule of zeros[span_12](start_span)[span_12](end_span)[span_13](start_span)[span_13](end_span).

        OUTPUT FORMAT:
        Return ONLY a valid JSON object with no markdown formatting or extra text:
        {
          "udc_classification": "[Final UDC Number]",
          "udc_synthesis_steps": "[Step-by-step mapping of Main Class + Auxiliaries]",
          "ddc_classification": "[Final DDC Number]",
          "ddc_synthesis_steps": "[Step-by-step mapping of Base Number + Multiple Synthesis Additions]"
        }`
    });

    const prompt = `Classify this document:\nTitle: ${title}\nDescription: ${description}`;

    try {
        const result = await model.generateContent(prompt);
        let textResponse = result.response.text();
        
        // Clean markdown JSON formatting if AI includes it
        textResponse = textResponse.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
        
        return JSON.parse(textResponse);
    } catch (error) {
        console.error("Gemini API Classification Error:", error);
        throw new Error("AI engine fail ho gaya ya JSON parse nahi hoya.");
    }
}

// API Route - Frontend ton request ithe aayegi
app.post('/api/classify', async (req, res) => {
    try {
        const { title, description } = req.body;
        
        if (!title) {
            return res.status(400).json({ error: "Title is required for classification." });
        }

        console.log(`Processing classification for: ${title}`);
        
        // AI function call
        const classificationData = await classifyLibraryTitle(title, description);
        
        // Successful JSON response client nu bhej do
        res.status(200).json(classificationData);
        
    } catch (error) {
        console.error("Server Route Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Basic health check route
app.get('/', (req, res) => {
    res.send("UDC/DDC Classification API is running perfectly.");
});

// Server start
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
