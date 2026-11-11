// auth.js: everything about signing in, in the browser. Nothing else.
// Uses the Supabase library ONLY for Auth (/auth/v1): sign up, sign in, sign out, and keeping the token.
// It never reads or writes a table. The address and the PUBLIC key come from /api/config.
// Exposes one global object: window.Auth

(function () {
  let client = null;
  let cfg = null;
  let current = null; // the current session, or null for a guest
  let back = null;    // after coming back from Google: 'ok', 'cancelled' or 'failed'
  const listeners = new Set();

  // Read the address before anything changes it: did we just come back from Google?
  const fromGoogle = (() => {
    const q = new URLSearchParams(location.search);
    const h = new URLSearchParams(location.hash.slice(1));
    const error = q.get('error') || h.get('error');
    if (error) return { error };
    if (q.get('code')) return { code: true };
    return null;
  })();

  // Remove what Supabase or Google added to the address. Keeps the path and a tab like #liked.
  function cleanUrl() {
    if (!fromGoogle) return;
    const u = new URL(location.href);
    for (const k of ['code', 'error', 'error_code', 'error_description', 'state']) u.searchParams.delete(k);
    const hash = /(^#|&)(error|access_token)=/.test(u.hash) ? '' : u.hash;
    history.replaceState(history.state, '', u.pathname + u.search + hash);
  }

  const ready = (async () => {
    if (!window.supabase?.createClient) throw new Error('auth library did not load');
    const res = await fetch('/api/config', { cache: 'no-store' });
    cfg = await res.json().catch(() => ({}));
    if (!res.ok || !cfg.url || !cfg.publishableKey) throw new Error(cfg.code || 'auth_not_configured');

    client = window.supabase.createClient(cfg.url, cfg.publishableKey, {
      auth: {
        flowType: 'pkce',         // Google comes back with ?code=, swapped here for a token
        persistSession: true,     // stay signed in after a refresh
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    // getSession waits until the library has swapped ?code= for a token (pkce)
    const { data } = await client.auth.getSession();
    current = data.session ?? null;
    if (fromGoogle) {
      if (fromGoogle.error) back = fromGoogle.error === 'access_denied' ? 'cancelled' : 'failed';
      else back = current ? 'ok' : 'failed'; // a code that did not become a token
    }
    cleanUrl();
    client.auth.onAuthStateChange((event, session) => {
      current = session ?? null;
      for (const cb of listeners) {
        try { cb(user(), event); } catch (err) { console.error(err); }
      }
    });
    return true;
  })();
  ready.catch((err) => {
    console.warn('Sign in is off:', err.message);
    if (fromGoogle) back = 'failed';
    cleanUrl();
  });

  // What the page may show about the signed-in user
  function user() {
    const u = current?.user;
    if (!u) return null;
    const name = String(u.user_metadata?.full_name ?? '').trim().slice(0, 30).trim();
    return { name: name || (u.email || '').split('@')[0], email: u.email || '' };
  }

  async function signUp(name, email, password) {
    await ready;
    name = String(name || '').trim();
    if (!name) throw new Error('איך לקרוא לך? כתבו שם.');
    if (name.length > 30) throw new Error('השם ארוך מדי. עד 30 תווים.');
    if (String(password || '').length < 6) throw new Error('הסיסמה קצרה מדי. צריך לפחות 6 תווים.');
    const { data, error } = await client.auth.signUp({
      email: String(email || '').trim(),
      password,
      options: { data: { full_name: name } }
    });
    if (error) throw new Error(hebrew(error));
    if (!data.session) throw new Error('נרשמתם, אבל צריך לאשר את המייל לפני הכניסה.');
    return user();
  }

  async function signIn(email, password) {
    await ready;
    const { error } = await client.auth.signInWithPassword({ email: String(email || '').trim(), password });
    if (error) throw new Error(hebrew(error));
    return user();
  }

  // Sign in with Google. First asks Supabase (public settings, with the PUBLIC key) whether Google is on.
  // Off: a Hebrew error, and we stay on the page. beforeLeave() runs right before the page goes to Google.
  async function google(beforeLeave) {
    await ready;
    let on = false;
    try {
      const res = await fetch(cfg.url + '/auth/v1/settings', { headers: { apikey: cfg.publishableKey }, cache: 'no-store' });
      const s = await res.json();
      on = res.ok && s?.external?.google === true;
    } catch (err) {
      console.warn('auth settings:', err.message);
    }
    if (!on) throw new Error('הכניסה עם Google עוד לא מוגדרת.');
    if (beforeLeave) beforeLeave();
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + '/' }
    });
    if (error) {
      console.warn('google:', error.message);
      throw new Error('הכניסה עם Google לא הצליחה. נסו שוב.');
    }
  }

  // After coming back from Google: 'ok', 'cancelled', 'failed', or null. Read it once.
  function returned() {
    const r = back;
    back = null;
    return r;
  }

  // Local scope: signs out only this device
  async function signOut() {
    await ready;
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) console.warn('signOut:', error.message);
    current = null;
  }

  function session() {
    return current;
  }

  // A fresh access token (the library refreshes it when it is about to expire), or null
  async function token() {
    try { await ready; } catch { return null; }
    const { data } = await client.auth.getSession();
    return data.session?.access_token ?? null;
  }

  function onChange(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  // Supabase errors, in short clear Hebrew
  function hebrew(error) {
    const code = error?.code || '';
    const text = String(error?.message || '').toLowerCase();
    if (code === 'invalid_credentials' || text.includes('invalid login')) return 'המייל או הסיסמה לא נכונים.';
    if (code === 'user_already_exists' || code === 'email_exists' || text.includes('already registered')) return 'המייל הזה כבר רשום. נסו להיכנס.';
    if (code === 'weak_password' || text.includes('password should be')) return 'הסיסמה קצרה מדי. צריך לפחות 6 תווים.';
    if (code === 'email_address_invalid' || code === 'validation_failed' || text.includes('invalid format')) return 'כתובת המייל לא תקינה.';
    if (code === 'email_not_confirmed') return 'צריך לאשר את המייל לפני הכניסה.';
    if (code === 'signup_disabled') return 'ההרשמה סגורה כרגע.';
    if (code.startsWith('over_') || error?.status === 429) return 'יותר מדי ניסיונות. נסו שוב בעוד רגע.';
    if (!error?.status || error.status >= 500) return 'אין חיבור לשרת הכניסה. נסו שוב.';
    return 'משהו השתבש בכניסה. נסו שוב.';
  }

  window.Auth = { ready, signUp, signIn, google, returned, signOut, session, token, onChange, user };
})();
