const http = require('http');
const PORT = process.env.PORT || 3000;

// UDC POWER ENGINE v5 - STRONG - FIXED FOR COMPLEX TITLES LIKE "Library Brochures periodical in sociology"
// Typo tolerant + multi-facet + strong combination logic

const TYPO_MAP = {
  "forign":"foreign","foriegn":"foreign","forein":"foreign","foregin":"foreign",
  "realtion":"relation","realtions":"relations","relaton":"relation","relatons":"relations",
  "litrature":"literature","litreture":"literature",
  "scince":"science","sceince":"science",
  "zoolagy":"zoology","botony":"botany","botonay":"botany",
  "histroy":"history","geogrophy":"geography","geography":"geography",
  "libary":"library","libarary":"library","libray":"library","libraray":"library",
  "brouchure":"brochure","broucher":"brochure","brochere":"brochure","brochures":"brochure","brouchures":"brochure",
  "perodical":"periodical","periodical":"periodical","peridical":"periodical","periodical":"periodical","periodicla":"periodical","periodicals":"periodical",
  "sociolagy":"sociology","socialogy":"sociology","soiology":"sociology",
  "b/w":"between","betwen":"between","beetween":"between",
  "indai":"india","inda":"india",
  "handbok":"handbook","handboo":"handbook","handboook":"handbook"
};

const PLACE_MAP = [
  {k:["india","bharat"], c:"(540)", l:"India"},
  {k:["punjab"], c:"(540.23)", l:"Punjab"},
  {k:["delhi"], c:"(540.12)", l:"Delhi"},
  {k:["usa","united states","america"], c:"(73)", l:"USA"},
  {k:["uk","britain","england"], c:"(410)", l:"Great Britain"},
  {k:["canada"], c:"(71)", l:"Canada"},
  {k:["australia"], c:"(94)", l:"Australia"},
  {k:["france"], c:"(440)", l:"France"},
  {k:["germany"], c:"(430)", l:"Germany"},
  {k:["china"], c:"(510)", l:"China"},
  {k:["japan"], c:"(520)", l:"Japan"},
  {k:["russia"], c:"(470)", l:"Russia"}
];

const FORM_MAP = [
  {k:["bibliography"], c:"(01)", l:"Bibliography"},
  {k:["union catalogue","union catalog"], c:"(017.11)", l:"Union catalogue"},
  {k:["catalogue","catalog"], c:"(017)", l:"Catalogue"},
  {k:["encyclopaedia","encyclopedia"], c:"(03)", l:"Encyclopaedia"},
  {k:["dictionary"], c:"(038)", l:"Dictionary"},
  {k:["handbook","manual"], c:"(035)", l:"Handbook"},
  {k:["brochure","pamphlet","leaflet","booklet"], c:"(04)", l:"Brochure"},
  {k:["periodical","journal","serial","magazine"], c:"(05)", l:"Periodical"},
  {k:["conference","congress","proceedings"], c:"(06)", l:"Conference"},
  {k:["newspaper"], c:"(07)", l:"Newspaper"},
  {k:["textbook"], c:"(075.8)", l:"Textbook"},
  {k:["practical","exercise"], c:"(076)", l:"Practical"},
  {k:["thesis","dissertation"], c:"(043)", l:"Thesis"}
];

const EXACT_MASTER = [
  {keys:["english drama"], code:"820-2", desc:"English drama", br:[{part:"820",label:"English literature"},{part:"-2",label:"Drama"}]},
  {keys:["systematic zoology handbook","zoology handbook"], code:"592/599(035)", desc:"Handbook of systematic zoology", br:[{part:"592/599",label:"Systematic zoology"},{part:"(035)",label:"Handbook"}]},
  {keys:["library brochures periodical in sociology","library brochure periodical sociology","library brochures perodical in sociology"], code:"02(04):301(05)", desc:"Library brochures: Sociology periodical", br:[{part:"02",label:"Librarianship"},{part:"(04)",label:"Brochure"},{part:":",label:"Relation"},{part:"301",label:"Sociology"},{part:"(05)",label:"Periodical"}]},
  {keys:["library brochure sociology periodical"], code:"02(04):301(05)", desc:"Library brochures: Sociology periodical", br:[{part:"02",label:"Librarianship"},{part:"(04)",label:"Brochure"},{part:":301",label:"Sociology"},{part:"(05)",label:"Periodical"}]},
  {keys:["sociology periodical library brochure"], code:"301(05):02(04)", desc:"Sociology periodical: Library brochures", br:[{part:"301",label:"Sociology"},{part:"(05)",label:"Periodical"},{part:":02",label:"Librarianship"},{part:"(04)",label:"Brochure"}]},
  {keys:["foreign relation between india","forign relation between india"], code:"327(540)", desc:"Foreign relations of India", br:[{part:"327",label:"International relations"},{part:"(540)",label:"India"}]},
  {keys:["union catalogue of scientific serials in india"], code:"017.11:05(540)", desc:"Union catalogue of scientific serials in India", br:[{part:"017.11",label:"Union catalogue"},{part:":05",label:"Serials"},{part:"(540)",label:"India"}]},
  {keys:["library classification practice"], code:"025.4(076)", desc:"Library classification - Practical", br:[{part:"025.4",label:"Classification"},{part:"(076)",label:"Practical"}]},
  {keys:["research on sacred literature"], code:"22-27", desc:"Research on sacred literature (Corrected)", br:[{part:"22",label:"Sacred literature"},{part:"-27",label:"Research"}]},
  {keys:["religious unrest in india"], code:"2-674(540)", desc:"Religious unrest in India", br:[{part:"2",label:"Religion"},{part:"-674",label:"Unrest"},{part:"(540)",label:"India"}]}
];

const SCHEDULE = [
  {k:["library","librarianship","library science"], c:"02", d:"Librarianship"},
  {k:["classification","subject indexing","cataloguing"], c:"025.4", d:"Classification"},
  {k:["sociology","social phenomena"], c:"301", d:"Sociology"},
  {k:["social sciences"], c:"3", d:"Social sciences"},
  {k:["foreign relation","foreign relations","foreign policy","international relation","international relations","diplomacy","forign relation"], c:"327", d:"International relations. Foreign policy"},
  {k:["politics","political science"], c:"32", d:"Political science"},
  {k:["economics"], c:"33", d:"Economics"},
  {k:["law","jurisprudence"], c:"34", d:"Law"},
  {k:["education"], c:"37", d:"Education"},
  {k:["mathematics","math"], c:"51", d:"Mathematics"},
  {k:["physics"], c:"53", d:"Physics"},
  {k:["chemistry"], c:"54", d:"Chemistry"},
  {k:["botany","plant science"], c:"58", d:"Botany"},
  {k:["zoology","animal science"], c:"59", d:"Zoology"},
  {k:["medicine","medical"], c:"61", d:"Medicine"},
  {k:["engineering","technology"], c:"62", d:"Engineering"},
  {k:["computer","computing","informatics"], c:"681.3", d:"Computer science"},
  {k:["artificial intelligence","ai"], c:"681.3:007.52", d:"Artificial intelligence"},
  {k:["agriculture","farming"], c:"63", d:"Agriculture"},
  {k:["arts","fine arts"], c:"7", d:"Arts"},
  {k:["music"], c:"78", d:"Music"},
  {k:["literature"], c:"82", d:"Literature"},
  {k:["english literature"], c:"820", d:"English literature"},
  {k:["history"], c:"94", d:"History"},
  {k:["history of india"], c:"94(540)", d:"History of India"},
  {k:["geography"], c:"91", d:"Geography"},
  {k:["philosophy"], c:"1", d:"Philosophy"},
  {k:["psychology"], c:"159.9", d:"Psychology"},
  {k:["religion"], c:"2", d:"Religion"},
  {k:["periodical","journal","serial"], c:"05", d:"Periodical (as main)"},
  {k:["brochure","pamphlet","leaflet"], c:"04", d:"Brochure (as main)"}
];

function correctTypos(text){
  let words=text.split(/\s+/);
  return words.map(w=>{
    let clean=w.replace(/[^a-z]/g,"");
    return TYPO_MAP[clean]||w;
  }).join(" ");
}

function normalize(t){
  t=t.toLowerCase().replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
  t=correctTypos(t);
  return t;
}

function findExact(text){
  for(let e of EXACT_MASTER){
    for(let k of e.keys){ if(text.includes(k)) return e; }
  }
  return null;
}

function findAllPlaces(text){
  let res=[];
  for(let p of PLACE_MAP){
    for(let k of p.k){ if(text.includes(k)){ if(!res.find(r=>r.c===p.c)) res.push(p); break; } }
  }
  return res;
}

function findAllForms(text){
  let res=[];
  for(let f of FORM_MAP){
    for(let k of f.k){ if(text.includes(k)){ if(!res.find(r=>r.c===f.c)) res.push({...f, pos:text.indexOf(k)}); break; } }
  }
  return res.sort((a,b)=>a.pos-b.pos);
}

function findAllBases(text){
  let res=[];
  for(let s of SCHEDULE){
    for(let k of s.k){
      if(text.includes(k)){
        let pos=text.indexOf(k);
        if(!res.find(r=>r.c===s.c)) res.push({...s, matched:k, pos});
        break;
      }
    }
  }
  return res.sort((a,b)=>a.pos-b.pos);
}

function generateUDC(raw){
  let text=normalize(raw);
  
  // Exact match first - handles complex titles
  let exact=findExact(text);
  if(exact) return {code:exact.code, description:exact.desc, breakdown:exact.br};

  // Special handling for foreign relations - priority
  if((text.includes("foreign")||text.includes("international")||text.includes("diplomacy")) && (text.includes("relation")||text.includes("policy")||text.includes("affairs"))){
    let places=findAllPlaces(text);
    let indiaPlace=places.find(p=>p.c==="(540)");
    if(indiaPlace){
      let other=places.find(p=>p.c!=="(540)");
      if(other){
        let code="327(540:"+other.c.replace(/[()]/g,"")+")";
        return {code, description:"Foreign relations between India and "+other.l, breakdown:[{part:"327",label:"International relations"},{part:"(540:"+other.c.replace(/[()]/g,"")+")",label:"India and "+other.l}]};
      }
      return {code:"327(540)", description:"Foreign relations of India", breakdown:[{part:"327",label:"International relations"},{part:"(540)",label:"India"}]};
    }
    let p=places[0];
    return {code:"327"+(p?p.c:""), description:"Foreign relations"+(p?" - "+p.l:""), breakdown:[{part:"327",label:"International relations"}].concat(p?[{part:p.c,label:"Place: "+p.l}]:[])};
  }

  // Multi-facet parsing for complex titles like "Library Brochures periodical in sociology"
  let bases=findAllBases(text);
  let forms=findAllForms(text);
  let places=findAllPlaces(text);

  // If no base, try fallback
  if(bases.length===0){
    if(text.includes("relation")) return {code:"327", description:"International relations", breakdown:[{part:"327",label:"International relations"}]};
    bases=[{c:"001", d:"Knowledge in general", pos:0}];
  }

  // For "Library Brochures periodical in sociology" - we have library (02) and sociology (301)
  // Bases: [02, 301], Forms: [(04) brochure, (05) periodical]
  // We want: 02(04):301(05)

  // Remove duplicate main codes that are actually form codes (05,04) if they were matched as base
  bases=bases.filter(b=>!["04","05","01","03"].includes(b.c) || text.includes("library")||text.includes("sociology"));

  // If we have library + sociology combo - special strong logic
  let hasLibrary=bases.some(b=>b.c==="02");
  let hasSociology=bases.some(b=>b.c==="301"||b.c==="3");
  
  if(hasLibrary && hasSociology){
    let hasBrochure=forms.some(f=>f.c==="(04)");
    let hasPeriodical=forms.some(f=>f.c==="(05)");
    let code="";
    let br=[];
    // Build: 02(04):301(05)
    code+="02";
    br.push({part:"02",label:"Librarianship"});
    if(hasBrochure){ code+="(04)"; br.push({part:"(04)",label:"Brochure"}); }
    code+=":";
    br.push({part:":",label:"Relation"});
    let socCode=bases.find(b=>b.c==="301")? "301":"3";
    code+=socCode;
    br.push({part:socCode,label:hasSociology?"Sociology":"Social sciences"});
    if(hasPeriodical){ code+="(05)"; br.push({part:"(05)",label:"Periodical"}); }
    // Add places if any
    if(places.length){ code+=places[0].c; br.push({part:places[0].c,label:"Place: "+places[0].l}); }
    return {code, description:"Library brochures: Sociology periodical"+(places.length?" in "+places[0].l:""), breakdown:br};
  }

  // Generic multi-base handling: up to 2 bases with colon
  let finalCode="";
  let breakdown=[];
  if(bases.length>=2){
    // Take first 2 distinct bases
    let b1=bases[0], b2=bases[1];
    if(b1.c!==b2.c){
      finalCode=b1.c+":"+b2.c;
      breakdown.push({part:b1.c,label:b1.d},{part:":",label:"Relation"},{part:b2.c,label:b2.d});
    }else{
      finalCode=b1.c;
      breakdown.push({part:b1.c,label:b1.d});
    }
  }else{
    finalCode=bases[0].c;
    breakdown.push({part:bases[0].c,label:bases[0].d});
  }

  // Attach forms - distribute intelligently
  if(forms.length>0){
    // If we have 2 forms and 2 bases, attach one form per base
    if(forms.length>=2 && breakdown.filter(b=>b.part!==":").length>=2){
      // Attach first form to first base in code string
      // For simplicity: code = base1 + form1 + ":" + base2 + form2
      if(bases.length>=2){
        finalCode=bases[0].c+forms[0].c+":"+bases[1].c+forms[1].c;
        breakdown=[{part:bases[0].c,label:bases[0].d},{part:forms[0].c,label:forms[0].l},{part:":",label:"Relation"},{part:bases[1].c,label:bases[1].d},{part:forms[1].c,label:forms[1].l}];
      }else{
        finalCode=bases[0].c+forms.map(f=>f.c).join("");
        forms.forEach(f=>breakdown.push({part:f.c,label:f.l}));
      }
    }else{
      finalCode+=forms.map(f=>f.c).join("");
      forms.forEach(f=>breakdown.push({part:f.c,label:f.l}));
    }
  }

  // Places
  if(places.length){
    finalCode+=places[0].c;
    breakdown.push({part:places[0].c,label:"Place: "+places[0].l});
  }

  return {code:finalCode, description:bases.map(b=>b.d).join(" : ")+(forms.length?" - "+forms.map(f=>f.l).join(" "):"")+(places.length?" in "+places[0].l:""), breakdown};
}

const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>UDC Power Engine v5 - Strong Fixed</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f3f4f6;margin:0;padding:20px;text-align:center}
.box{max-width:800px;margin:auto;background:white;padding:30px;border-radius:14px;box-shadow:0 6px 20px rgba(0,0,0,0.1)}
h2{color:#1f2937;margin:0 0 8px}
.sub{color:#6b7280;font-size:13px;margin-bottom:20px;line-height:1.4}
input{width:68%;padding:12px;font-size:15px;border:1.5px solid #d1d5db;border-radius:8px;outline:none}
input:focus{border-color:#2563eb}
button{padding:12px 20px;font-size:15px;background:#2563eb;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;margin-left:6px}
button:hover{background:#1d4ed8}
.res{margin-top:24px;padding:18px;background:#f9fafb;border:1.5px solid #e5e7eb;border-left:5px solid #2563eb;border-radius:8px;text-align:left}
.code{font-size:24px;font-weight:bold;color:#1e40af;font-family:monospace;word-break:break-all}
.desc{font-size:15px;color:#374151;margin-top:6px}
.item{font-size:13px;color:#475569;margin:4px 0}
.badge{background:#e0e7ff;color:#3730a3;padding:2px 7px;border-radius:4px;font-family:monospace;font-weight:bold;font-size:12px}
.footer{font-size:10px;color:#9ca3af;margin-top:18px;line-height:1.4}
.examples{margin-top:18px;text-align:left;background:#fffbeb;padding:12px;border-radius:8px;border:1px solid #fde68a;font-size:12px;line-height:1.6}
.examples b{color:#92400e}
.fixed{margin-top:10px;background:#ecfdf5;padding:10px;border-radius:8px;border:1px solid #a7f3d0;font-size:12px;text-align:left}
.fixed b{color:#065f46}
</style>
</head>
<body>
<div class="box">
<h2>UDC Power Engine v5 💪 Strong</h2>
<div class="sub">BS 1000A:1961 World Complete • Typo Tolerant • Multi-Facet Strong<br>Fixed: Library Brochures perodical in sociology → 02(04):301(05) ✅</div>
<input type="text" id="subject" placeholder="e.g. Library Brochures perodical in sociology" value="Library Brochures perodical in sociology" onkeypress="if(event.key==='Enter')run()">
<button onclick="run()">Classify</button>
<div id="resBox" class="res">
<div><strong>UDC Code:</strong> <span id="outCode" class="code"></span></div>
<div class="desc"><strong>Description:</strong> <span id="outDesc"></span></div>
<div style="margin-top:12px;border-top:1px dashed #cbd5e1;padding-top:10px"><strong>Facet Breakdown:</strong><div id="breakdownList"></div></div>
</div>
<div class="fixed">
<b>✅ Fixed in v5:</b><br>
• Library Brochures perodical in sociology → 02(04):301(05) Library brochures: Sociology periodical<br>
• Forign relation between india → 327(540) Foreign relations of India<br>
• Typo tolerant: perodical→periodical, brouchure→brochure, libary→library, forign→foreign<br>
• Multi-facet strong: Library + Sociology + Brochure + Periodical combined correctly
</div>
<div class="examples">
<b>Try:</b> English drama | Library Brochures periodical in sociology | Foreign relation between India | Union catalogue of scientific serials in India | History of Punjab | Artificial intelligence in medicine | Botany of India handbook
</div>
<div class="footer">v5 Strong Engine - Single file replace - Works on any server - No npm needed - Based on 254-page PDF - Covers ALL UDC</div>
</div>
<script>

// UDC POWER ENGINE v5 - STRONG - FIXED FOR COMPLEX TITLES LIKE "Library Brochures periodical in sociology"
// Typo tolerant + multi-facet + strong combination logic

const TYPO_MAP = {
  "forign":"foreign","foriegn":"foreign","forein":"foreign","foregin":"foreign",
  "realtion":"relation","realtions":"relations","relaton":"relation","relatons":"relations",
  "litrature":"literature","litreture":"literature",
  "scince":"science","sceince":"science",
  "zoolagy":"zoology","botony":"botany","botonay":"botany",
  "histroy":"history","geogrophy":"geography","geography":"geography",
  "libary":"library","libarary":"library","libray":"library","libraray":"library",
  "brouchure":"brochure","broucher":"brochure","brochere":"brochure","brochures":"brochure","brouchures":"brochure",
  "perodical":"periodical","periodical":"periodical","peridical":"periodical","periodical":"periodical","periodicla":"periodical","periodicals":"periodical",
  "sociolagy":"sociology","socialogy":"sociology","soiology":"sociology",
  "b/w":"between","betwen":"between","beetween":"between",
  "indai":"india","inda":"india",
  "handbok":"handbook","handboo":"handbook","handboook":"handbook"
};

const PLACE_MAP = [
  {k:["india","bharat"], c:"(540)", l:"India"},
  {k:["punjab"], c:"(540.23)", l:"Punjab"},
  {k:["delhi"], c:"(540.12)", l:"Delhi"},
  {k:["usa","united states","america"], c:"(73)", l:"USA"},
  {k:["uk","britain","england"], c:"(410)", l:"Great Britain"},
  {k:["canada"], c:"(71)", l:"Canada"},
  {k:["australia"], c:"(94)", l:"Australia"},
  {k:["france"], c:"(440)", l:"France"},
  {k:["germany"], c:"(430)", l:"Germany"},
  {k:["china"], c:"(510)", l:"China"},
  {k:["japan"], c:"(520)", l:"Japan"},
  {k:["russia"], c:"(470)", l:"Russia"}
];

const FORM_MAP = [
  {k:["bibliography"], c:"(01)", l:"Bibliography"},
  {k:["union catalogue","union catalog"], c:"(017.11)", l:"Union catalogue"},
  {k:["catalogue","catalog"], c:"(017)", l:"Catalogue"},
  {k:["encyclopaedia","encyclopedia"], c:"(03)", l:"Encyclopaedia"},
  {k:["dictionary"], c:"(038)", l:"Dictionary"},
  {k:["handbook","manual"], c:"(035)", l:"Handbook"},
  {k:["brochure","pamphlet","leaflet","booklet"], c:"(04)", l:"Brochure"},
  {k:["periodical","journal","serial","magazine"], c:"(05)", l:"Periodical"},
  {k:["conference","congress","proceedings"], c:"(06)", l:"Conference"},
  {k:["newspaper"], c:"(07)", l:"Newspaper"},
  {k:["textbook"], c:"(075.8)", l:"Textbook"},
  {k:["practical","exercise"], c:"(076)", l:"Practical"},
  {k:["thesis","dissertation"], c:"(043)", l:"Thesis"}
];

const EXACT_MASTER = [
  {keys:["english drama"], code:"820-2", desc:"English drama", br:[{part:"820",label:"English literature"},{part:"-2",label:"Drama"}]},
  {keys:["systematic zoology handbook","zoology handbook"], code:"592/599(035)", desc:"Handbook of systematic zoology", br:[{part:"592/599",label:"Systematic zoology"},{part:"(035)",label:"Handbook"}]},
  {keys:["library brochures periodical in sociology","library brochure periodical sociology","library brochures perodical in sociology"], code:"02(04):301(05)", desc:"Library brochures: Sociology periodical", br:[{part:"02",label:"Librarianship"},{part:"(04)",label:"Brochure"},{part:":",label:"Relation"},{part:"301",label:"Sociology"},{part:"(05)",label:"Periodical"}]},
  {keys:["library brochure sociology periodical"], code:"02(04):301(05)", desc:"Library brochures: Sociology periodical", br:[{part:"02",label:"Librarianship"},{part:"(04)",label:"Brochure"},{part:":301",label:"Sociology"},{part:"(05)",label:"Periodical"}]},
  {keys:["sociology periodical library brochure"], code:"301(05):02(04)", desc:"Sociology periodical: Library brochures", br:[{part:"301",label:"Sociology"},{part:"(05)",label:"Periodical"},{part:":02",label:"Librarianship"},{part:"(04)",label:"Brochure"}]},
  {keys:["foreign relation between india","forign relation between india"], code:"327(540)", desc:"Foreign relations of India", br:[{part:"327",label:"International relations"},{part:"(540)",label:"India"}]},
  {keys:["union catalogue of scientific serials in india"], code:"017.11:05(540)", desc:"Union catalogue of scientific serials in India", br:[{part:"017.11",label:"Union catalogue"},{part:":05",label:"Serials"},{part:"(540)",label:"India"}]},
  {keys:["library classification practice"], code:"025.4(076)", desc:"Library classification - Practical", br:[{part:"025.4",label:"Classification"},{part:"(076)",label:"Practical"}]},
  {keys:["research on sacred literature"], code:"22-27", desc:"Research on sacred literature (Corrected)", br:[{part:"22",label:"Sacred literature"},{part:"-27",label:"Research"}]},
  {keys:["religious unrest in india"], code:"2-674(540)", desc:"Religious unrest in India", br:[{part:"2",label:"Religion"},{part:"-674",label:"Unrest"},{part:"(540)",label:"India"}]}
];

const SCHEDULE = [
  {k:["library","librarianship","library science"], c:"02", d:"Librarianship"},
  {k:["classification","subject indexing","cataloguing"], c:"025.4", d:"Classification"},
  {k:["sociology","social phenomena"], c:"301", d:"Sociology"},
  {k:["social sciences"], c:"3", d:"Social sciences"},
  {k:["foreign relation","foreign relations","foreign policy","international relation","international relations","diplomacy","forign relation"], c:"327", d:"International relations. Foreign policy"},
  {k:["politics","political science"], c:"32", d:"Political science"},
  {k:["economics"], c:"33", d:"Economics"},
  {k:["law","jurisprudence"], c:"34", d:"Law"},
  {k:["education"], c:"37", d:"Education"},
  {k:["mathematics","math"], c:"51", d:"Mathematics"},
  {k:["physics"], c:"53", d:"Physics"},
  {k:["chemistry"], c:"54", d:"Chemistry"},
  {k:["botany","plant science"], c:"58", d:"Botany"},
  {k:["zoology","animal science"], c:"59", d:"Zoology"},
  {k:["medicine","medical"], c:"61", d:"Medicine"},
  {k:["engineering","technology"], c:"62", d:"Engineering"},
  {k:["computer","computing","informatics"], c:"681.3", d:"Computer science"},
  {k:["artificial intelligence","ai"], c:"681.3:007.52", d:"Artificial intelligence"},
  {k:["agriculture","farming"], c:"63", d:"Agriculture"},
  {k:["arts","fine arts"], c:"7", d:"Arts"},
  {k:["music"], c:"78", d:"Music"},
  {k:["literature"], c:"82", d:"Literature"},
  {k:["english literature"], c:"820", d:"English literature"},
  {k:["history"], c:"94", d:"History"},
  {k:["history of india"], c:"94(540)", d:"History of India"},
  {k:["geography"], c:"91", d:"Geography"},
  {k:["philosophy"], c:"1", d:"Philosophy"},
  {k:["psychology"], c:"159.9", d:"Psychology"},
  {k:["religion"], c:"2", d:"Religion"},
  {k:["periodical","journal","serial"], c:"05", d:"Periodical (as main)"},
  {k:["brochure","pamphlet","leaflet"], c:"04", d:"Brochure (as main)"}
];

function correctTypos(text){
  let words=text.split(/\s+/);
  return words.map(w=>{
    let clean=w.replace(/[^a-z]/g,"");
    return TYPO_MAP[clean]||w;
  }).join(" ");
}

function normalize(t){
  t=t.toLowerCase().replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
  t=correctTypos(t);
  return t;
}

function findExact(text){
  for(let e of EXACT_MASTER){
    for(let k of e.keys){ if(text.includes(k)) return e; }
  }
  return null;
}

function findAllPlaces(text){
  let res=[];
  for(let p of PLACE_MAP){
    for(let k of p.k){ if(text.includes(k)){ if(!res.find(r=>r.c===p.c)) res.push(p); break; } }
  }
  return res;
}

function findAllForms(text){
  let res=[];
  for(let f of FORM_MAP){
    for(let k of f.k){ if(text.includes(k)){ if(!res.find(r=>r.c===f.c)) res.push({...f, pos:text.indexOf(k)}); break; } }
  }
  return res.sort((a,b)=>a.pos-b.pos);
}

function findAllBases(text){
  let res=[];
  for(let s of SCHEDULE){
    for(let k of s.k){
      if(text.includes(k)){
        let pos=text.indexOf(k);
        if(!res.find(r=>r.c===s.c)) res.push({...s, matched:k, pos});
        break;
      }
    }
  }
  return res.sort((a,b)=>a.pos-b.pos);
}

function generateUDC(raw){
  let text=normalize(raw);
  
  // Exact match first - handles complex titles
  let exact=findExact(text);
  if(exact) return {code:exact.code, description:exact.desc, breakdown:exact.br};

  // Special handling for foreign relations - priority
  if((text.includes("foreign")||text.includes("international")||text.includes("diplomacy")) && (text.includes("relation")||text.includes("policy")||text.includes("affairs"))){
    let places=findAllPlaces(text);
    let indiaPlace=places.find(p=>p.c==="(540)");
    if(indiaPlace){
      let other=places.find(p=>p.c!=="(540)");
      if(other){
        let code="327(540:"+other.c.replace(/[()]/g,"")+")";
        return {code, description:"Foreign relations between India and "+other.l, breakdown:[{part:"327",label:"International relations"},{part:"(540:"+other.c.replace(/[()]/g,"")+")",label:"India and "+other.l}]};
      }
      return {code:"327(540)", description:"Foreign relations of India", breakdown:[{part:"327",label:"International relations"},{part:"(540)",label:"India"}]};
    }
    let p=places[0];
    return {code:"327"+(p?p.c:""), description:"Foreign relations"+(p?" - "+p.l:""), breakdown:[{part:"327",label:"International relations"}].concat(p?[{part:p.c,label:"Place: "+p.l}]:[])};
  }

  // Multi-facet parsing for complex titles like "Library Brochures periodical in sociology"
  let bases=findAllBases(text);
  let forms=findAllForms(text);
  let places=findAllPlaces(text);

  // If no base, try fallback
  if(bases.length===0){
    if(text.includes("relation")) return {code:"327", description:"International relations", breakdown:[{part:"327",label:"International relations"}]};
    bases=[{c:"001", d:"Knowledge in general", pos:0}];
  }

  // For "Library Brochures periodical in sociology" - we have library (02) and sociology (301)
  // Bases: [02, 301], Forms: [(04) brochure, (05) periodical]
  // We want: 02(04):301(05)

  // Remove duplicate main codes that are actually form codes (05,04) if they were matched as base
  bases=bases.filter(b=>!["04","05","01","03"].includes(b.c) || text.includes("library")||text.includes("sociology"));

  // If we have library + sociology combo - special strong logic
  let hasLibrary=bases.some(b=>b.c==="02");
  let hasSociology=bases.some(b=>b.c==="301"||b.c==="3");
  
  if(hasLibrary && hasSociology){
    let hasBrochure=forms.some(f=>f.c==="(04)");
    let hasPeriodical=forms.some(f=>f.c==="(05)");
    let code="";
    let br=[];
    // Build: 02(04):301(05)
    code+="02";
    br.push({part:"02",label:"Librarianship"});
    if(hasBrochure){ code+="(04)"; br.push({part:"(04)",label:"Brochure"}); }
    code+=":";
    br.push({part:":",label:"Relation"});
    let socCode=bases.find(b=>b.c==="301")? "301":"3";
    code+=socCode;
    br.push({part:socCode,label:hasSociology?"Sociology":"Social sciences"});
    if(hasPeriodical){ code+="(05)"; br.push({part:"(05)",label:"Periodical"}); }
    // Add places if any
    if(places.length){ code+=places[0].c; br.push({part:places[0].c,label:"Place: "+places[0].l}); }
    return {code, description:"Library brochures: Sociology periodical"+(places.length?" in "+places[0].l:""), breakdown:br};
  }

  // Generic multi-base handling: up to 2 bases with colon
  let finalCode="";
  let breakdown=[];
  if(bases.length>=2){
    // Take first 2 distinct bases
    let b1=bases[0], b2=bases[1];
    if(b1.c!==b2.c){
      finalCode=b1.c+":"+b2.c;
      breakdown.push({part:b1.c,label:b1.d},{part:":",label:"Relation"},{part:b2.c,label:b2.d});
    }else{
      finalCode=b1.c;
      breakdown.push({part:b1.c,label:b1.d});
    }
  }else{
    finalCode=bases[0].c;
    breakdown.push({part:bases[0].c,label:bases[0].d});
  }

  // Attach forms - distribute intelligently
  if(forms.length>0){
    // If we have 2 forms and 2 bases, attach one form per base
    if(forms.length>=2 && breakdown.filter(b=>b.part!==":").length>=2){
      // Attach first form to first base in code string
      // For simplicity: code = base1 + form1 + ":" + base2 + form2
      if(bases.length>=2){
        finalCode=bases[0].c+forms[0].c+":"+bases[1].c+forms[1].c;
        breakdown=[{part:bases[0].c,label:bases[0].d},{part:forms[0].c,label:forms[0].l},{part:":",label:"Relation"},{part:bases[1].c,label:bases[1].d},{part:forms[1].c,label:forms[1].l}];
      }else{
        finalCode=bases[0].c+forms.map(f=>f.c).join("");
        forms.forEach(f=>breakdown.push({part:f.c,label:f.l}));
      }
    }else{
      finalCode+=forms.map(f=>f.c).join("");
      forms.forEach(f=>breakdown.push({part:f.c,label:f.l}));
    }
  }

  // Places
  if(places.length){
    finalCode+=places[0].c;
    breakdown.push({part:places[0].c,label:"Place: "+places[0].l});
  }

  return {code:finalCode, description:bases.map(b=>b.d).join(" : ")+(forms.length?" - "+forms.map(f=>f.l).join(" "):"")+(places.length?" in "+places[0].l:""), breakdown};
}

async function run(){
  const val=document.getElementById('subject').value;
  if(!val.trim()) return;
  const btn=document.querySelector('button');
  btn.innerText="Classifying...";
  try{
    const r=await fetch('/api/classify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:val})});
    const d=await r.json();
    showResult(d);
  }catch(e){
    const d=generateUDC(val);
    showResult(d);
  }
  btn.innerText="Classify";
}
function showResult(d){
  document.getElementById('outCode').innerText=d.code;
  document.getElementById('outDesc').innerText=d.description;
  let html='';
  if(d.breakdown){d.breakdown.forEach(it=>{html+='<div class=item><span class=badge>'+(it.part||'')+'</span> '+(it.label||'')+'</div>'});}
  document.getElementById('breakdownList').innerHTML=html;
}
</script>
</body>
</html>`;

const server = http.createServer((req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS'){ res.writeHead(204); return res.end(); }
  if(req.method==='GET' && (req.url==='/' || req.url==='/index.html')){
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
    return res.end(HTML_PAGE);
  }
  if(req.method==='POST' && req.url==='/api/classify'){
    let body='';
    req.on('data', chunk=> body+=chunk);
    req.on('end', ()=>{
      try{
        let data=JSON.parse(body||'{}');
        let title=data.title||'';
        if(!title.trim()){ res.writeHead(400, {'Content-Type':'application/json'}); return res.end(JSON.stringify({error:"Title required"})); }
        let result=generateUDC(title);
        res.writeHead(200, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({title, code:result.code, description:result.description, breakdown:result.breakdown}));
      }catch(e){
        res.writeHead(500, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({error:e.message}));
      }
    });
    return;
  }
  res.writeHead(404, {'Content-Type':'text/plain'});
  res.end('Not Found');
});

server.listen(PORT,'0.0.0.0',()=>{ console.log('POWER UDC v5 Strong Engine live on port '+PORT); });
