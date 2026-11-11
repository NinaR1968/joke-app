// api/feed.js
// The lists: GET /api/feed?mode=new | top | liked
// new and top: for everyone (a guest gets my_vote = null). liked: only with a token.
// The viewer is known ONLY from the token. user_id is never sent back.

import { getSupabase, hasToken, getUserFromRequest } from '../lib/supabase.js';
import { json, authRequired } from '../lib/http.js';

const ROWS = { new: 20, top: 10, liked: 50 };

export default {
  async fetch(request) {
    if (request.method !== 'GET') {
      return json({ error: 'אפשר לבקש מכאן רק GET' }, 405);
    }

    const mode = new URL(request.url).searchParams.get('mode') || 'new';
    if (!Object.hasOwn(ROWS, mode)) return json({ error: 'רשימה לא מוכרת' }, 400);
    if (mode === 'liked' && !hasToken(request)) {
      return authRequired('כדי לראות מה אהבת צריך להתחבר');
    }

    const supabase = getSupabase();
    if (!supabase) {
      console.error('SUPABASE_URL or SUPABASE_SECRET_KEY is missing.');
      return json({ error: 'אין חיבור לבסיס הנתונים' }, 500);
    }

    // Who is looking? Only the token decides. A token Supabase does not know: 401.
    let user = null;
    if (hasToken(request)) {
      try {
        user = await getUserFromRequest(request, supabase);
        if (!user) return authRequired();
      } catch (err) {
        console.error('Supabase Auth not reachable:', err?.status, err?.message);
        if (mode === 'liked') return json({ error: 'אין חיבור לשרת הכניסה. נסו שוב.' }, 502);
        // new and top still work, as a guest
      }
    }

    const { data, error } = await supabase.rpc('joke_feed', {
      viewer: user?.id ?? null,
      mode,
      max_rows: ROWS[mode]
    });
    if (error) {
      console.error('joke_feed failed:', error.code, error.message);
      return json({ error: 'לא הצלחנו לטעון את הרשימה' }, 502);
    }

    // Only the fields of the contract. Never user_id.
    const jokes = (data ?? []).map((j) => ({
      id: j.id,
      topic: j.topic,
      text: j.text,
      author_name: j.author_name,
      likes: j.likes,
      dislikes: j.dislikes,
      my_vote: j.my_vote ?? null,
      created_at: j.created_at
    }));
    return json({ jokes });
  }
};
