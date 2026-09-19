const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 10000;

const RULES = [
  // Exact/high-confidence examples
  { re:/^science\s+and\s+technology$/i, udc:"5/6", subject:"Science and technology", confidence:"High",
    explanation:"5/6 is the UDC extension (stroke) covering the consecutive range from 5 Mathematics/Natural sciences through 6 Applied sciences, Medicine and Technology." },
  { re:/^science\s+and\s+arts$/i, udc:"5/7", subject:"Science and the arts", confidence:"Medium",
    explanation:"5/7 is a consecutive extension spanning classes 5 through 7. The title is broad/interdisciplinary; the exact treatment depends on the document content." },
  { re:/^heart\s+disease(s)?$/i, udc:"616.12", subject:"Diseases of the heart", confidence:"High",
    explanation:"616.12 is used for diseases of the heart/cardiology in UDC cataloguing examples." },
  { re:/^(hindi\s+language|language\s+hindi)$/i, udc:"811.214.21", subject:"Hindi language", confidence:"High",
    explanation:"811.214.21 is the UDC Summary entry for Hindi language." },
  { re:/^(hindi\s+literature|literature\s+in\s+hindi)$/i, udc:"821.214.21", subject:"Hindi literature", confidence:"High",
    explanation:"821.214.21 is the UDC Summary entry for Hindi literature." },
  { re:/^history\s+of\s+india$/i, udc:"94(540)", subject:"History of India", confidence:"High",
    explanation:"94 = history; (540) = India place auxiliary." },
  { re:/^geography\s+of\s+india$/i, udc:"91(540)", subject:"Geography of India", confidence:"High",
    explanation:"91 = geography; (540) = India place auxiliary." },
  { re:/^indian\s+constitution$/i, udc:"342(540)", subject:"Constitutional law of India", confidence:"High",
    explanation:"342 = public/constitutional law; (540) = India place auxiliary." },
  { re:/^(economy|economic\s+system)\s+of\s+india$/i, udc:"330(540)", subject:"Economy of India", confidence:"High",
    explanation:"330 = economics; (540) = India place auxiliary." },
  { re:/^history\s+of\s+punjab$/i, udc:"94(540.15)", subject:"History of Punjab", confidence:"High",
    explanation:"94 = history; (540.15) = Punjab place auxiliary." },
  { re:/^indian\s+philosophy$/i, udc:"1(540)", subject:"Philosophy in India", confidence:"High",
    explanation:"1 = philosophy; (540) = India place auxiliary." },
  { re:/^indian\s+art$/i, udc:"7(540)", subject:"Art in India", confidence:"High",
    explanation:"7 = arts; (540) = India place auxiliary." },
  { re:/^foreign\s+relations\s+between\s+india\s+and\s+pakistan$/i, udc:"327(540:549)", subject:"Foreign relations between India and Pakistan", confidence:"High",
    explanation:"327 = international relations; (540:549) expresses the relation between India and Pakistan using place auxiliaries." },

  // Broad subject families
  { re:/\bheart|cardiac|cardiology|coronary|myocard|arrhythmia|hypertension\b/i, udc:"616.12", subject:"Heart diseases / cardiology", confidence:"Medium",
    explanation:"The title contains a clear heart/cardiology subject. 616.12 is the general heart-disease/cardiology class; more specific pathology may require a schedule lookup." },
  { re:/\bscience\b.*\btechnology\b|\btechnology\b.*\bscience\b/i, udc:"5/6", subject:"Science and technology", confidence:"High",
    explanation:"The title explicitly spans science and technology; UDC uses 5/6 as the standard consecutive extension for Science and Technology." },
  { re:/\bmathematics\b|\balgebra\b|\bgeometry\b|\bcalculus\b|\bstatistics\b/i, udc:"51", subject:"Mathematics / mathematical sciences", confidence:"Medium",
    explanation:"Mathematics titles are assigned in class 51, with the exact subdivision determined by the specific mathematical topic." },
  { re:/\bphysics\b|\bquantum\b|\bmechanics\b|\bthermodynamics\b|\boptics\b/i, udc:"53", subject:"Physics", confidence:"Medium",
    explanation:"Physics is class 53; a more specific subdivision should be selected from the UDC schedule when the topic is known." },
  { re:/\bchemistry\b|\bchemical\b|\borganic chemistry\b|\binorganic chemistry\b/i, udc:"54", subject:"Chemistry", confidence:"Medium",
    explanation:"Chemistry is class 54; the exact subdivision depends on the chemical topic." },
  { re:/\bbiology\b|\bbotany\b|\bzoology\b|\becology\b|\bgenetics\b|\bmicrobiology\b/i, udc:"57", subject:"Biological sciences", confidence:"Medium",
    explanation:"Biological sciences are in class 57; specific organisms/processes require deeper schedule selection." },
  { re:/\bcomputer\b|\bcomputing\b|\binformation technology\b|\bdata processing\b|\bsoftware\b|\bprogramming\b|\bartificial intelligence\b|\bmachine learning\b/i, udc:"004", subject:"Computer science and technology", confidence:"Medium",
    explanation:"004 covers computer science and computing; specific technologies can be subdivided further." },
  { re:/\bmedicine\b|\bmedical\b|\bdisease\b|\bclinical\b|\bpathology\b|\bsurgery\b|\bnursing\b/i, udc:"61", subject:"Medicine", confidence:"Medium",
    explanation:"Class 61 covers medicine. A disease-specific title should be refined to the appropriate medical subdivision." },
  { re:/\bengineering\b|\btechnology\b|\bmanufacturing\b|\bmechanical\b|\belectrical\b|\bcivil engineering\b/i, udc:"6", subject:"Applied sciences, medicine and technology", confidence:"Medium",
    explanation:"Class 6 covers applied sciences, medicine and technology. Exact engineering fields should be refined using the relevant subdivision." },
  { re:/\bart\b|\barts\b|\bpainting\b|\bsculpture\b|\bmuseum\b|\bdesign\b|\barchitecture\b/i, udc:"7", subject:"The arts", confidence:"Medium",
    explanation:"Class 7 covers the arts, entertainment and sport. Exact artistic disciplines require deeper schedule selection." },
  { re:/\bliterature\b|\bnovel\b|\bpoetry\b|\bdrama\b|\btheatre\b|\bplay\b|\blinguistics\b|\blanguage\b|\bdictionary\b/i, udc:"8", subject:"Linguistics and literature", confidence:"Medium",
    explanation:"Class 8 covers linguistics and literature. Language, literary language, form and specific-language rules must be distinguished for a final detailed number." },
  { re:/\bhistory\b|\bhistorical\b|\bgeography\b|\bgeographical\b|\bworld war\b|\bcountry\b|\bindia\b|\bpakistan\b/i, udc:"9", subject:"Geography and history", confidence:"Medium",
    explanation:"Class 9 covers geography and history. Place auxiliaries can refine geographic or historical subjects." },
  { re:/\bphilosophy\b|\bpsychology\b|\bmind\b|\bethics\b|\blogic\b/i, udc:"1", subject:"Philosophy and psychology", confidence:"Medium",
    explanation:"Class 1 covers philosophy and psychology; the exact branch determines the final subdivision." },
  { re:/\breligion\b|\btheology\b|\bchristian\b|\bislam\b|\bhinduism\b|\bbuddhism\b/i, udc:"2", subject:"Religion and theology", confidence:"Medium",
    explanation:"Class 2 covers religion and theology; the specific religion should be refined further." },
  { re:/\bsociology\b|\bpolitics\b|\bpolitical\b|\blaw\b|\beconomics\b|\beconomy\b|\beducation\b|\bsocial science\b|\bmanagement\b/i, udc:"3", subject:"Social sciences", confidence:"Medium",
    explanation:"Class 3 covers social sciences. Specific disciplines such as law, economics, politics and education have their own subdivisions." },
  { re:/\bknowledge\b|\binformation science\b|\blibrary\b|\blibrarianship\b|\bdocumentation\b|\bclassification\b|\bbook\b|\bbibliography\b/i, udc:"0", subject:"Science and knowledge; information; documentation", confidence:"Medium",
    explanation:"Class 0 covers science and knowledge, organization, computer/information science, documentation, librarianship and publications." }
];

function normalize(s){
  return String(s||"").trim().replace(/\s+/g," ");
}

function classify(title){
  const t = normalize(title);
  if(!t) return {ok:false,error:"Enter a book title."};

  for(const r of RULES){
    if(r.re.test(t)){
      return {
        ok:true, title:t, udc:r.udc, subject:r.subject, subSubject:"",
        confidence:r.confidence, verification:r.confidence==="High"?"UDC Summary / documented rule":"Subject-family match — refine with the authoritative schedule",
        explanation:r.explanation,
        auxiliaries: extractAux(t,r.udc),
        notation: explainNotation(r.udc)
      };
    }
  }

  // Never return the old misleading "0 = unknown" behaviour.
  // Use a transparent broad fallback based on title words.
  const fallback = fallbackClass(t);
  return {
    ok:true, title:t, udc:fallback.udc, subject:fallback.subject, subSubject:"Broad subject fallback",
    confidence:"Low",
    verification:"Review required — broad class only",
    explanation:"A broad UDC class was selected from the title vocabulary so the tool does not invent a precise number. Use the UDC Summary/authoritative schedule for exact cataloguing.",
    auxiliaries:[],
    notation:explainNotation(fallback.udc)
  };
}

function fallbackClass(t){
  const x=t.toLowerCase();
  if(/\b(science|scientific)\b/.test(x) && /\b(technology|technologies)\b/.test(x)) return {udc:"5/6",subject:"Science and technology"};
  if(/\b(health|medicine|medical|disease|hospital|nursing)\b/.test(x)) return {udc:"61",subject:"Medicine"};
  if(/\b(computer|software|programming|digital|ai|artificial intelligence)\b/.test(x)) return {udc:"004",subject:"Computer science and technology"};
  if(/\b(language|linguistics|literature|novel|poetry|drama|dictionary)\b/.test(x)) return {udc:"8",subject:"Linguistics and literature"};
  if(/\b(history|historical|war|geography|geographical)\b/.test(x)) return {udc:"9",subject:"Geography and history"};
  if(/\b(art|arts|music|painting|sculpture|design)\b/.test(x)) return {udc:"7",subject:"The arts"};
  if(/\b(religion|theology|church|islam|hindu|buddh|christ)\b/.test(x)) return {udc:"2",subject:"Religion and theology"};
  if(/\b(philosophy|psychology|ethics|logic)\b/.test(x)) return {udc:"1",subject:"Philosophy and psychology"};
  if(/\b(politics|law|economics|economy|education|sociology|management|social)\b/.test(x)) return {udc:"3",subject:"Social sciences"};
  if(/\b(math|mathematics|algebra|geometry|physics|chemistry|biology|ecology)\b/.test(x)) return {udc:"5",subject:"Mathematics and natural sciences"};
  return {udc:"0",subject:"Science and knowledge; general information"};
}

function extractAux(title,udc){
  const a=[];
  if(/\bindia\b/i.test(title)) a.push("(540) India");
  if(/\bpunjab\b/i.test(title)) a.push("(540.15) Punjab");
  if(/\bpakistan\b/i.test(title)) a.push("(549) Pakistan");
  if(/\b(hindi)\b/i.test(title)) a.push("=214.21 Hindi (language auxiliary context)");
  return a;
}

function explainNotation(u){
  if(u==="5/6") return "5/6 = consecutive extension (stroke): from class 5 through class 6.";
  if(u.includes(":")) return `${u}: colon indicates a simple relation between subjects/place concepts.`;
  if(u.includes("+")) return `${u}: plus indicates coordination/addition of separate UDC numbers.`;
  if(u.includes("(540)")) return `${u}: (540) is the common place auxiliary for India.`;
  if(u.includes("(540.15)")) return `${u}: (540.15) is the common place auxiliary for Punjab.`;
  if(u.includes("(549)")) return `${u}: (549) is the common place auxiliary for Pakistan.`;
  return `${u} = selected UDC classmark; use the authoritative schedule for deeper subdivision where applicable.`;
}

const htmlPath = path.join(__dirname,"index.html");

const server = http.createServer((req,res)=>{
  if(req.url==="/api/classify" && req.method==="POST"){
    let body="";
    req.on("data",c=>body+=c);
    req.on("end",()=>{
      try{
        const data=JSON.parse(body||"{}");
        const out=classify(data.title);
        res.writeHead(200,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});
        res.end(JSON.stringify(out));
      }catch(e){
        res.writeHead(400,{"Content-Type":"application/json"});
        res.end(JSON.stringify({ok:false,error:"Invalid request."}));
      }
    });
    return;
  }
  if(req.url==="/health"){
    res.writeHead(200,{"Content-Type":"application/json"});
    res.end(JSON.stringify({status:"ok",version:"UDC Ultimate V8"}));
    return;
  }
  if(req.url==="/" || req.url==="/index.html"){
    fs.createReadStream(htmlPath).pipe(res);
    return;
  }
  res.writeHead(404,{"Content-Type":"text/plain"});
  res.end("Not found");
});

server.listen(PORT,()=>console.log(`UDC Ultimate V8 listening on ${PORT}`));
