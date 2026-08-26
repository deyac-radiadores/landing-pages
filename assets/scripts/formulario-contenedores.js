(() => {
  /** ====== CONSTANTES (mantén estas) ====== */
  const SITE_KEY  = '6Lf6IYsqAAAAAJhaDoHJjVmT7EBejRMo8XHP0ja3'; // v3 (pública)
  const FORM_ID   = 'mc-embedded-subscribe-form';
  const BTN_ID    = 'mc-embedded-subscribe';
  const STATUS_ID = 'form-status';
  const THANK_YOU_URL = 'https://deyacradiadores.com/thank-you-contenedores/';
  const MC_IFRAME_NAME = 'mc-submit-bridge';
  const BADGE_SLOT_ID  = 'recaptcha-badge-slot';

  const $ = (id) => document.getElementById(id);
  const val = (id) => ($(id)?.value || '').trim();

  // Requeridos EXACTOS del form
  const REQUIRED = [
    'mce-FNAME', 'mce-EMAIL', 'mce-PHONE',
    'mce-EMPRESA', 'mce-PUESTOEMPR', 'mce-DIRECCION',
    'mce-CIUDAD', 'mce-PAIS', 'mce-INTERESADO', 'mce-MENSAJE'
  ];

  /** ---- UI estado ---- */
  function injectStyles(){
    if (document.getElementById('leadform-styles')) return;
    const s=document.createElement('style');
    s.id='leadform-styles';
    s.textContent=`
      .lf-row{display:flex;align-items:center;gap:.6rem;margin-top:.75rem;font-size:.875rem}
      .lf-hidden{display:none}
      .lf-ring,.lf-btnring{width:22px;height:22px;border-radius:50%;display:inline-block;
        --c1:#e5e7eb;--c2:currentColor;background:
        conic-gradient(from 0turn,var(--c2) 0.0turn 0.25turn,transparent 0.25turn) content-box,
        conic-gradient(var(--c1),var(--c1)) border-box;
        -webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 0) content-box,none;
        mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 0) content-box,none;
        padding:3px;animation:lf-rotate 1s linear infinite}
      .lf-btnring{width:24px;height:24px}
      @keyframes lf-rotate{to{transform:rotate(360deg)}}
      .lf-ok,.lf-x{display:inline-flex;align-items:center;justify-content:center}
      .lf-ok svg,.lf-x svg{width:22px;height:22px}
      .lf-success{color:#22c55e}.lf-error{color:#ef4444}
      iframe[name="${MC_IFRAME_NAME}"]{display:none;width:0;height:0;border:0}
      #${BADGE_SLOT_ID} { margin-top:.5rem; }
      #${BADGE_SLOT_ID} .grecaptcha-badge{
        position: static !important; right:auto !important; bottom:auto !important;
        box-shadow:none !important; transform:none !important;
      }
      #${BADGE_SLOT_ID} .grecaptcha-badge iframe{ transform:scale(.95); transform-origin:left top; }
    `;
    document.head.appendChild(s);
  }
  function ensureStatusEl(){
    injectStyles();
    let el=$(STATUS_ID);
    if(!el){
      el=document.createElement('div');
      el.id=STATUS_ID;
      el.setAttribute('aria-live','polite');
      el.className='lf-row lf-hidden';
      el.innerHTML=`<span></span><span></span>`;
      $(FORM_ID)?.appendChild(el);
    }
    return el;
  }
  function setStatus(msg,type='info'){
    const el=ensureStatusEl(); el.classList.remove('lf-hidden');
    const icon=el.children[0], text=el.children[1];
    icon.className=''; icon.innerHTML='';
    el.classList.remove('lf-success','lf-error');
    if(type==='loading'){icon.className='lf-ring';}
    else if(type==='success'){el.classList.add('lf-success');icon.className='lf-ok';
      icon.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`;}
    else if(type==='error'){el.classList.add('lf-error');icon.className='lf-x';
      icon.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`;}
    text.textContent=msg||'';
  }

  /** ---- validación ---- */
  const rxEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const rxPhone=/^[0-9]{7,15}$/;
  function markField(id,ok){const el=$(id); if(!el) return;
    el.style.borderWidth='1px'; el.style.borderStyle='solid';
    el.style.transition='border-color .3s, box-shadow .3s';
    if(ok===false){el.style.borderColor='#ef4444'; el.style.boxShadow='0 0 4px #ef4444';}
    else if(ok===true){el.style.borderColor='#22c55e'; el.style.boxShadow='0 0 4px #22c55e';}
    else {el.style.borderColor=''; el.style.boxShadow='';}}
  function checkField(id){
    const el=$(id); if(!el) return true; const vv=val(id); let ok=!!vv;
    if(ok && id==='mce-EMAIL') ok=rxEmail.test(vv);
    if(ok && id==='mce-PHONE') ok=rxPhone.test(vv.replace(/\s+/g,''));
    markField(id,ok); return ok;
  }
  function validateFields(){
    let all=true; REQUIRED.forEach(id=>{ if(!checkField(id)) all=false; });
    console.log('[Contenedores] validate ->', all?'OK':'ERRORES');
    return all;
  }
  function enableLiveValidation(){
    REQUIRED.forEach(id=>{
      const el=$(id); if(!el) return;
      ['input','change','blur'].forEach(evt=>el.addEventListener(evt,()=>checkField(id)));
    });
  }

  /** ---- Mailchimp bridge (submit paralelo) ---- */
  function ensureMcIframe(){
    let iframe=document.querySelector(`iframe[name="${MC_IFRAME_NAME}"]`);
    if(!iframe){iframe=document.createElement('iframe'); iframe.name=MC_IFRAME_NAME; document.body.appendChild(iframe);}
    return iframe;
  }
  function submitToMailchimp(form){
    const originalTarget=form.getAttribute('target');
    try{ensureMcIframe(); form.setAttribute('target',MC_IFRAME_NAME); form.submit();}
    finally{originalTarget?form.setAttribute('target',originalTarget):form.removeAttribute('target');}
  }

  /** ---- Botón ---- */
  function setBtnLoading(on){
    const btn=$(BTN_ID); if(!btn) return;
    if(on){
      btn.dataset._txt = btn.value || btn.innerText || 'Enviar';
      if('value' in btn) btn.value='Enviando…'; else btn.innerText='Enviando…';
      btn.disabled=true; btn.setAttribute('aria-busy','true');
    }else{
      const t=btn.dataset._txt || 'Enviar';
      if('value' in btn) btn.value=t; else btn.innerText=t;
      btn.disabled=false; btn.removeAttribute('aria-busy');
    }
  }

  /** ---- reCAPTCHA v3 ---- */
  function ensureBadgeSlot(){
    if($(BADGE_SLOT_ID)) return $(BADGE_SLOT_ID);
    const btn=$(BTN_ID); if(!btn) return null;
    const slot=document.createElement('div'); slot.id=BADGE_SLOT_ID;
    btn.insertAdjacentElement('afterend',slot); return slot;
  }
  function placeV3Badge(){
    const slot=ensureBadgeSlot(); if(!slot) return;
    const tryMove=()=>{const badge=document.querySelector('.grecaptcha-badge');
      if(badge && slot.firstChild!==badge){
        slot.appendChild(badge);
        badge.style.position='static'; badge.style.right='auto'; badge.style.bottom='auto';
        return true;
      } return false;};
    if(tryMove()) return;
    let n=0; const id=setInterval(()=>{ if(tryMove()||++n>30) clearInterval(id); },100);
  }
  function ensureRecaptcha(){
    return new Promise((resolve)=>{
      if(window.grecaptcha && grecaptcha.ready) return resolve();
      const s=document.createElement('script');
      s.src='https://www.google.com/recaptcha/api.js?render='+encodeURIComponent(SITE_KEY);
      s.async=true; s.defer=true; s.onload=resolve; document.head.appendChild(s);
    });
  }

  /** ---- Envío ---- */
  function handleSubmitForm(token){
    const form=$(FORM_ID);

    // === Campos EXACTOS (como pediste) ===
    const name        = document.getElementById('mce-FNAME').value.trim();
    const email       = document.getElementById('mce-EMAIL').value.trim();
    const phone       = document.getElementById('mce-PHONE').value.trim();
    const empresa     = document.getElementById('mce-EMPRESA').value.trim();
    const puesto      = document.getElementById('mce-PUESTOEMPR').value.trim();
    const direccion   = document.getElementById('mce-DIRECCION').value.trim();
    const ciudad      = document.getElementById('mce-CIUDAD').value.trim();
    const pais        = document.getElementById('mce-PAIS').value.trim();
    const interesado  = document.getElementById('mce-INTERESADO').value.trim();
    const mensaje     = document.getElementById('mce-MENSAJE').value.trim();

    const payload = {
      name, email, phone, empresa, puesto, direccion, ciudad, pais, interesado, mensaje,
      recaptcha_token: token,
      _meta: { origen: location.href, agente: navigator.userAgent, marcaDeTiempo: new Date().toISOString() }
    };

    console.log('[Contenedores] → payload', payload);

    // Usa tu redirect: /api/submit-contenedores -> /.netlify/functions/submit-contenedores
    fetch('/api/submit-contenedores', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    })
    .then(async r => {
      if(!r.ok) throw new Error(await r.text().catch(()=> 'Function error'));
      return r.json().catch(()=> ({}));
    })
    .then(() => {
      setStatus('¡Enviado correctamente! Redirigiendo…','success');
      submitToMailchimp(form); // paralelo a Mailchimp
      setTimeout(()=>{ window.location.assign(THANK_YOU_URL); }, 700);
    })
    .catch(err => {
      console.error('[Contenedores] function ERROR:', err);
      alert('No fue posible enviar tu información. Intenta nuevamente.');
      setBtnLoading(false);
      setStatus('Ocurrió un error al enviar.','error');
    });
  }

  function onSubmit(ev){
    ev.preventDefault();
    if (!validateFields()){
      alert('Por favor revisa los campos marcados en rojo.');
      setStatus('Hay errores en el formulario.','error');
      return;
    }
    setBtnLoading(true);
    setStatus('Enviando datos…','loading');

    ensureRecaptcha().then(()=>{
      if(!window.grecaptcha || !grecaptcha.ready){
        console.warn('[reCAPTCHA] no disponible; enviando sin token');
        handleSubmitForm('');
        return;
      }
      grecaptcha.ready(()=>{
        grecaptcha.execute(SITE_KEY, { action:'submit' })
          .then(token => handleSubmitForm(token))
          .catch(e => { console.error('[reCAPTCHA] error:', e); handleSubmitForm(''); });
      });
    });
  }

  /** ---- Montaje ---- */
  function mount(){
    const form=$(FORM_ID); if(!form) return;
    ensureStatusEl(); ensureMcIframe(); ensureBadgeSlot();
    form.setAttribute('novalidate','');
    form.addEventListener('submit', onSubmit);
    ensureRecaptcha().then(()=> {
      if(window.grecaptcha && grecaptcha.ready) grecaptcha.ready(placeV3Badge);
      else placeV3Badge();
    });
    enableLiveValidation();
    console.log('[Contenedores] Front listo (v3 badge estático)');
  }

  (document.readyState==='loading') ? document.addEventListener('DOMContentLoaded', mount) : mount();
})();
