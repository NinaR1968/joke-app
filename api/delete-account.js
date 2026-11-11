// api/delete-account.js
// Deletes the signed-in user. Only the token decides who that is.
// The jokes stay: first we clear the name on them, then deleting the user clears user_id
// (on delete set null).

import { getSupabase, hasToken, getUserFromRequest } from '../lib/supabase.js';
import { json, authRequired } from '../lib/http.js';

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return json({ error: 'אפשר לשלוח לכאן רק POST' }, 405);
    }
    if (!hasToken(request)) return authRequired('צריך להתחבר כדי למחוק חשבון');

    const supabase = getSupabase();
    if (!supabase) {
      console.error('SUPABASE_URL or SUPABASE_SECRET_KEY is missing.');
      return json({ error: 'אין חיבור לבסיס הנתונים' }, 500);
    }

    let user;
    try {
      user = await getUserFromRequest(request, supabase);
    } catch (err) {
      console.error('Supabase Auth not reachable:', err?.status, err?.message);
      return json({ error: 'אין חיבור לשרת הכניסה. נסו שוב.' }, 502);
    }
    if (!user) return authRequired();

    // 1. The jokes stay, without the name
    const { error: clearError } = await supabase
      .from('jokes')
      .update({ author_name: null })
      .eq('user_id', user.id);
    if (clearError) {
      console.error('Clearing author_name failed:', clearError.code, clearError.message);
      return json({ error: 'לא הצלחנו למחוק את החשבון. נסו שוב.' }, 502);
    }

    // 2. The user itself
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error('deleteUser failed:', deleteError.status, deleteError.message);
      return json({ error: 'לא הצלחנו למחוק את החשבון. נסו שוב.' }, 502);
    }

    console.log('Account deleted.');
    return json({ deleted: true });
  }
};
