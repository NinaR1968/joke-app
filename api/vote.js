// api/vote.js
// "Like" (1), "dislike" (-1) or take my vote back (0). One vote per user per joke.
// Who votes is known ONLY from the token. A user_id in the body is ignored.
// The vote and the new counts happen inside the database (cast_vote), in one step.

import { getSupabase, hasToken, getUserFromRequest } from '../lib/supabase.js';
import { json, authRequired, readJson } from '../lib/http.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return json({ error: 'אפשר לשלוח לכאן רק POST' }, 405);
    }
    if (!hasToken(request)) return authRequired('כדי לדרג בדיחות צריך חשבון');

    const supabase = getSupabase();
    if (!supabase) {
      console.error('SUPABASE_URL or SUPABASE_SECRET_KEY is missing.');
      return json({ error: 'אין חיבור לבסיס הנתונים' }, 500);
    }

    // 1. Who is voting? Only the token decides.
    let user;
    try {
      user = await getUserFromRequest(request, supabase);
    } catch (err) {
      console.error('Supabase Auth not reachable:', err?.status, err?.message);
      return json({ error: 'אין חיבור לשרת הכניסה. נסו שוב.' }, 502);
    }
    if (!user) return authRequired();

    // 2. What? id must be a uuid, value exactly the number 1, -1 or 0
    const body = await readJson(request);
    const id = typeof body.id === 'string' ? body.id : '';
    const value = body.value;
    if (!UUID.test(id)) return json({ error: 'בדיחה לא מזוהה' }, 400);
    if (value !== 1 && value !== -1 && value !== 0) {
      return json({ error: 'הצבעה לא חוקית' }, 400);
    }

    // 3. Vote. voter comes from the token, never from the body.
    const { data, error } = await supabase
      .rpc('cast_vote', { voter: user.id, target: id, new_value: value })
      .single();
    if (error) {
      if (error.code === 'P0002') return json({ error: 'הבדיחה לא נמצאה' }, 404);
      if (error.code === '22023') return json({ error: 'הצבעה לא חוקית' }, 400);
      console.error('cast_vote failed:', error.code, error.message);
      return json({ error: 'לא הצלחנו לשמור את ההצבעה. נסו שוב.' }, 502);
    }

    console.log('Vote saved. value:', value);
    return json({ likes: data.likes, dislikes: data.dislikes, my_vote: data.my_vote ?? null });
  }
};
