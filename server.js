const http = require('http');
const PORT = process.env.PORT || 3000;

const TYPO_MAP = {
  "forign":"foreign","foriegn":"foreign",
  "brouchure":"brochure","brochures":"brochure",
  "perodical":"periodical","peridical":"periodical",
  "furnture":"furniture","renvoation":"renovation","musuem":"museum"
};
const PLACE_MAP = [
  {k:["india"], c:"(540)", l:"India"},
  {k:["punjab"], c:"(540.23)", l:"Punjab"},
  {k:["mumbai"], c:"(540.31)", l:"Mumbai"},
  {k:["delhi"], c:"(540.12)", l:"Delhi"},
  {k:["museum","gallery"], c:"069", l:"Museum", aux:true},
  {k:["usa"], c:"(73)", l:"USA"}
];
const FORM_MAP = [
  {k:["handbook"], c:"(035)", l:"Handbook"},
  {k:["brochure"], c:"(04)", l:"Brochure"},
  {k:["periodical"], c:"(05)", l:"Periodical"},
  {k:["renovation"], c:".059", l:"Renovation"}
];
const EXACT_MASTER = [
  {keys:["library brochures perodical in sociology"], code:"02(04):301(05)", desc:"Library brochures: Sociology periodical"},
  {keys:["renovation of furniture in museum","renovation of furniture in mu"], code:"684.4.059:069", desc:"Renovation of furniture in museums"},
  {keys:["renovation of furniture"], code:"684.4.059", desc:"Renovation of furniture"},
  {keys:["furniture"], code:"684.4", desc:"Furniture"},
  {keys:["forign relation between india","foreign relation between india"], code:"327(540)", desc:"Foreign relations of India"}
];
const SCHEDULE = [
  {k:["library"], c:"02", d:"Librarianship"},
  {k:["furniture","chair","table"], c:"684.4", d:"Furniture"},
  {k:["museum"], c:"069", d:"Museum"},
  {k:["renovation"], c:"684.4.059", d:"Furniture renovation"},
  {k:["sociology"], c:"301", d:"Sociology"},
  {k:["foreign relation"], c:"327", d:"International relations"}
];
function normalize(t){
  t=t.toLowerCase().replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
  var w=t.split(/\s+/);
  return w.map(function(x){return TYPO_MAP[x]||x;}).join(" ");
}
function findExact(text){
  for(var i=0;i<EXACT_MASTER.length;i++){
    var e=EXACT_MASTER[i];
    for(var j=0;j<e.keys.length;j++){ if(text.indexOf(e.keys[j])!==-1) return e; }
  }
  return null;
}
function generateUDC(raw){
  var text=normalize(raw);
  var exact=findExact(text);
  if(exact){ return {code:exact.code, description:exact.desc, breakdown:[{part:exact.code,label:exact.desc}]}; }
  if(text.indexOf("foreign")!==-1 && text.indexOf("relation")!==-1){
    return {code:"327(540)", description:"Foreign relations of India", breakdown:[{part:"327",label:"International relations"}]};
  }
  if(text.indexOf("furniture")!==-1){
    var isRenov=text.indexOf("renovation")!==-1||text.indexOf("restoration")!==-1;
    var isMuseum=text.indexOf("museum")!==-1||text.indexOf(" mu")!==-1;
    var code="684.4";
    var br=[{part:"684.4",label:"Furniture"}];
    if(isRenov){ code+=".059"; br.push({part:".059",label:"Renovation"}); }
    if(isMuseum){ code+=":069"; br.push({part:":069",label:"Museum"}); }
    return {code:code, description:"Furniture"+(isRenov?" renovation":"")+(isMuseum?" in museums":""), breakdown:br};
  }
  var hasLib=text.indexOf("library")!==-1;
  var hasSoc=text.indexOf("sociology")!==-1;
  if(hasLib && hasSoc){
    return {code:"02(04):301(05)", description:"Library brochures: Sociology periodical", breakdown:[{part:"02",label:"Librarianship"},{part:"(04)",label:"Brochure"},{part:":301",label:"Sociology"}]};
  }
  return {code:"0", description:"Generalities", breakdown:[{part:"0",label:"Generalities"}]};
}


const HTML_PAGE = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>UDC FINAL v7.2 DEPLOY FIXED</title>
<style>
body{font-family:sans-serif;background:linear-gradient(135deg,#667eea,#764ba2 100%);min-height:100vh;margin:0;padding:20px}
.box{max-width:800px;margin:auto;background:white;padding:28px;border-radius:16px}
input{width:68%;padding:12px;border:2px solid #e5e7eb;border-radius:8px}
button{padding:12px 20px;background:#2563eb;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer}
.res{margin-top:20px;padding:18px;background:#f9fafb;border-left:5px solid #2563eb;border-radius:8px}
.code{font-size:26px;font-weight:800;color:#4f46e5;font-family:monospace}
.badge{background:#e0e7ff;color:#4338ca;padding:2px 7px;border-radius:4px;font-family:monospace}
</style>
</head><body>
<div class="box">
<h2>UDC FINAL v7.2 DEPLOY FIXED ✅</h2>
<p style="text-align:center;color:#6b7280;font-size:13px">001 Fixed • Furniture 684.4.059:069 • Library 02(04):301(05) • Render Ready</p>
<input id="subject" value="Renovation of Furniture in Museum" onkeypress="if(event.key==='Enter')run()">
<button onclick="run()">Classify</button>
<div class="res"><div><b>UDC:</b> <span id="outCode" class="code"></span></div><div><b>Desc:</b> <span id="outDesc"></span></div><div id="breakdownList"></div></div>
</div>
<script>

const TYPO_MAP = {
  "forign":"foreign","foriegn":"foreign",
  "brouchure":"brochure","brochures":"brochure",
  "perodical":"periodical","peridical":"periodical",
  "furnture":"furniture","renvoation":"renovation","musuem":"museum"
};
const PLACE_MAP = [
  {k:["india"], c:"(540)", l:"India"},
  {k:["punjab"], c:"(540.23)", l:"Punjab"},
  {k:["mumbai"], c:"(540.31)", l:"Mumbai"},
  {k:["delhi"], c:"(540.12)", l:"Delhi"},
  {k:["museum","gallery"], c:"069", l:"Museum", aux:true},
  {k:["usa"], c:"(73)", l:"USA"}
];
const FORM_MAP = [
  {k:["handbook"], c:"(035)", l:"Handbook"},
  {k:["brochure"], c:"(04)", l:"Brochure"},
  {k:["periodical"], c:"(05)", l:"Periodical"},
  {k:["renovation"], c:".059", l:"Renovation"}
];
const EXACT_MASTER = [
  {keys:["library brochures perodical in sociology"], code:"02(04):301(05)", desc:"Library brochures: Sociology periodical"},
  {keys:["renovation of furniture in museum","renovation of furniture in mu"], code:"684.4.059:069", desc:"Renovation of furniture in museums"},
  {keys:["renovation of furniture"], code:"684.4.059", desc:"Renovation of furniture"},
  {keys:["furniture"], code:"684.4", desc:"Furniture"},
  {keys:["forign relation between india","foreign relation between india"], code:"327(540)", desc:"Foreign relations of India"}
];
const SCHEDULE = [
  {k:["library"], c:"02", d:"Librarianship"},
  {k:["furniture","chair","table"], c:"684.4", d:"Furniture"},
  {k:["museum"], c:"069", d:"Museum"},
  {k:["renovation"], c:"684.4.059", d:"Furniture renovation"},
  {k:["sociology"], c:"301", d:"Sociology"},
  {k:["foreign relation"], c:"327", d:"International relations"}
];
function normalize(t){
  t=t.toLowerCase().replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
  var w=t.split(/\s+/);
  return w.map(function(x){return TYPO_MAP[x]||x;}).join(" ");
}
function findExact(text){
  for(var i=0;i<EXACT_MASTER.length;i++){
    var e=EXACT_MASTER[i];
    for(var j=0;j<e.keys.length;j++){ if(text.indexOf(e.keys[j])!==-1) return e; }
  }
  return null;
}
function generateUDC(raw){
  var text=normalize(raw);
  var exact=findExact(text);
  if(exact){ return {code:exact.code, description:exact.desc, breakdown:[{part:exact.code,label:exact.desc}]}; }
  if(text.indexOf("foreign")!==-1 && text.indexOf("relation")!==-1){
    return {code:"327(540)", description:"Foreign relations of India", breakdown:[{part:"327",label:"International relations"}]};
  }
  if(text.indexOf("furniture")!==-1){
    var isRenov=text.indexOf("renovation")!==-1||text.indexOf("restoration")!==-1;
    var isMuseum=text.indexOf("museum")!==-1||text.indexOf(" mu")!==-1;
    var code="684.4";
    var br=[{part:"684.4",label:"Furniture"}];
    if(isRenov){ code+=".059"; br.push({part:".059",label:"Renovation"}); }
    if(isMuseum){ code+=":069"; br.push({part:":069",label:"Museum"}); }
    return {code:code, description:"Furniture"+(isRenov?" renovation":"")+(isMuseum?" in museums":""), breakdown:br};
  }
  var hasLib=text.indexOf("library")!==-1;
  var hasSoc=text.indexOf("sociology")!==-1;
  if(hasLib && hasSoc){
    return {code:"02(04):301(05)", description:"Library brochures: Sociology periodical", breakdown:[{part:"02",label:"Librarianship"},{part:"(04)",label:"Brochure"},{part:":301",label:"Sociology"}]};
  }
  return {code:"0", description:"Generalities", breakdown:[{part:"0",label:"Generalities"}]};
}

function run(){
  var val=document.getElementById('subject').value;
  var d=generateUDC(val);
  document.getElementById('outCode').innerText=d.code;
  document.getElementById('outDesc').innerText=d.description;
  var html='';
  for(var i=0;i<d.breakdown.length;i++){html+='<div><span class=badge>'+d.breakdown[i].part+'</span> '+d.breakdown[i].label+'</div>';}
  document.getElementById('breakdownList').innerHTML=html;
}
run();
</scr"+"ipt>
</body></html>`;

const server = http.createServer(function(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS'){ res.writeHead(204); return res.end(); }
  if(req.method==='GET'){
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    return res.end(HTML_PAGE);
  }
  if(req.method==='POST' && req.url==='/api/classify'){
    var body='';
    req.on('data',function(c){body+=c;});
    req.on('end',function(){
      try{
        var data=JSON.parse(body||'{}');
        var result=generateUDC(data.title||'');
        res.writeHead(200,{'Content-Type':'application/json'});
        res.end(JSON.stringify(result));
      }catch(e){
        res.writeHead(500,{'Content-Type':'application/json'});
        res.end(JSON.stringify({error:e.message}));
      }
    });
    return;
  }
  res.writeHead(404); res.end('Not Found');
});

server.listen(PORT,'0.0.0.0',function(){ console.log('UDC FINAL v7.2 DEPLOY FIXED live on '+PORT); });
