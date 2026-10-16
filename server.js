// fix.js — run once: node fix.js  (server.js must be in same folder)
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

let src = readFileSync("server.js", "utf8");
const log = [];

function rep(re, to, label) {
  const before = src;
  src = src.replace(re, to);
  if (src === before) { console.error("PATCH FAILED at: " + label); process.exit(1); }
  log.push("OK: " + label);
}

// 1) Groq key force-empty (health endpoint da ReferenceError bhi fix)
rep(/process\.env\.GROQ_API_KEY \|\| ""/, '""', "GROQ key disabled");

// 2) Health line ton groq status kaddo (+ koi wikipedia field)
rep(/,groqFallbackConfigured:!!GROQ_KEY/g, "", "health: groq field removed");
src = src.replace(/,wikipediaContext:[^,}]*/g, "");

// 3) Wikipedia functions poorian delete (fetchWikipediaEvidence + withWikipediaSources)
rep(/async function fetchWikipediaEvidence[\s\S]*?\n}\n\nfunction retrieveReferenceEvidence/,
    "function retrieveReferenceEvidence", "wikipedia functions deleted");

// 4) Route vich Wikipedia promise hatao
rep(/^ const \[bundledDDC,bundledUDC,wikipedia\]=await Promise\.all\(\[.*\]\);$/m,
    ' const bundledDDC=retrieveReferenceEvidence(title,"DDC",8,7000);\n const bundledUDC=retrieveReferenceEvidence(title,"UDC",6,5000);',
    "wikipedia fetch call removed");

// 5) wikiContext line empty
rep(/^ const wikiContext=.*$/m, ' const wikiContext="";', "wikiContext disabled");

// 6) Evidence join lines ton wikipedia hatao
rep("referenceEvidence=[bundledDDC,referenceEvidence,wikiContext]",
    "referenceEvidence=[bundledDDC,referenceEvidence]", "ddc evidence cleaned");
rep("udcReferenceEvidence=[bundledUDC,udcReferenceEvidence,wikiContext]",
    "udcReferenceEvidence=[bundledUDC,udcReferenceEvidence]", "udc evidence cleaned");

// 7) Saare withWikipediaSources(...) calls plain guard bana do
rep(/withWikipediaSources\(applyNumberMixingGuard\(([a-z]+),title,lc,dk\),wikipedia\)/g,
    "applyNumberMixingGuard($1,title,lc,dk)", "withWikipediaSources calls removed");

// 8) Groq backup block dead-code bana do (kade run nahi hunda)
rep(/if\(GROQ_KEY\)\{/, "if(false){", "groq fallback disabled");

// 9) groqPrimary function delete
rep(/async function groqPrimary[\s\S]*?\n}\n\nasync function gemini\(/,
    "async function gemini(", "groqPrimary deleted");

// 10) Crash-guard wrapper: applyNumberMixingGuard kabhi throw nahi kar sakda
rep("// EXPANDED UDC CONCEPTS FOR FALLBACK - V127 accuracy boost",
`// CRASH-GUARD V127: guard exception -> recoverable answer, no 500, no crash
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

// 11) Last line of route: recovery vi fail hove tan vi 200 + local deterministic answer
rep('  return res.status(200).json(applyNumberMixingGuard(recovered,title,lc,dk));',
`  try { return res.status(200).json(applyNumberMixingGuard(recovered,title,lc,dk)); }
  catch(e){
    console.error("classify recovery failed:", e.message);
    return res.status(200).json({...lc, status:"classified-local",
      engine:"Local deterministic fallback (no crash)",
      errors: (typeof errors!=="undefined"?errors:[]).concat(String(e.message))});
  }`, "final no-crash safety net");

// ---- verify ----
const checks = [
  [/fetchWikipediaEvidence\(title\)/, "wikipedia call gone"],
  [/en\.wikipedia\.org/, "wikipedia URL gone"],
  [/GROQ_API_KEY/, "groq env gone"],
  [/if\(GROQ_KEY\)/, "groq branch gone"],
];
for (const [re, label] of checks) {
  if (re.test(src)) { console.error("VERIFY FAILED: " + label); process.exit(1); }
}

writeFileSync("server.js", src);
console.log(log.join("\n"));
try { execSync("node --check server.js", {stdio:"inherit"}); console.log("\nSYNTAX OK — patch done ✔"); }
catch { console.error("SYNTAX ERROR after patch"); process.exit(1); }
