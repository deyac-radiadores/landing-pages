// netlify/functions/submit-contenedores.js
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

    const APPS_SCRIPT_ENDPOINT_CONTENEDORES = process.env.APPS_SCRIPT_ENDPOINT_CONTENEDORES;
    const RECAPTCHA_SECRET                  = process.env.RECAPTCHA_SECRET;

    // Parse body
    const rawCT = String(event.headers['content-type'] || '').toLowerCase();
    let data = {};
    if (rawCT.includes('application/json')) {
      try { data = JSON.parse(event.body || '{}'); } catch { data = {}; }
    } else {
      data = Object.fromEntries(new URLSearchParams(event.body || ''));
    }

    console.log('[submit-contenedores] keys:', Object.keys(data));

    // IP cliente
    const clientIp =
      event.headers['x-nf-client-connection-ip'] ||
      event.headers['x-forwarded-for'] ||
      event.headers['client-ip'] ||
      '';

    // reCAPTCHA v3
    if (RECAPTCHA_SECRET && data.recaptcha_token) {
      const vr = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: RECAPTCHA_SECRET, response: data.recaptcha_token, remoteip: clientIp }),
      });
      const verify = await vr.json().catch(() => ({}));
      console.log('[submit-contenedores] recaptcha:', { success: verify.success, score: verify.score, host: verify.hostname });

      if (!verify.success || (typeof verify.score === 'number' && verify.score < 0.5)) {
        return {
          statusCode: 400,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
          body: JSON.stringify({ ok: false, error: 'reCAPTCHA failed' }),
        };
      }
    } else {
      console.warn('[submit-contenedores] reCAPTCHA not verified (missing SECRET or token).');
    }

    // Normalizar: acepta exactamente los campos que envías desde el front
    const name        = data.name      || data.FNAME      || '';
    const email       = data.email     || data.EMAIL      || '';
    const phone       = data.phone     || data.PHONE      || '';
    const empresa     = data.empresa   || data.EMPRESA    || '';
    const puesto      = data.puesto    || data.PUESTOEMPR || '';
    const direccion   = data.direccion || data.DIRECCION  || '';
    const ciudad      = data.ciudad    || data.CIUDAD     || '';
    const pais        = data.pais      || data.PAIS       || '';
    const interesado  = data.interesado|| data.INTERESADO || '';
    const mensaje     = data.mensaje   || data.MENSAJE    || '';

    // Validación mínima server-side
    const required = { name, email, phone, empresa, puesto, direccion, ciudad, pais, interesado, mensaje };
    const missing = Object.entries(required).filter(([,v]) => !String(v||'').trim()).map(([k]) => k);
    if (missing.length) {
      console.warn('[submit-contenedores] missing:', missing);
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok:false, error:'Campos requeridos faltantes', missing }),
      };
    }

    // Mapeo a Apps Script (ajusta si tu Code.gs espera otros nombres)
    const mapped = {
      name, email, phone, empresa, puesto, direccion, ciudad, pais, interesado, mensaje
    };
    console.log('[submit-contenedores] mapped:', mapped);

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
        console.log('[submit-contenedores] GAS response:', gasStatus, (text||'').slice(0,240));
      } catch (e) {
        forwarded = 'failed';
        console.error('[submit-contenedores] GAS forward error:', e);
      }
    } else {
      console.error('[submit-contenedores] APPS_SCRIPT_ENDPOINT_CONTENEDORES no configurado');
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok:true, forwarded, gas_status: gasStatus }),
    };
  } catch (err) {
    console.error('[submit-contenedores] error:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok:false, error:'Server error' }),
    };
  }
};
