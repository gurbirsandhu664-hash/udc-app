const http=require("http"),fs=require("fs"),path=require("path");
const PORT=process.env.PORT||10000;
const KEY_FILE=path.join(__dirname,"udc-2600-key.json");
function norm(s){return String(s??"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").replace(/[^a-z0-9=:.()\-+\/"& ]+/g," ").replace(/\s+/g," ").trim();}
function compact(s){return norm(s).replace(/[^a-z0-9]/g,"");}
let key={entries:[]},KEY_ERROR=null;
try{
 key=JSON.parse(fs.readFileSync(KEY_FILE,"utf8"));
 if(!Array.isArray(key.entries)||key.entries.length<2700)throw new Error("Answer key has fewer than 2700 entries");
}catch(e){KEY_ERROR=e;}
const EXACT=new Map();
if(!KEY_ERROR)for(const x of key.entries){if(x&&x.title&&x.udc!=null){EXACT.set(norm(x.title),x);EXACT.set(compact(x.title),x);}}
function make(title,x,source,verified){return {ok:true,title,bookTitle:title,udc:String(x.udc),finalUdcNumber:String(x.udc),mainClass:String(x.udc).split(/[.(="'\-+/:]/)[0],mainSubject:x.subject||"",subSubject:x.subSubject||"",confidence:x.confidence||"Medium",verifiedRule:!!verified,source,explanation:x.explanation||(`${x.udc} = ${x.subject||""}.`)};}
const RULES=[
[/\blibrary\s+classification\b.*\b(practice|manual)\b/,"025.42","Library and information science — classification","Classification practice manual","025.42 = library classification."],
[/\blibrary\s+classification\b/,"025.42","Library and information science — classification","Library classification","025.42 = library classification."],
[/\benglish\b.*\b(drama|play|plays)\b|\b(drama|play|plays)\b.*\benglish\b/,"821.111-2","English literature — drama","Drama in English literature","821.111 = English literature; -2 = drama."],
[/\bhindi\b.*\blanguage\b|\blanguage\b.*\bhindi\b/,"811.214.21","Hindi language","Hindi","811.214.21 = Hindi language."],
[/\bhindi\b.*\b(drama|play|plays)\b|\b(drama|play|plays)\b.*\bhindi\b/,"821.214.21-2","Hindi literature — drama","Drama in Hindi literature","821.214.21 = Hindi literature; -2 = drama. Verify the current detailed schedule when cataloguing."],
[/\bheart\b|\bcardiac\b|\bcardiovascular\b|\bcoronary\b/,"616.12","Medicine — cardiovascular diseases","Heart disease","616.12 = diseases of the cardiovascular system/heart in this classifier rule set."],
[/\bscience\b.*\btechnology\b|\btechnology\b.*\bscience\b/,"5/6","Science and technology","Science and technology","5 = mathematics and natural sciences; 6 = applied sciences and technology; / links consecutive main classes."],
[/\bscience\b.*\barts?\b|\barts?\b.*\bscience\b/,"5+7","Science and arts","Science and arts","5 = mathematics and natural sciences; 7 = arts; + connects equally important subjects."],
[/\benglish\b.*\blanguage\b|\blanguage\b.*\benglish\b/,"811.111","English language","English","811.111 = English language."],
[/\bdictionary\b.*\b(language|linguistics|literature)\b|\b(language|linguistics|literature)\b.*\bdictionary\b/,"80(038)","Language and literature — dictionary","Dictionary","Dictionary/form rule used by this practice classifier."],
[/\bmathematics\b|\balgebra\b|\bgeometry\b|\bcalculus\b|\bprobability\b/,"51","Mathematics","Mathematics","51 = mathematics."],
[/\bphysics\b|\bquantum\b|\bmechanics\b|\boptics\b|\bthermodynamics\b/,"53","Physics","Physics","53 = physics."],
[/\bchemistry\b|\bchemical\b/,"54","Chemistry","Chemistry","54 = chemistry."],
[/\bbiology\b|\becology\b|\bgenetics\b|\bmicrobiology\b/,"57","Biological sciences","Biology","57 = biological sciences."],
[/\bengineering\b|\bmanufacturing\b|\btechnology\b/,"6","Applied sciences and technology","Engineering and technology","6 = applied sciences and technology."],
[/\bart\b|\barts\b|\bpainting\b|\bsculpture\b|\bmusic\b|\bphotography\b|\barchitecture\b/,"7","The arts","Arts","7 = the arts."],
[/\bhistory\b|\bhistorical\b/,"94","History","General history","94 = history; add place/time auxiliaries when identified."],
[/\bgeography\b|\bgeographical\b/,"91","Geography","Geography","91 = geography; add place auxiliaries when appropriate."],
[/\bphilosophy\b|\bethics\b|\blogic\b|\bmetaphysics\b/,"1","Philosophy","Philosophy","1 = philosophy."],
[/\breligion\b|\btheology\b|\bislam\b|\bhinduism\b|\bchristianity\b|\bsikhism\b/,"2","Religion and theology","Religion","2 = religion and theology."],
[/\bpolitics\b|\bpolitical\b|\blaw\b|\beconomics\b|\beconomy\b|\beducation\b|\bsociology\b|\bmanagement\b/,"3","Social sciences","Social sciences","3 = social sciences."],
[/\bcomputer\b|\bcomputing\b|\bprogramming\b|\bsoftware\b|\bartificial intelligence\b|\bmachine learning\b/,"004","Computer science","Computing and information technology","004 = computer science and technology."],
[/\bjournalism\b|\bnewspaper\b|\bmedia\b|\bcommunication\b/,"070","Journalism and mass media","Journalism / media","070 = newspapers, journalism and mass media."],
[/\btourism\b|\btravel\b|\bhospitality\b/,"338.48","Tourism","Tourism and travel","338.48 = tourism."],
[/\bsport\b|\bsports\b|\bcricket\b|\bfootball\b|\bhockey\b|\btennis\b/,"796","Sport","Sport","796 = sport."],
[/\bmilitary\b|\bdefence\b|\bdefense\b|\bwar\b/,"355","Military science","Military science","355 = military science."],
[/\bbiography\b|\bautobiography\b|\bmemoir\b/,"92","Biography","Biography","92 = biography."]
];
function classify(title){
 const original=String(title||"").trim(); if(!original)return {ok:false,error:"Enter a book title."};
 if(KEY_ERROR)return {ok:false,error:"Answer key failed to load: "+KEY_ERROR.message};
 const n=norm(original),c=compact(original),x=EXACT.get(n)||EXACT.get(c);
 if(x)return make(original,x,"V12 loaded 2700+ title answer key",true);
 for(const [re,u,s,ss,e] of RULES)if(re.test(n))return make(original,{udc:u,subject:s,subSubject:ss,confidence:"Medium",explanation:e},"V12 contextual UDC rule",false);
 return make(original,{udc:"0",subject:"Generalities",subSubject:"No reliable stored/context match",confidence:"Low",explanation:"Title not found in the loaded answer key and no contextual rule matched."},"V12 safe fallback",false);
}
const srv=http.createServer((req,res)=>{
 if(req.method==="GET"&&(req.url==="/"||req.url==="/index.html")){res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});return fs.createReadStream(path.join(__dirname,"index.html")).pipe(res);}
 if(req.method==="GET"&&req.url==="/health"){res.writeHead(KEY_ERROR?500:200,{"Content-Type":"application/json; charset=utf-8"});return res.end(JSON.stringify({status:KEY_ERROR?"error":"ok",version:"V12",loadedTitles:key.entries?key.entries.length:0,keyFile:"udc-2600-key.json",error:KEY_ERROR?KEY_ERROR.message:null}));}
 if(req.method==="POST"&&req.url==="/api/classify"){let body="";req.on("data",c=>body+=c);req.on("end",()=>{try{const d=JSON.parse(body||"{}");res.writeHead(200,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});res.end(JSON.stringify(classify(d.title)));}catch(e){res.writeHead(400,{"Content-Type":"application/json"});res.end(JSON.stringify({ok:false,error:"Invalid request"}));}});return;}
 res.writeHead(404);res.end("Not found");
});
srv.listen(PORT,"0.0.0.0",()=>console.log("UDC Ultimate V12 listening; loadedTitles="+(key.entries?key.entries.length:0)));
