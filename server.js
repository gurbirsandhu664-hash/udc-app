const http=require("http"),fs=require("fs"),path=require("path");
const PORT=process.env.PORT||10000;
const keyPath=path.join(__dirname,"udc-2600-key.json");
let key={entries:[]};
try{key=JSON.parse(fs.readFileSync(keyPath,"utf8"));}catch(e){console.error("Key load error:",e.message);}

function norm(s){
  return String(s||"").toLowerCase().normalize("NFKD")
    .replace(/[’']/g,"'")
    .replace(/[^a-z0-9=:.()\-+\/"& ]+/g," ")
    .replace(/\s+/g," ").trim();
}
const MAP=new Map((key.entries||[]).map(x=>[norm(x.title),x]));

function result(title,x,exact=false){
  return {
    ok:true,title,bookTitle:title,
    udc:x.udc,finalUdcNumber:x.udc,
    mainClass:String(x.udc).split(/[.(="'\-+/:]/)[0],
    mainSubject:x.subject||"",
    subSubject:x.subSubject||"",
    confidence:x.confidence||"Medium",
    verifiedRule:exact||x.confidence==="High",
    source:exact?"V10 title practice key":"V10 semantic/context rule",
    explanation:x.explanation||`${x.udc} = ${x.subject||"UDC subject"}.`
  };
}

/* V10 contextual rules.
   Order matters: specific concepts precede broad classes. */
const semantic=[
  // Literature + form
  [/\benglish\b.*\b(drama|play|plays)\b|\b(drama|play|plays)\b.*\benglish\b/,
    "821.111-2","English literature — drama","Drama in English literature",
    "821.111 = English literature; -2 = drama."],
  [/\bhindi\b.*\b(literature|novel|poetry|poem|drama)\b|\b(literature|novel|poetry|poem|drama)\b.*\bhindi\b/,
    "821.214.21","Hindi literature","Literature in Hindi",
    "821.214.21 = Hindi literature (verify the precise literary-form subdivision when required)."],
  [/\bdrama\b|\bplay\b|\bplays\b/,
    "82-2","Literature — drama","Drama / plays",
    "82 = literature; -2 = drama. For a named language, add the language/literature notation as required."],
  [/\bpoetry\b|\bpoem\b|\bpoems\b/,
    "82-1","Literature — poetry","Poetry",
    "82 = literature; -1 = poetry."],
  [/\bnovel\b|\bnovels\b/,
    "82-31","Literature — fiction/prose narrative","Novel",
    "82 = literature; -31 = novel/prose fiction."],

  // Languages
  [/\bhindi\b.*\blanguage\b|\blanguage\b.*\bhindi\b/,
    "811.214.21","Hindi language","Hindi",
    "811.214.21 = Hindi language."],
  [/\benglish\b.*\blanguage\b|\blanguage\b.*\benglish\b/,
    "811.111","English language","English",
    "811.111 = English language."],
  [/\blanguage\b|\blinguistics\b|\bgrammar\b|\bphonetics\b|\bsemantics\b/,
    "81","Language and linguistics","Language",
    "81 = language and linguistics; refine to the specific language when identified."],

  // Medicine: before generic science/arts rules
  [/\bheart\b|\bcardiac\b|\bcardiovascular\b|\bcoronary\b/,
    "616.12","Medicine","Heart and cardiovascular diseases",
    "616.12 = diseases of the cardiovascular system/heart in this classifier rule set."],
  [/\bdiabetes\b/,
    "616.379","Medicine","Diabetes mellitus",
    "Specific medical subject rule for diabetes mellitus; verify against the licensed current schedule for cataloguing."],
  [/\bcancer\b|\bcarcinoma\b|\btumou?r\b/,
    "616-006","Medicine","Neoplasms / cancer",
    "Medical neoplasm rule; verify the exact current subdivision for the named organ/site."],
  [/\bmedicine\b|\bmedical\b|\bdisease\b|\bclinical\b|\bsurgery\b|\bnursing\b|\bpharmacy\b/,
    "61","Medicine","Medical sciences",
    "61 = medical sciences; refine to the disease, organ, treatment, or specialty when supplied."],

  // Explicit combined subjects
  [/\bscience\b.*\btechnology\b|\btechnology\b.*\bscience\b/,
    "5/6","Mathematics and natural sciences / applied sciences and technology","Science and technology",
    "5 = mathematics and natural sciences; 6 = applied sciences and technology; / links consecutive main classes."],
  [/\bscience\b.*\barts\b|\barts\b.*\bscience\b/,
    "5+7","Mathematics and natural sciences / arts","Science and arts",
    "5 = mathematics and natural sciences; 7 = the arts; + connects equally important subjects."],

  // Natural/applied sciences
  [/\bmathematics\b|\balgebra\b|\bgeometry\b|\bcalculus\b|\bprobability\b/,
    "51","Mathematics","Mathematics",
    "51 = mathematics."],
  [/\bphysics\b|\bquantum\b|\bmechanics\b|\boptics\b|\bthermodynamics\b/,
    "53","Physics","Physics",
    "53 = physics."],
  [/\bchemistry\b|\bchemical\b/,
    "54","Chemistry","Chemistry",
    "54 = chemistry."],
  [/\bbiology\b|\becology\b|\bgenetics\b|\bmicrobiology\b/,
    "57","Biological sciences","Biology",
    "57 = biological sciences."],
  [/\bengineering\b|\btechnology\b|\bmanufacturing\b/,
    "6","Applied sciences and technology","Engineering and technology",
    "6 = applied sciences and technology."],

  // Arts: deliberately uses exact word boundaries so 'heart' can never hit art.
  [/\barts?\b|\bpainting\b|\bsculpture\b|\bmusic\b|\bphotography\b|\barchitecture\b/,
    "7","The arts","Arts",
    "7 = the arts."],

  // Humanities/social sciences
  [/\bhistory\b|\bhistorical\b/,
    "94","History","General history",
    "94 = history; add a place/time auxiliary when the title identifies one."],
  [/\bgeography\b|\bgeographical\b/,
    "91","Geography","Geography",
    "91 = geography; add a place auxiliary when appropriate."],
  [/\bphilosophy\b|\bethics\b|\blogic\b|\bmetaphysics\b/,
    "1","Philosophy","Philosophy",
    "1 = philosophy."],
  [/\breligion\b|\btheology\b|\bislam\b|\bhinduism\b|\bchristianity\b|\bsikhism\b/,
    "2","Religion and theology","Religion",
    "2 = religion and theology; refine to the identified religion/topic."],
  [/\bpolitics\b|\bpolitical\b|\blaw\b|\beconomics\b|\beconomy\b|\beducation\b|\bsociology\b|\bmanagement\b/,
    "3","Social sciences","Social sciences",
    "3 = social sciences; refine to the specific discipline."],

  // Other common classes
  [/\bcomputer\b|\bcomputing\b|\bprogramming\b|\bsoftware\b|\bartificial intelligence\b|\bmachine learning\b/,
    "004","Computer science","Computing and information technology",
    "004 = computer science and technology."],
  [/\blibrary\b|\blibrarianship\b|\bcataloguing\b|\bclassification\b/,
    "02","Librarianship and information work","Library and information science",
    "02 = librarianship and related information work."],
  [/\bjournalism\b|\bnewspaper\b|\bmedia\b|\bcommunication\b/,
    "070","Journalism and mass media","Journalism / media",
    "070 = newspapers, journalism and mass media."],
  [/\btourism\b|\btravel\b|\bhospitality\b/,
    "338.48","Tourism","Tourism and travel",
    "338.48 = tourism."],
  [/\bsport\b|\bsports\b|\bcricket\b|\bfootball\b|\bhockey\b|\btennis\b/,
    "796","Sport","Sport",
    "796 = sport."],
  [/\bmilitary\b|\bdefence\b|\bdefense\b|\bwar\b/,
    "355","Military science","Military science",
    "355 = military science."],
  [/\bbiography\b|\bautobiography\b|\bmemoir\b/,
    "92","Biography","Biography",
    "92 = biography."],
  [/\bscience\b/,
    "5","Mathematics and natural sciences","Science",
    "5 = mathematics and natural sciences; refine to the identified science."]
];

function classify(title){
  const t=norm(title);
  if(!t)return {ok:false,error:"Enter a book title."};

  // 1. Exact title key always wins.
  const exact=MAP.get(t);
  if(exact)return result(title,exact,true);

  // 2. Contextual semantic matching.
  for(const [re,udc,subject,subSubject,explanation] of semantic){
    if(re.test(t)){
      return result(title,{udc,subject,subSubject,confidence:"Medium",explanation},false);
    }
  }

  // 3. Last-resort answer: never fabricate a detailed subject number.
  return result(title,{
    udc:"0",
    subject:"Generalities",
    subSubject:"Subject requires identification",
    confidence:"Low",
    explanation:"No reliable subject-family rule matched this title. 0 is only a last-resort Generalities result; use the authoritative UDC schedule/summary to assign a specific class."
  },false);
}

const server=http.createServer((req,res)=>{
  if(req.method==="GET"&&(req.url==="/"||req.url==="/index.html")){
    res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});
    return fs.createReadStream(path.join(__dirname,"index.html")).pipe(res);
  }
  if(req.method==="GET"&&req.url==="/health"){
    res.writeHead(200,{"Content-Type":"application/json","Cache-Control":"no-store"});
    return res.end(JSON.stringify({status:"ok",version:"V10",titles:key.title_count||0}));
  }
  if(req.method==="POST"&&req.url==="/api/classify"){
    let b="";
    req.on("data",c=>b+=c);
    req.on("end",()=>{
      try{
        const d=JSON.parse(b||"{}");
        res.writeHead(200,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});
        res.end(JSON.stringify(classify(d.title||"")));
      }catch(e){
        res.writeHead(400,{"Content-Type":"application/json"});
        res.end(JSON.stringify({ok:false,error:"Invalid request"}));
      }
    });
    return;
  }
  res.writeHead(404);res.end("Not found");
});
server.listen(PORT,"0.0.0.0",()=>console.log(`UDC Ultimate V10 listening on ${PORT}`));
