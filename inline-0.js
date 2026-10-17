
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
/* V112 CLASSIFY watchdog: preserve the full existing handler; recover only if it never starts a request. */
(function () {
  var originalFetch = window.fetch.bind(window);
  window.__v112ClassifyRequestStarted = false;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf('/api/classify') !== -1) window.__v112ClassifyRequestStarted = true;
    return originalFetch(input, init);
  };

  function showDiagnostic(message) {
    var box = document.getElementById('classify-diagnostic') || document.getElementById('err');
    if (!box) {
      box = document.createElement('div');
      box.id = 'classify-diagnostic';
      box.style.cssText = 'margin:12px;padding:14px;border:1px solid #fecaca;background:#fff5f5;color:#991b1b;border-radius:12px;white-space:pre-wrap;overflow-wrap:anywhere';
      (document.querySelector('main') || document.body).appendChild(box);
    }
    box.style.display = 'block';
    box.textContent = 'CLASSIFY error: ' + String(message || 'Unknown browser error');
    try { box.scrollIntoView({behavior:'auto', block:'center'}); } catch (_) {}
  }

  window.addEventListener('error', function (event) {
    showDiagnostic(event.message || 'JavaScript failed to initialize');
    var button = document.getElementById('go');
    if (button) { button.disabled = false; button.textContent = '⚡ CLASSIFY'; }
  });
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason && event.reason.message ? event.reason.message : event.reason;
    showDiagnostic(reason || 'Classification action failed');
    var button = document.getElementById('go');
    if (button) { button.disabled = false; button.textContent = '⚡ CLASSIFY'; }
  });

  document.addEventListener('click', function (event) {
    var button = event.target && event.target.closest ? event.target.closest('#go') : null;
    if (!button) return;
    var field = document.getElementById('title');
    var title = field ? String(field.value || '').trim() : '';
    if (!title) return;
    window.__v112ClassifyRequestStarted = false;

    setTimeout(async function () {
      /* The normal handler should call /api/classify after its animation-frame/cache work.
         Do not send a duplicate if it already did. */
      if (window.__v112ClassifyRequestStarted) return;
      if (button.dataset.v112FallbackBusy === '1') return;
      button.dataset.v112FallbackBusy = '1';
      button.disabled = true;
      button.textContent = '⚡ CLASSIFYING…';
      try {
        var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timer = controller ? setTimeout(function () { controller.abort(); }, 60000) : null;
        var response = await originalFetch('/api/classify', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({title: title}),
          signal: controller ? controller.signal : undefined
        });
        if (timer) clearTimeout(timer);
        var result;
        try { result = await response.json(); }
        catch (_) { throw new Error('Server returned a non-JSON response (HTTP ' + response.status + ').'); }
        if (!response.ok) throw new Error(result.error || ('Server returned HTTP ' + response.status));
        if (typeof window.showResult === 'function') {
          window.showResult(result);
        } else {
          var panel = document.getElementById('classify-diagnostic') || document.getElementById('err');
          if (!panel) {
            panel = document.createElement('div');
            panel.id = 'classify-diagnostic';
            panel.style.cssText = 'margin:12px;padding:14px;border:1px solid #cbd5e1;background:#f8fafc;border-radius:12px;white-space:pre-wrap;overflow-wrap:anywhere';
            (document.querySelector('main') || document.body).appendChild(panel);
          }
          panel.textContent = 'Result received from server. Title: ' + (result.full_title || result.title || title) +
            '\\nUDC: ' + (result.udc_answer || result.udc_number || '—') +
            '\\nDDC: ' + (result.ddc_answer || result.ddc_number || '—');
          panel.scrollIntoView({behavior:'auto', block:'center'});
        }
      } catch (error) {
        showDiagnostic(error && error.name === 'AbortError' ? 'Request timed out after 60 seconds. Check Render Logs.' : (error && error.message ? error.message : error));
      } finally {
        button.dataset.v112FallbackBusy = '0';
        button.disabled = false;
        button.textContent = '⚡ CLASSIFY';
      }
    }, 1800);
  }, true);
})();
