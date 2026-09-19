const http=require("http"),fs=require("fs"),path=require("path");
const PORT=process.env.PORT||10000;
const keyPath=path.join(__dirname,"udc-2600-key.json");
let key={entries:[]};
try{key=JSON.parse(fs.readFileSync(keyPath,"utf8"));}catch(e){console.error("Key load error:",e.message);}
const MAP=new Map((key.entries||[]).map(x=>[norm(x.title),x]));

function norm(s){return String(s||"").toLowerCase().normalize("NFKD").replace(/[’']/g,"'").replace(/[^a-z0-9=:.()\-+\/"& ]+/g," ").replace(/\s+/g," ").trim();}
function words(t){return new Set(norm(t).split(/\s+/).filter(Boolean));}
function result(title,x,exact=false){return {ok:true,title,bookTitle:title,udc:x.udc,finalUdcNumber:x.udc,mainClass:String(x.udc).split(/[.(="'\-+/:]/)[0],mainSubject:x.subject,subSubject:x.subSubject||"",confidence:x.confidence||"Medium",verifiedRule:exact||x.confidence==="High",source:exact?"UDC 2600-title practice key":"UDC semantic fallback",explanation:x.explanation||`${x.udc} = ${x.subject}.`};}

const semantic=[
[/\bheart\b|\bcardiac\b|\bcardiovascular\b|\bcoronary\b/,"616.12","Medicine","Heart and cardiovascular diseases"],
[/\bscience\b.*\btechnology\b|\btechnology\b.*\bscience\b/,"5/6","Science and technology","Science and technology"],
[/\bcomputer\b|\bcomputing\b|\bprogramming\b|\bsoftware\b|\bartificial intelligence\b|\bmachine learning\b/,"004","Computer science","Computing and information technology"],
[/\bmedicine\b|\bmedical\b|\bdisease\b|\bclinical\b|\bsurgery\b|\bnursing\b/,"61","Medicine","Medical sciences"],
[/\bmathematics\b|\balgebra\b|\bgeometry\b|\bcalculus\b|\bprobability\b/,"51","Mathematics","Mathematics"],
[/\bphysics\b|\bquantum\b|\bmechanics\b|\boptics\b|\bthermodynamics\b/,"53","Physics","Physics"],
[/\bchemistry\b|\bchemical\b/,"54","Chemistry","Chemistry"],
[/\bbiology\b|\becology\b|\bgenetics\b|\bmicrobiology\b/,"57","Biological sciences","Biology"],
[/\bengineering\b|\btechnology\b|\bmanufacturing\b/,"6","Applied sciences and technology","Engineering and technology"],
[/\bart\b|\barts\b|\bpainting\b|\bsculpture\b|\bmusic\b|\bphotography\b/,"7","Arts","The arts"],
[/\bliterature\b|\bpoetry\b|\bnovel\b|\bdrama\b|\bfiction\b/,"82","Literature","Literature"],
[/\blanguage\b|\blinguistics\b|\bgrammar\b|\bphonetics\b/,"81","Language and linguistics","Language"],
[/\bhistory\b|\bhistorical\b/,"94","History","General history"],
[/\bgeography\b|\bgeographical\b/,"91","Geography","Geography"],
[/\bphilosophy\b|\bethics\b|\blogic\b|\bmetaphysics\b/,"1","Philosophy","Philosophy"],
[/\breligion\b|\btheology\b|\bislam\b|\bhinduism\b|\bchristianity\b|\bsikhism\b/,"2","Religion and theology","Religion"],
[/\bpolitics\b|\bpolitical\b|\blaw\b|\beconomics\b|\beconomy\b|\beducation\b|\bsociology\b|\bmanagement\b/,"3","Social sciences","Social sciences"],
[/\blibrary\b|\blibrarianship\b|\bcataloguing\b|\bclassification\b/,"02","Librarianship","Library science"],
[/\bjournalism\b|\bnewspaper\b|\bmedia\b|\bcommunication\b/,"070","Journalism and media","Journalism and mass media"],
[/\btourism\b|\btravel\b|\bhospitality\b/,"338.48","Tourism","Tourism"],
[/\bsport\b|\bsports\b|\bcricket\b|\bfootball\b|\bhockey\b|\btennis\b/,"796","Sport","Sports"],
[/\bmilitary\b|\bdefence\b|\bdefense\b|\bwar\b/,"355","Military science","Military science"],
[/\bbiography\b|\bautobiography\b|\bmemoir\b/,"92","Biography","Biography"]
];

function classify(title){
 const t=norm(title);
 if(!t)return {ok:false,error:"Enter a book title."};
 const exact=MAP.get(t); if(exact)return result(title,exact,true);
 for(const [re,udc,sub,ss] of semantic) if(re.test(t)){
   return result(title,{udc,subject:sub,subSubject:ss,confidence:"Low",explanation:`Broad UDC subject-family match: ${udc} = ${sub}. Refine with the authoritative UDC Summary/schedule for exact subdivision.`});
 }
 return result(title,{udc:"0",subject:"Generalities",subSubject:"No reliable subject-family match",confidence:"Low",explanation:"0 is retained only when no reliable subject family can be inferred. The classifier does not invent a detailed UDC number."});
}

const server=http.createServer((req,res)=>{
 if(req.method==="GET"&&(req.url==="/"||req.url==="/index.html"))return fs.createReadStream(path.join(__dirname,"index.html")).pipe(res);
 if(req.method==="GET"&&req.url==="/health"){res.writeHead(200,{"Content-Type":"application/json"});return res.end(JSON.stringify({status:"ok",version:"V9",titles:key.title_count||0}));}
 if(req.method==="POST"&&req.url==="/api/classify"){
   let b="";req.on("data",c=>b+=c);req.on("end",()=>{try{const d=JSON.parse(b||"{}");res.writeHead(200,{"Content-Type":"application/json","Cache-Control":"no-store"});res.end(JSON.stringify(classify(d.title||"")));}catch(e){res.writeHead(400,{"Content-Type":"application/json"});res.end(JSON.stringify({ok:false,error:"Invalid request"}));}});
   return;
 }
 res.writeHead(404);res.end("Not found");
});
server.listen(PORT,"0.0.0.0",()=>console.log(`UDC Ultimate V9 listening on ${PORT}`));