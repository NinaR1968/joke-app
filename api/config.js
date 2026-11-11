// api/config.js
// Gives the page what it needs to sign in with Supabase Auth: the project address
// and the PUBLISHABLE key. That key is public by design. A secret key never leaves here.

import { json } from '../lib/http.js';

export default {
  async fetch(request) {
    if (request.method !== 'GET') {
      return json({ error: 'אפשר לשלוח לכאן רק GET' }, 405);
    }

    const url = process.env.SUPABASE_URL;
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!url || !publishableKey || looksSecret(publishableKey)) {
      console.error('Auth not configured: SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is missing, or the key is a secret key.');
      return json({ error: 'הכניסה עוד לא מוגדרת בשרת', code: 'auth_not_configured' }, 500);
    }

    return json({ url, publishableKey });
  }
};

// A secret key pasted by mistake must never reach the browser.
function looksSecret(key) {
  if (key.startsWith('sb_secret_')) return true;
  // Old style keys are JWTs. The service_role one is secret.
  const parts = key.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      return payload?.role !== 'anon';
    } catch {
      return true; // a JWT we cannot read: do not risk it
    }
  }
  return !key.startsWith('sb_publishable_');
}
