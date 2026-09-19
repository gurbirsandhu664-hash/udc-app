import express from "express";
import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";

const app=express(); app.use(express.json({limit:"64kb"})); app.use(express.static("."));
const port=Number(process.env.PORT||10000);
const list=(a,b)=>[...(process.env[a+"_KEYS"]||"").split(","),process.env[a+"_KEY"]||""].map(x=>x.trim()).filter(Boolean).filter((x,i,A)=>A.indexOf(x)===i);
const geminiKeys=()=>list("GEMINI","GEMINI");
const groqKeys=()=>list("GROQ","GROQ");
const gmodel=process.env.GEMINI_MODEL||"gemini-2.5-flash";
const groqModel=process.env.GROQ_MODEL||"groq/compound";

const RULES=`You are the FINAL Universal Decimal Classification (UDC) classifier.
UDC ONLY; NEVER DDC. The user gives a book title. Search/consider authoritative UDC evidence.
Prefer official UDC Summary/UDC Consortium material and reputable library catalogues.
Use UDC hierarchy, common/special auxiliaries, language, place, time, form, literary form and synthesis signs when justified.
Do not invent a UDC number. Never output 0 or a DDC number.
IMPORTANT: A broad title such as "Education" should not be made artificially specific without evidence.
Return ONLY JSON:
{"verified":true,"udc":"...","title":"...","mainSubject":"...","subSubject":"...","explanation":"...","confidence":"High|Medium|Low","sources":[{"title":"...","url":"..."}]}
If evidence is insufficient: {"verified":false,"udc":"","title":"...","mainSubject":"","subSubject":"","explanation":"...","confidence":"Low","sources":[]}`;

function json(text){let s=String(text||"").replace(/^```json\s*/i,"").replace(/```$/,"").trim();try{return JSON.parse(s)}catch{}let a=s.indexOf("{"),b=s.lastIndexOf("}");if(a>=0&&b>a)try{return JSON.parse(s.slice(a,b+1))}catch{}return null}
function grounded(resp){let a=[];for(const c of resp?.candidates?.[0]?.groundingMetadata?.groundingChunks||[]){if(c.web?.uri)a.push({title:c.web.title||c.web.uri,url:c.web.uri})}return [...new Map(a.map(x=>[x.url,x])).values()].slice(0,10)}

async function gemini(key,title,research=""){
 const ai=new GoogleGenAI({apiKey:key});
 const r=await ai.models.generateContent({model:gmodel,contents:`${RULES}\nTITLE: ${title}\n${research}\nUse Google Search grounding when available and base the final classification on evidence.`,config:{tools:[{googleSearch:{}}]}});
 const j=json(r.text); if(!j)throw Error("invalid Gemini response");
 j.sources=grounded(r); if(j.verified&&!j.udc)j.verified=false;
 return j;
}
async function groq(key,title){
 const g=new Groq({apiKey:key});
 const r=await g.chat.completions.create({model:groqModel,messages:[
 {role:"system",content:RULES},
 {role:"user",content:`Research this title and return possible UDC candidates with reasons. This is RESEARCH ONLY; Gemini will make the final decision.\nTITLE: ${title}`}
 ],temperature:.1});
 return r?.choices?.[0]?.message?.content||"";
}
function clean(j,title,status){if(!j?.verified||!j.udc||j.udc==="0")return {verified:false,title,message:j?.explanation||"No defensible UDC classification was verified.",providerStatus:status};return {...j,title:j.title||title,providerStatus:status}}

app.get("/api/health",(req,res)=>res.json({ok:true,version:"V28",geminiKeys:geminiKeys().length,groqKeys:groqKeys().length}));

app.post("/api/classify",async(req,res)=>{
 const title=String(req.body?.title||"").trim(); if(!title)return res.status(400).json({verified:false,message:"Enter a title."});
 let research="";
 // Groq is optional research only. Its UDC number is never returned as final.
 for(const k of groqKeys()){try{research=await groq(k,title);break}catch(e){console.log("Groq research unavailable:",e.message)}}
 // Gemini is the only AI final classifier.
 for(const k of geminiKeys()){try{
   const j=await gemini(k,title,research); if(j.verified&&j.udc)return res.json(clean(j,title,"GEMINI FINAL + GOOGLE EVIDENCE"));
 }catch(e){console.log("Gemini:",e.message)}}
 return res.json({verified:false,title,message:"No defensible UDC classification was verified. No random UDC number was invented.",providerStatus:"NO VERIFIED RESULT"});
});
app.get("/*splat",(req,res)=>res.sendFile(process.cwd()+"/index.html"));
app.listen(port,()=>console.log("UDC V28 on "+port));
