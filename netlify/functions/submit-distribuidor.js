// netlify/functions/submit-distribuidor.js
/* eslint-disable no-console */

exports.handler = async (event) => {
  // CORS / preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        Vary: 'Origin',
      },
      body: '',
    };
  }

  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers: { 'Access-Control-Allow-Origin': '*' }, body: 'Method Not Allowed' };
    }

    const APPS_SCRIPT_ENDPOINT_CONTENEDORES = process.env.APPS_SCRIPT_ENDPOINT_CONTENEDORES; // URL /exec
    const RECAPTCHA_SECRET                  = process.env.RECAPTCHA_SECRET;                  // v3 secret

    // Parse body
    const rawCT = String(event.headers['content-type'] || '').toLowerCase();
    let data = {};
    if (rawCT.includes('application/json')) {
      try { data = JSON.parse(event.body || '{}'); } catch { data = {}; }
    } else {
      data = Object.fromEntries(new URLSearchParams(event.body || ''));
    }

    console.log('[submit-distribuidor] keys:', Object.keys(data));

    // IP cliente
    const clientIp =
      event.headers['x-nf-client-connection-ip'] ||
      event.headers['x-forwarded-for'] ||
      event.headers['client-ip'] ||
      '';

    // reCAPTCHA v3 (si hay secret y token)
    if (RECAPTCHA_SECRET && data.recaptcha_token) {
      const vr = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: RECAPTCHA_SECRET,
          response: data.recaptcha_token,
          remoteip: clientIp
        }),
      });
      const verify = await vr.json().catch(() => ({}));
      console.log('[submit-distribuidor] recaptcha:', { success: verify.success, score: verify.score, host: verify.hostname });

      if (!verify.success || (typeof verify.score === 'number' && verify.score < 0.5)) {
        return {
          statusCode: 400,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
          body: JSON.stringify({ ok: false, error: 'reCAPTCHA failed' }),
        };
      }
    } else {
      console.warn('[submit-distribuidor] reCAPTCHA not verified (missing SECRET or token).');
    }

    // Normalizar exactamente los campos del front (con fallback a merge tags por si acaso)
    const email       = data.email       || data.EMAIL       || '';
    const name        = data.name        || data.FNAME       || '';
    const phone       = data.phone       || data.PHONE       || '';
    const empresa     = data.empresa     || data.EMPRESA     || '';
    const puesto      = data.puesto      || data.PUESTOEMPR  || '';
    const tiponegocio = data.tiponegocio || data.TIPONEGDIS  || '';
    const necesitas   = data.necesitas   || data.GIRO        || '';
    const invertir    = data.invertir    || data.INVERTIR    || '';
    const direccion   = data.direccion   || data.DIRECCION   || '';
    const ciudad      = data.ciudad      || data.CIUDAD      || '';
    const estado      = data.estado      || data.ESTADO      || '';

    // Validación mínima (como pediste: TODOS requeridos)
    const required = { email, name, phone, empresa, puesto, tiponegocio, necesitas, invertir, direccion, ciudad, estado };
    const missing = Object.entries(required).filter(([,v]) => !String(v||'').trim()).map(([k]) => k);
    if (missing.length) {
      console.warn('[submit-distribuidor] missing:', missing);
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok:false, error:'Campos requeridos faltantes', missing }),
      };
    }

    // Mapeo al Apps Script (ajusta si tu Code.gs espera otros nombres)
    const mapped = {
      email, name, phone, empresa, puesto, tiponegocio, necesitas, invertir, direccion, ciudad, estado
    };
    console.log('[submit-distribuidor] mapped:', mapped);

    // Forward a Apps Script
    let forwarded = 'skipped';
    let gasStatus = 0;
    if (APPS_SCRIPT_ENDPOINT_CONTENEDORES) {
      try {
        const res = await fetch(APPS_SCRIPT_ENDPOINT_CONTENEDORES, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(mapped).toString(),
        });
        forwarded = 'sent';
        gasStatus = res.status;
        const text = await res.text().catch(()=> '');
        console.log('[submit-distribuidor] GAS response:', gasStatus, (text||'').slice(0,240));
      } catch (e) {
        forwarded = 'failed';
        console.error('[submit-distribuidor] GAS forward error:', e);
      }
    } else {
      console.error('[submit-distribuidor] APPS_SCRIPT_ENDPOINT_CONTENEDORES no configurado');
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok:true, forwarded, gas_status: gasStatus }),
    };
  } catch (err) {
    console.error('[submit-distribuidor] error:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok:false, error:'Server error' }),
    };
  }
};
