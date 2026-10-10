// DEEPSEEK AI CORRECTED CODE - RENDER SAFE
function getCorrectClassification(inputSubject, inputTopic) {
    // 1. Safety Check: Ensure variables are strings, not undefined
    let subject = (inputSubject || "").toString().toLowerCase();
    let topic = (inputTopic || "").toString().toLowerCase();

    // 2. Add the requested header
    let finalOutput = "DeepSeek AI is added\n\n";
    
    let udcCode = "N/A";
    let ddcCode = "N/A";
    let auditText = "";

    // 3. Logic for Medicine / Medical
    if (subject.includes("medicine") || subject.includes("medical")) {
        
        // If it's a test or aptitude test
        if (topic.includes("aptitude") || topic.includes("test") || topic.includes("examination")) {
            
            // CORRECTED UDC: Use 61 (Medicine) and 159.9 (Psychology). 
            // REMOVED: 37 (Education) because it's a medical test.
            udcCode = "61:159.9"; 
            ddcCode = "610.76"; 
            
            auditText = "UDC: Used 61 for medicine and 159.9 for aptitude/psychology testing. " +
                        "The previous code incorrectly used 37 (Education) for a medical test.";
        } else {
            udcCode = "61";
            ddcCode = "610";
            auditText = "UDC: Used 61 for general medicine.";
        }
    } else {
        // Fallback for general Education
        if (topic.includes("aptitude") || topic.includes("test")) {
            udcCode = "37.047";
            auditText = "UDC: Used 37.047 for general aptitude tests in education.";
        }
    }

    // 4. Build the final output
    finalOutput += `UDC: ${udcCode}\n`;
    finalOutput += `DDC: ${ddcCode}\n\n`;
    finalOutput += `Audit: ${auditText}`;

    return finalOutput;
}

// --- TEST RUN ---
console.log(getCorrectClassification("Medicine", "Aptitude Test"));
// --- RENDER KEEP-ALIVE SERVER ---
const http = require('http');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('DeepSeek AI App is running successfully!\n');
});

server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
