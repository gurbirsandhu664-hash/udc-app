
(async function loadProfessionalEngineStatus(){
 try{
  const r=await fetch('/api/health',{cache:'no-store'}); if(!r.ok)return;
  const h=await r.json(); const p=h.professionalProviders||{};
  const set=(id,text)=>{const el=document.getElementById(id);if(el)el.textContent=text;};
  set('webdeweyState',p.oclcWebDewey?.configured?'Configured (not yet queried)':'External licensed service · not connected');
  set('worldshareState',p.oclcWorldShareAI?.configured?'Configured (not yet queried)':'External licensed service · not connected');
  set('udconlineState',p.udcOnline?.configured?'Configured (not yet queried)':'External licensed service · not connected');
  set('annifState',p.annif?.endpointConfigured?'Endpoint set · adapter not active':'Endpoint not configured');
 }catch(_){/* status panel remains explicit and safe when offline */}
})();
