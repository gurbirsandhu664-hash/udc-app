const http=require("http"),fs=require("fs"),path=require("path"),{URL}=require("url");
const PORT=process.env.PORT||10000,HOST="0.0.0.0";
const GEMINI_KEY=process.env.GEMINI_API_KEY||"";
const GEMINI_MODEL=process.env.GEMINI_MODEL||"gemini-2.5-flash";
const ROOT=__dirname;
let records=[];
function flatten(x,out){
 if(Array.isArray(x)){for(const v of x)flatten(v,out);return}
 if(x&&typeof x==="object"){
  const title=x.title||x.bookTitle||x.name||x.query;
  const udc=x.udc||x.number||x.notation||x.classification||x.class;
  if(title&&udc)out.push({title:String(title),udc:String(udc),...x});
  for(const v of Object.values(x))if(v&&typeof v==="object")flatten(v,out);
 }
}
for(const file of ["udc-2700-key.json","udc-2600-key.json","udc-rules.json"]){
 try{const p=path.join(ROOT,file);if(fs.existsSync(p))flatten(JSON.parse(fs.readFileSync(p,"utf8")),records)}
 catch(e){console.log("Key warning:",file,e.message)}
}
function norm(s){return String(s||"").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s.():+\/\-]/gu," ").replace(/\s+/g," ").trim()}
function localMatch(t){
 const n=norm(t),exact=records.find(r=>norm(r.title)===n);if(exact)return exact;
 let best=null,score=0;
 for(const r of records){const a=new Set(n.split(" ")),b=new Set(norm(r.title).split(" "));let c=0;for(const w of a)if(b.has(w))c++;const s=c/Math.max(a.size,b.size);if(s>score){score=s;best=r}}
 return score>=.86?best:null;
}
const PROMPT=`You are an expert Universal Decimal Classification (UDC) verification assistant.
Use UDC ONLY. NEVER use Dewey Decimal Classification (DDC).
Classify the meaning of the book title, not isolated keywords.
Use Google Search grounding to research the title when needed.
Prefer official UDC Consortium/UDC documentation and reputable library catalogues, national libraries and university library catalogues.
Do not invent a UDC number. If evidence is insufficient, leave finalUDC empty and say Review required.
Consider main classes and legitimate auxiliaries: common auxiliaries, place, language, time, form, and relation signs such as +, /, :, ::, parentheses and brackets when supported by UDC rules.
For language/literature, distinguish language, literature and literary form.
Return ONLY JSON:
{"bookTitle":"","finalUDC":"","mainSubject":"","subSubject":"","explanation":"","confidence":"High|Medium|Low","verification":"Google-grounded verification|Review required","sources":[{"title":"","url":""}]}
The answer must be about UDC, not DDC.`;

async function askGemini(title){
 if(!GEMINI_KEY)return null;
 const body={contents:[{role:"user",parts:[{text:PROMPT+"\nBook title: "+title}]}],
 tools:[{google_search:{}}],
 generationConfig:{temperature:0.1,responseMimeType:"application/json"}};
 const u=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`;
 const r=await fetch(u,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
 const d=await r.json();if(!r.ok)throw Error(d?.error?.message||"Gemini request failed");
 const text=(d.candidates?.[0]?.content?.parts||[]).map(p=>p.text||"").join("");
 try{return JSON.parse(text)}catch(e){const m=text.match(/\{[\s\S]*\}/);return m?JSON.parse(m[0]):null}
}
function send(res,status,obj){res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});res.end(JSON.stringify(obj))}
const srv=http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,`http://${req.headers.host}`);
  if(req.method==="GET"&&u.pathname==="/api/status")return send(res,200,{ready:true,version:"V19",localRecords:records.length,geminiGoogleConfigured:!!GEMINI_KEY});
  if(req.method==="GET"&&u.pathname==="/api/classify"){
   const title=(u.searchParams.get("title")||"").trim();if(!title)return send(res,400,{error:"Enter a book title"});
   const hit=localMatch(title);
   if(hit)return send(res,200,{bookTitle:title,finalUDC:String(hit.udc||""),mainSubject:hit.mainSubject||hit.subject||"",subSubject:hit.subSubject||hit.subsubject||"",explanation:hit.explanation||hit.breakdown||"Matched in local UDC practice key.",confidence:"High",verification:"Local key",sources:[]});
   if(!GEMINI_KEY)return send(res,200,{bookTitle:title,finalUDC:"",mainSubject:"",subSubject:"",explanation:"Gemini API key is not configured on the server.",confidence:"Low",verification:"Review required",sources:[]});
   try{
    const ans=await askGemini(title);
    if(!ans)throw Error("No structured answer returned");
    ans.bookTitle=ans.bookTitle||title;ans.sources=Array.isArray(ans.sources)?ans.sources:[];
    ans.verification=ans.finalUDC?"Google-grounded verification":"Review required";
    return send(res,200,ans);
   }catch(e){return send(res,502,{bookTitle:title,finalUDC:"",mainSubject:"",subSubject:"",explanation:"Google-grounded Gemini verification failed: "+e.message,confidence:"Low",verification:"Review required",sources:[]})}
  }
  if(req.method==="GET"){return fs.readFile(path.join(ROOT,"index.html"),(e,b)=>{if(e){res.writeHead(404);return res.end("Not found")}res.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});res.end(b)})}
  res.writeHead(405);res.end("Method not allowed")
 }catch(e){send(res,500,{error:e.message})}
});
srv.listen(PORT,HOST,()=>console.log(`UDC V19 running. local=${records.length}, Gemini+Google=${!!GEMINI_KEY}`));