// DEEPSEEK AI CORRECTED CODE
function getCorrectClassification(subject, topic) {
    // 1. Add the requested header
    let finalOutput = "DeepSeek AI is added\n\n";
    
    let udcCode = "N/A";
    let ddcCode = "N/A";
    let auditText = "";

    // 2. Logic for Medicine / Medical
    if (subject.toLowerCase().includes("medicine") || subject.toLowerCase().includes("medical")) {
        
        // If it's a test or aptitude test
        if (topic.toLowerCase().includes("aptitude") || topic.toLowerCase().includes("test") || topic.toLowerCase().includes("examination")) {
            
            // CORRECTED UDC: Use 61 (Medicine) and 159.9 (Psychology). 
            // REMOVED: 37 (Education) because it's a medical test.
            udcCode = "61:159.9"; 
            ddcCode = "610.76";   // DDC was already correct
            
            auditText = "UDC: Used 61 for medicine and 159.9 for aptitude/psychology testing. " +
                        "The previous code incorrectly used 37 (Education) for a medical test. " +
                        "No newspaper notation is applicable.";
        } else {
            // General Medicine
            udcCode = "61";
            ddcCode = "610";
            auditText = "UDC: Used 61 for general medicine.";
        }
    } else {
        // Fallback for general Education
        if (topic.toLowerCase().includes("aptitude") || topic.toLowerCase().includes("test")) {
            udcCode = "37.047";
            auditText = "UDC: Used 37.047 for general aptitude tests in education.";
        }
    }

    // 3. Build the final output
    finalOutput += `UDC: ${udcCode}\n`;
    finalOutput += `DDC: ${ddcCode}\n\n`;
    finalOutput += `Audit: ${auditText}`;

    return finalOutput;
}

// --- TEST RUN ---
console.log(getCorrectClassification("Medicine", "Aptitude Test"));
