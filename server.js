// fix2.js — node fix2.js  (locally). Deploy mat karo.
import { readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";

let src = readFileSync("server.js", "utf8");
function rep(re, to, label){
  if(!re.test(src)){ console.log("SKIP (theek hai): " + label); return; }
  src = src.replace(re, to); console.log("OK: " + label);
}

// 1) Groq key — koi bhi form hove, empty kar do
rep(/const GROQ_KEY = [^;]+;/, 'const GROQ_KEY = "";', "groq key disabled");
// 2) Health line ton groq/wikipedia fields
rep(/,groqFallbackConfigured:!!GROQ_KEY/g, "", "health cleaned");
src = src.replace(/,wikipediaContext:[^,}]*/g, "");
// 3) Groq backup branch dead-code
rep(/if\(GROQ_KEY\)\{/g, "if(false){", "groq branch disabled");
// 4) groqPrimary function
rep(/async function groqPrimary[\s\S]*?(?=\nasync function gemini\()/, "", "groqPrimary deleted");
// 5) Wikipedia functions (retrieveReferenceEvidence bach ke)
rep(/async function fetchWikipediaEvidence[\s\S]*?(?=\nfunction retrieveReferenceEvidence)/, "", "wikipedia functions deleted");
// 6) Route vich wikipedia promise
rep(/^ const \[bundledDDC,bundledUDC,wikipedia\][^;]*;/m,
    ' const bundledDDC=retrieveReferenceEvidence(title,"DDC",8,7000);\n const bundledUDC=retrieveReferenceEvidence(title,"UDC",6,5000);',
    "wikipedia fetch call removed");
// 7) wikiContext empty
rep(/^ const wikiContext=[^;]*;/m, ' const wikiContext="";', "wikiContext disabled");
// 8) evidence joins ton wikipedia
rep("referenceEvidence=[bundledDDC,referenceEvidence,wikiContext]", "referenceEvidence=[bundledDDC,referenceEvidence]", "ddc evidence cleaned");
rep("udcReferenceEvidence=[bundledUDC,udcReferenceEvidence,wikiContext]", "udcReferenceEvidence=[bundledUDC,udcReferenceEvidence]", "udc evidence cleaned");
// 9) withWikipediaSources call sites
rep(/withWikipediaSources\(applyNumberMixingGuard\((out|recovered),title,lc,dk\),wikipedia\)/g, "applyNumberMixingGuard($1,title,lc,dk)", "wiki call-sites cleaned");
// 10) crash-guard (ik vaar hi lage)
if(!src.includes("CRASH-GUARD V127")){
  rep("// EXPANDED UDC CONCEPTS FOR FALLBACK - V127 accuracy boost",
`// CRASH-GUARD V127: guard exception -> recoverable answer, no 500
const _origGuard = applyNumberMixingGuard;
applyNumberMixingGuard = function(out,title,local,dk){
  try { return _origGuard(out,title,local,dk); }
  catch(e){
    console.error("number-mixing guard failed:", e.message);
    const safe = {...out, title, full_title:title,
      number_mixing_check:"guard-error-bypassed",
      number_mixing_audit:["guard-error: "+String(e.message)]};
    if(dk && dk.ddc_number){ safe.ddc_number=dk.ddc_number; safe.ddc_answer=dk.ddc_number; }
    return safe;
  }
};

// EXPANDED UDC CONCEPTS FOR FALLBACK - V127 accuracy boost`, "crash guard installed");
} else console.log("SKIP: crash guard already there");
// 11) last safety net (ik vaar hi lage)
if(!src.includes("classified-local")){
  rep('  return res.status(200).json(applyNumberMixingGuard(recovered,title,lc,dk));',
`  try { return res.status(200).json(applyNumberMixingGuard(recovered,title,lc,dk)); }
  catch(e){
    console.error("classify recovery failed:", e.message);
    return res.status(200).json({...lc, status:"classified-local",
      engine:"Local deterministic fallback (no crash)",
      errors: (typeof errors!=="undefined"?errors:[]).concat(String(e.message))});
  }`, "final safety net");
} else console.log("SKIP: safety net already there");

writeFileSync("server.js", src);
console.log("\nLeftover check — groq refs: " + (src.match(/groq/gi)||[]).length +
  ", wikipedia refs: " + (src.match(/wikipedia/gi)||[]).length + " (dead-code ch hona theek hai)");

// serve mode: Render te galti naal vi chal jove taan site chale
if(process.argv.includes("--serve") || process.env.RENDER){
  const c = spawn(process.execPath, ["server.js"], {stdio:"inherit"});
  c.on("exit", code => process.exit(code));
} else {
  const { execSync } = await import("node:child_process");
  try { execSync("node --check server.js", {stdio:"inherit"}); console.log("SYNTAX OK ✔"); }
  catch { console.error("SYNTAX ERROR"); process.exit(1); }
}
