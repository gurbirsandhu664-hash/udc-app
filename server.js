// FUNCTION TO GET CORRECT UDC & DDC
function getClassification(subject, topic) {
    let output = "DeepSeek AI is added\n\n"; // <--- This adds the text at the top

    let udcCode = "N/A";
    let ddcCode = "N/A";
    let auditText = "";

    // --- FIXING THE UDC ERROR ---
    if (subject === "Medicine" || subject === "Medical") {
        if (topic.includes("Aptitude") || topic.includes("Test") || topic.includes("Examination")) {
            
            // CORRECT LOGIC: Do NOT use 37 (Education) for Medical tests.
            // Use 61:159.9 (Medical Psychology) or just 61 (Medicine)
            udcCode = "61:159.9"; 
            
            auditText = "UDC: Used 61 for medicine and 159.9 for aptitude/psychology testing. " +
                        "Removed the incorrect 37 (Education) notation. Linked by colon for interdisciplinary relation.";
        } else {
            udcCode = "61";
            auditText = "UDC: Used 61 for medicine.";
        }
    } else {
        // General Education Logic (Fallback)
        if (topic.includes("Aptitude") || topic.includes("Test")) {
            udcCode = "37.047";
            auditText = "UDC: Used 37.047 for general aptitude tests in education.";
        }
    }

    // --- FIXING THE DDC (Dewey) ---
    if (subject === "Medicine" || subject === "Medical") {
        ddcCode = "610"; // Medicine
        if (topic.includes("Aptitude") || topic.includes("Test")) {
            ddcCode += ".76"; // Examinations, tests
        }
    }

    // --- BUILDING THE FINAL OUTPUT ---
    output += `UDC: ${udcCode}\n`;
    output += `DDC: ${ddcCode}\n\n`;
    output += `Audit: ${auditText}\n`;

    return output;
}

// --- EXAMPLE USAGE ---
console.log(getClassification("Medicine", "Aptitude Test"));
