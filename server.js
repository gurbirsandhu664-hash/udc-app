const http = require('http');

// 1. Your UDC/DDC Function
function getCorrectClassification(inputSubject, inputTopic) {
    let subject = (inputSubject || "").toString().toLowerCase();
    let topic = (inputTopic || "").toString().toLowerCase();

    let finalOutput = "DeepSeek AI is added\n\n";
    let udcCode = "N/A";
    let ddcCode = "N/A";
    let auditText = "";

    if (subject.includes("medicine") || subject.includes("medical")) {
        if (topic.includes("aptitude") || topic.includes("test") || topic.includes("examination")) {
            udcCode = "61:159.9"; 
            ddcCode = "610.76"; 
            auditText = "UDC: Used 61 for medicine and 159.9 for aptitude/psychology testing.";
        } else {
            udcCode = "61";
            ddcCode = "610";
            auditText = "UDC: Used 61 for general medicine.";
        }
    } else {
        if (topic.includes("aptitude") || topic.includes("test")) {
            udcCode = "37.047";
            auditText = "UDC: Used 37.047 for general aptitude tests.";
        }
    }

    finalOutput += `UDC: ${udcCode}\n`;
    finalOutput += `DDC: ${ddcCode}\n\n`;
    finalOutput += `Audit: ${auditText}`;
    return finalOutput;
}

// 2. Create Server and Show Result
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  // Here we call our function to display the result
  // (Currently using "Medicine" and "Aptitude Test" for testing)
  const result = getCorrectClassification("Medicine", "Aptitude Test");
  
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(result);
});

server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
