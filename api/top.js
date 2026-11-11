// api/top.js
// The five funniest jokes: sorted by laughs, only jokes someone laughed at.
// This is the kind of question a database answers in one line, and a sheet does not.

import { getSupabase } from '../lib/supabase.js';

export default {
  async fetch(request) {
    if (request.method !== 'GET') {
      return Response.json({ error: 'אפשר לבקש מכאן רק GET' }, { status: 405 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      console.error('SUPABASE_URL or SUPABASE_SECRET_KEY is missing.');
      return Response.json({ error: 'אין חיבור לבסיס הנתונים' }, { status: 500 });
    }

    const { data, error } = await supabase
      .from('jokes')
      .select('id, topic, text, laughs')
      .gt('laughs', 0)
      .order('laughs', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('top query failed:', error.code, error.message);
      return Response.json({ error: 'לא הצלחנו לטעון את הרשימה' }, { status: 502 });
    }

    return Response.json({ jokes: data });
  }
};
