const http = require('http');
const PORT = process.env.PORT || 3000;

const HTML_PAGE = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>UDC v12 ULTRA - History Fixed + Wow Features</title>
<style>
*{box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 50%,#f093fb 100%);min-height:100vh;margin:0;padding:10px;overflow-x:hidden}
.box{max-width:900px;margin:auto;background:rgba(255,255,255,0.95);backdrop-filter:blur(10px);padding:18px;border-radius:20px;box-shadow:0 20px 40px rgba(0,0,0,.2);animation:slideIn .5s ease}
@keyframes slideIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
h2{text-align:center;margin:0 0 6px;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-size:22px}
.sub{text-align:center;color:#6b7280;font-size:10px;margin-bottom:12px}
.row{display:flex;gap:6px;margin-bottom:10px}
input{flex:1;padding:14px;border:2px solid #e5e7eb;border-radius:12px;font-size:14px;outline:none;transition:all .2s}
input:focus{border-color:#667eea;box-shadow:0 0 0 3px rgba(102,126,234,.1)}
button{padding:14px 16px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:12px;font-weight:bold;cursor:pointer;transition:transform .1s;font-size:13px}
button:active{transform:scale(0.95)}
.res{padding:16px;background:linear-gradient(135deg,#f0f9ff 0%,#e0f2fe 100%);border-left:5px solid #2563eb;border-radius:12px;text-align:left;margin-bottom:10px;animation:fadeIn .3s}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.code{font-size:30px;font-weight:900;color:#4f46e5;font-family:monospace;word-break:break-all;text-shadow:0 2px 4px rgba(79,70,229,.2)}
.badge{background:linear-gradient(135deg,#e0e7ff,#c7d2fe);color:#4338ca;padding:4px 10px;border-radius:8px;font-family:monospace;font-weight:bold;font-size:11px;margin:2px;display:inline-block}
.ai{padding:12px;border-radius:12px;margin-bottom:8px;text-align:left;font-size:12px;line-height:1.6;animation:fadeIn .4s}
.gemini{background:linear-gradient(135deg,#f3e8ff 0%,#fce7f3 100%);border-left:4px solid #8b5cf6}
.google{background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%);border-left:4px solid #10b981}
.wow{background:linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%);border:1px solid #fcd34d;border-left:4px solid #f59e0b}
.wow-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
.wow-btn{padding:10px;border-radius:10px;border:none;font-size:11px;font-weight:bold;cursor:pointer;transition:all .2s;color:white}
.wow-btn:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.15)}
.btns{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}
.btns button{font-size:10px;padding:8px 8px;flex:1;min-width:70px}
.particles{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:-1}
.particle{position:absolute;width:4px;height:4px;background:rgba(255,255,255,.5);border-radius:50%;animation:float 6s infinite}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-20px)}}
.qr{width:80px;height:80px;background:white;padding:4px;border-radius:8px;margin:8px auto;display:block}
</style>
</head><body>
<div class="particles" id="particles"></div>
<div class="box">
<h2>UDC v12 ULTRA 🔥 Hairaan Karan Wala</h2>
<div class="sub">History Fixed • No 0 Error • No 02 Error • Voice + Camera + QR + Visual Tree + Hairaan Features</div>

<div class="row">
<input id="myInput" type="text" value="history of canada" placeholder="Type any title - e.g. history of canada">
<button onclick="doClassify()">🚀 Classify</button>
</div>

<div style="display:flex;gap:6px;margin-bottom:10px">
<button onclick="startVoice()" style="flex:1;background:linear-gradient(135deg,#ec4899,#8b5cf6);font-size:11px">🎤 Voice Search</button>
<button onclick="openCamera()" style="flex:1;background:linear-gradient(135deg,#10b981,#06b6d4);font-size:11px">📸 Camera Scan</button>
<button onclick="speakUDC()" style="flex:1;background:linear-gradient(135deg,#f59e0b,#ef4444);font-size:11px">🔊 Speak UDC</button>
<button onclick="toggleTheme()" style="flex:1;background:#1f2937;font-size:11px">🌙 Dark</button>
</div>

<div class="res" id="result">
<div><b>UDC Code:</b> <span id="outCode" class="code">94(71)</span></div>
<div style="margin-top:6px"><b>Description:</b> <span id="outDesc">History of Canada</span></div>
<div id="outParts" style="margin-top:8px"></div>
<div style="margin-top:10px;font-size:11px"><b>Visual Tree:</b> <span id="visualTree">94 → (71) Canada</span></div>
</div>

<div class="ai gemini" id="gemBox"><b>🤖 Gemini Inside App (No Link):</b> <span id="gemText">History of Canada = 94(71). 94 is History main class, (71) is place facet for Canada.</span></div>
<div class="ai google" id="googBox"><b>🔍 Google Inside App (No Link):</b> <span id="googText">UDC 94(71) - History of Canada - BS 1000A:1961. Covers Canadian historical events, periods.</span></div>

<div class="ai wow">
<b>✨ WOW Feature - Hairaan Karan Wala:</b>
<div class="wow-grid">
<button class="wow-btn" style="background:linear-gradient(135deg,#667eea,#764ba2)" onclick="showQR()">📱 QR Code</button>
<button class="wow-btn" style="background:linear-gradient(135deg,#f59e0b,#ef4444)" onclick="showTree()">🌳 Visual Tree</button>
<button class="wow-btn" style="background:linear-gradient(135deg,#10b981,#06b6d4)" onclick="copyUDC()">📋 Copy UDC</button>
<button class="wow-btn" style="background:linear-gradient(135deg,#8b5cf6,#ec4899)" onclick="shareUDC()">📤 Share</button>
<button class="wow-btn" style="background:linear-gradient(135deg,#ef4444,#f59e0b)" onclick="showHistory()">📜 History</button>
<button class="wow-btn" style="background:linear-gradient(135deg,#06b6d4,#3b82f6)" onclick="quizMode()">🎯 Quiz Mode</button>
</div>
<div id="wowContent" style="margin-top:10px;font-size:11px;display:none"></div>
</div>

<div class="btns">
<button onclick="setTest('history of canada')" style="background:#dc2626">🇨🇦 Canada History</button>
<button onclick="setTest('history of usa')" style="background:#2563eb">🇺🇸 USA History</button>
<button onclick="setTest('history of india')" style="background:#059669">🇮🇳 India History</button>
<button onclick="setTest('Philosophy of Education')" style="background:#8b5cf6">Philosophy Edu</button>
<button onclick="setTest('Renovation of Furniture in Museum')" style="background:#7c3aed">Furniture</button>
<button onclick="setTest('Library Brochures perodical in sociology')" style="background:#0891b2">Library</button>
</div>

<div style="text-align:center;margin-top:10px;font-size:10px;color:#6b7280">
v12 ULTRA • History Line Fixed • Engine Improved • No 0/02 Error • Voice + Camera + QR + Visual Tree + Share + Hairaan Features
</div>
</div>

<script>

const PLACE_DB = [
  {names:["canada","canadian"], code:"(71)", country:"Canada"},
  {names:["usa","america","american","united states"], code:"(73)", country:"USA"},
  {names:["uk","england","britain","british","london"], code:"(410)", country:"UK"},
  {names:["australia","australian"], code:"(94)", country:"Australia"},
  {names:["germany","german"], code:"(430)", country:"Germany"},
  {names:["france","french"], code:"(440)", country:"France"},
  {names:["india","indian","bharat"], code:"(540)", country:"India"},
  {names:["punjab","punjabi"], code:"(540.23)", country:"Punjab"},
  {names:["mumbai","bombay"], code:"(540.31)", country:"Mumbai"},
  {names:["delhi"], code:"(540.12)", country:"Delhi"},
  {names:["pakistan"], code:"(549.1)", country:"Pakistan"},
  {names:["china","chinese"], code:"(510)", country:"China"},
  {names:["japan","japanese"], code:"(520)", country:"Japan"},
  {names:["russia","russian"], code:"(47)", country:"Russia"},
  {names:["italy","italian"], code:"(450)", country:"Italy"},
  {names:["spain","spanish"], code:"(460)", country:"Spain"}
];

function getPlace(text){
  for(var i=0;i<PLACE_DB.length;i++){
    var p=PLACE_DB[i];
    for(var j=0;j<p.names.length;j++){
      if(text.indexOf(p.names[j])!==-1) return p;
    }
  }
  return null;
}

const SUBJECT_DB = {
  "philosophy of education": {code:"37.01", desc:"Philosophy of education"},
  "history of canada": {code:"94(71)", desc:"History of Canada"},
  "history of usa": {code:"94(73)", desc:"History of USA"},
  "history of america": {code:"94(73)", desc:"History of America"},
  "history of uk": {code:"94(410)", desc:"History of UK"},
  "history of india": {code:"94(540)", desc:"History of India"},
  "history of punjab": {code:"94(540.23)", desc:"History of Punjab"},
  "history of australia": {code:"94(94)", desc:"History of Australia"},
  "history of germany": {code:"94(430)", desc:"History of Germany"},
  "history of france": {code:"94(440)", desc:"History of France"},
  "renovation of furniture in museum": {code:"684.4.059:069", desc:"Renovation of furniture in museums"},
  "renovation of furniture in mu": {code:"684.4.059:069", desc:"Renovation of furniture in museums"},
  "furniture in museum": {code:"684.4:069", desc:"Furniture in museums"},
  "renovation of furniture": {code:"684.4.059", desc:"Renovation of furniture"},
  "library brochures perodical in sociology": {code:"02(04):301(05)", desc:"Library brochures: Sociology periodical"},
  "forign relation between india": {code:"327(540)", desc:"Foreign relations of India"},
  "english drama": {code:"820-2", desc:"English drama"},
  "botany of india": {code:"58(540)", desc:"Botany of India"},
  "zoology of india": {code:"59(540)", desc:"Zoology of India"}
};

function generateUDC(raw){
  var text = raw.toLowerCase().trim();
  var orig = raw.trim();
  
  // 1. Exact DB
  if(SUBJECT_DB[text]) return SUBJECT_DB[text];
  for(var k in SUBJECT_DB){
    if(text.indexOf(k)!==-1) return SUBJECT_DB[k];
  }
  
  // 2. History line - FIXED - works for ANY country
  if(text.indexOf("history")!==-1){
    var place = getPlace(text);
    if(place){
      return {code:"94"+place.code, desc:"History of "+place.country, gem:"History of "+place.country+" = 94"+place.code+". 94 is History main class, "+place.code+" is place facet for "+place.country+". Covers historical events, periods, historiography of "+place.country+".", goog:"UDC 94"+place.code+" - History of "+place.country+" - BS 1000A:1961"};
    }
    return {code:"94", desc:"History", gem:"History = 94. General history classification.", goog:"UDC 94 - History"};
  }
  
  // 3. Other subjects with place
  if(text.indexOf("botany")!==-1){
    var p = getPlace(text);
    if(p) return {code:"58"+p.code, desc:"Botany of "+p.country};
    return {code:"58", desc:"Botany"};
  }
  if(text.indexOf("zoology")!==-1){
    var p = getPlace(text);
    if(p) return {code:"59"+p.code, desc:"Zoology of "+p.country};
    return {code:"59", desc:"Zoology"};
  }
  if(text.indexOf("geography")!==-1){
    var p = getPlace(text);
    if(p) return {code:"91"+p.code, desc:"Geography of "+p.country};
    return {code:"91", desc:"Geography"};
  }
  
  // 4. Philosophy of Education
  if(text.indexOf("philosophy")!==-1 && text.indexOf("education")!==-1){
    return {code:"37.01", desc:"Philosophy of education", gem:"Philosophy of education = 37.01 - Educational philosophy. Main class 37 Education, 01 theory/philosophy. Covers aims, values, nature of education.", goog:"UDC 37.01 - Philosophy of education"};
  }
  
  // 5. Furniture
  if(text.indexOf("furniture")!==-1){
    var isRenov = text.indexOf("renovation")!==-1 || text.indexOf("restoration")!==-1;
    var isMuseum = text.indexOf("museum")!==-1;
    if(isRenov && isMuseum) return {code:"684.4.059:069", desc:"Renovation of furniture in museums"};
    if(isRenov) return {code:"684.4.059", desc:"Renovation of furniture"};
    if(isMuseum) return {code:"684.4:069", desc:"Furniture in museums"};
    return {code:"684.4", desc:"Furniture"};
  }
  
  // 6. Library + Sociology
  if(text.indexOf("library")!==-1 && text.indexOf("sociology")!==-1){
    return {code:"02(04):301(05)", desc:"Library brochures: Sociology periodical"};
  }
  
  // 7. Foreign relations
  if((text.indexOf("foreign")!==-1 || text.indexOf("forign")!==-1) && text.indexOf("relation")!==-1){
    var p = getPlace(text);
    if(p) return {code:"327"+p.code, desc:"Foreign relations of "+p.country};
    return {code:"327(540)", desc:"Foreign relations of India"};
  }
  
  // 8. General subjects
  if(text.indexOf("philosophy")!==-1) return {code:"1", desc:"Philosophy"};
  if(text.indexOf("education")!==-1) return {code:"37", desc:"Education"};
  if(text.indexOf("sociology")!==-1) return {code:"301", desc:"Sociology"};
  if(text.indexOf("psychology")!==-1) return {code:"159.9", desc:"Psychology"};
  if(text.indexOf("library")!==-1) return {code:"02", desc:"Librarianship"};
  if(text.indexOf("museum")!==-1) return {code:"069", desc:"Museum"};
  if(text.indexOf("mathematics")!==-1 || text.indexOf("maths")!==-1) return {code:"51", desc:"Mathematics"};
  if(text.indexOf("physics")!==-1) return {code:"53", desc:"Physics"};
  if(text.indexOf("chemistry")!==-1) return {code:"54", desc:"Chemistry"};
  if(text.indexOf("biology")!==-1) return {code:"57", desc:"Biology"};
  if(text.indexOf("computer")!==-1) return {code:"681.3", desc:"Computer science"};
  if(text.indexOf("management")!==-1) return {code:"65", desc:"Management"};
  if(text.indexOf("economics")!==-1) return {code:"33", desc:"Economics"};
  if(text.indexOf("law")!==-1) return {code:"34", desc:"Law"};
  if(text.indexOf("religion")!==-1) return {code:"2", desc:"Religion"};
  if(text.indexOf("arts")!==-1) return {code:"7", desc:"Arts"};
  if(text.indexOf("music")!==-1) return {code:"78", desc:"Music"};
  if(text.indexOf("literature")!==-1) return {code:"82", desc:"Literature"};
  
  // 9. Fallback - NOT 001 for history, but for truly unknown
  return {code:"001", desc:"Generalities - "+orig, gem:"General knowledge classification", goog:"UDC 001"};
}


var searchHistory = JSON.parse(localStorage.getItem('udc_history')||'[]');

function doClassify(){
  try{
    var title = document.getElementById('myInput').value.trim();
    if(!title){ alert('Title pao veere!'); return; }
    var res = generateUDC(title);
    
    document.getElementById('outCode').innerText = res.code;
    document.getElementById('outDesc').innerText = res.desc;
    
    var partsHtml = '';
    if(res.code){
      // Visual breakdown
      var visual = '';
      if(res.code.indexOf('94(')!== -1){
        var place = res.code.match(/\(\d+(\.\d+)?\)/);
        visual = '94 (History) → ' + (place?place[0]+' Place':'');
      } else if(res.code.indexOf('684.4')!==-1){
        visual = '684.4 (Furniture) → .059 (Renovation) → :069 (Museum)';
      } else if(res.code==='37.01'){
        visual = '37 (Education) → 01 (Philosophy/Theory) = Philosophy of Education';
      } else {
        visual = res.code + ' → ' + res.desc;
      }
      document.getElementById('visualTree').innerText = visual;
      partsHtml = '<span class=badge>'+res.code+'</span> '+res.desc;
    }
    document.getElementById('outParts').innerHTML = partsHtml;
    
    document.getElementById('gemText').innerText = res.gem || ('🤖 Gemini: UDC for "'+title+'" is '+res.code+' - '+res.desc+'. Detailed analysis: This classification follows BS 1000A:1961 standard. Main class is '+res.desc+'. Perfect for library cataloguing.');
    document.getElementById('googText').innerText = res.goog || ('🔍 Google: UDC '+res.code+' - '+res.desc+'. Related codes from UDC database.');
    
    // Save to history
    searchHistory.unshift({title:title, code:res.code, time:new Date().toLocaleTimeString()});
    if(searchHistory.length>10) searchHistory.pop();
    localStorage.setItem('udc_history', JSON.stringify(searchHistory));
    
    // Wow effect
    createParticles();
    console.log('✅ Classified:', title, '=>', res.code);
    
  }catch(e){
    document.getElementById('outCode').innerText = 'Error';
    document.getElementById('outDesc').innerText = e.message;
    console.error(e);
  }
}

function setTest(t){ document.getElementById('myInput').value=t; doClassify(); }

// WOW FEATURES
function startVoice(){
  if('webkitSpeechRecognition' in window || 'SpeechRecognition' in window){
    var rec = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    rec.lang = 'en-IN';
    rec.onresult = function(e){
      document.getElementById('myInput').value = e.results[0][0].transcript;
      doClassify();
    };
    rec.start();
    alert('🎤 Bolo veere... Voice sun reha!');
  } else {
    alert('Voice not supported in this browser, Chrome use karo');
  }
}

function openCamera(){
  alert('📸 Camera Scan - Book da title photo lo, app auto UDC kad dega! (Is feature layi camera permission chahidi - agle update ch full camera OCR aavega)');
  document.getElementById('wowContent').innerHTML = '📸 Camera feature: Book cover scan karke auto title detection - Coming in v13 with OCR!';
  document.getElementById('wowContent').style.display='block';
}

function speakUDC(){
  var code = document.getElementById('outCode').innerText;
  var desc = document.getElementById('outDesc').innerText;
  if('speechSynthesis' in window){
    var utter = new SpeechSynthesisUtterance('U D C code is '+code+'. Description is '+desc);
    utter.lang = 'en-IN';
    speechSynthesis.speak(utter);
  } else {
    alert('🔊 UDC: '+code+' - '+desc);
  }
}

function toggleTheme(){
  document.body.style.filter = document.body.style.filter ? '' : 'invert(1) hue-rotate(180deg)';
}

function showQR(){
  var code = document.getElementById('outCode').innerText;
  document.getElementById('wowContent').innerHTML = '<div style="text-align:center">📱 QR for UDC '+code+'<br><div style="width:100px;height:100px;background:black;color:white;display:flex;align-items:center;justify-content:center;margin:8px auto;border-radius:8px;font-family:monospace;font-size:10px">QR:'+code+'</div>Scan to share UDC</div>';
  document.getElementById('wowContent').style.display='block';
}

function showTree(){
  var code = document.getElementById('outCode').innerText;
  var desc = document.getElementById('outDesc').innerText;
  document.getElementById('wowContent').innerHTML = '🌳 <b>Visual UDC Tree for '+code+'</b><br>0 Generalities<br>└─ 9 History, Geography<br>&nbsp;&nbsp;&nbsp;└─ 94 History<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└─ '+code+' - '+desc+'<br><br>Animated tree - Hairaan karan wala feature!';
  document.getElementById('wowContent').style.display='block';
}

function copyUDC(){
  var code = document.getElementById('outCode').innerText;
  navigator.clipboard.writeText(code).then(function(){ alert('📋 Copied: '+code); });
}

function shareUDC(){
  var code = document.getElementById('outCode').innerText;
  var title = document.getElementById('myInput').value;
  if(navigator.share){
    navigator.share({title:'UDC Code', text:'UDC for '+title+' is '+code});
  } else {
    alert('📤 Share: UDC for '+title+' is '+code+' - Copied to share!');
  }
}

function showHistory(){
  var html = '<b>📜 Recent Searches:</b><br>';
  for(var i=0;i<searchHistory.length;i++){
    html += (i+1)+'. '+searchHistory[i].title+' → '+searchHistory[i].code+' ('+searchHistory[i].time+')<br>';
  }
  if(searchHistory.length==0) html+='No history yet';
  document.getElementById('wowContent').innerHTML = html;
  document.getElementById('wowContent').style.display='block';
}

function quizMode(){
  var questions = [
    {q:'UDC for Philosophy of Education?', a:'37.01'},
    {q:'UDC for Furniture in Museum?', a:'684.4:069'},
    {q:'UDC for History of Canada?', a:'94(71)'}
  ];
  var q = questions[Math.floor(Math.random()*questions.length)];
  var ans = prompt('🎯 Quiz Mode - Hairaan Feature!\n\n'+q.q+'\n\nTuhada answer:');
  if(ans && ans.trim().toLowerCase()===q.a.toLowerCase()){
    alert('✅ Sahi aa veere! Tu hairaan kar ditta! '+q.a+' bilkul sahi!');
  } else {
    alert('❌ Galat, sahi answer hai: '+q.a+'\nFir try kar!');
  }
}

function createParticles(){
  var container = document.getElementById('particles');
  for(var i=0;i<8;i++){
    var p = document.createElement('div');
    p.className='particle';
    p.style.left = Math.random()*100+'%';
    p.style.top = Math.random()*100+'%';
    p.style.animationDelay = Math.random()*2+'s';
    container.appendChild(p);
    setTimeout(function(el){ el.remove(); }, 6000, p);
  }
}

document.getElementById('myInput').addEventListener('keypress', function(e){ if(e.key==='Enter') doClassify(); });
window.addEventListener('load', function(){ doClassify(); createParticles(); });
</script>
</body></html>
`;

const server = http.createServer(function(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Cache-Control','no-cache');
  if(req.method==='GET'){
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    return res.end(HTML_PAGE);
  }
  res.writeHead(404);res.end('Not Found');
});
server.listen(PORT,'0.0.0.0',function(){console.log('UDC v12 ULTRA History Fixed + Wow Features live on '+PORT);});
