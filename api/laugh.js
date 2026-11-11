// api/laugh.js
// Adds one laugh to a saved joke and returns the new count.
// The +1 happens inside the database (add_laugh), so two clicks at once are both counted.

import { getSupabase } from '../lib/supabase.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return Response.json({ error: 'אפשר לשלוח לכאן רק POST' }, { status: 405 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      console.error('SUPABASE_URL or SUPABASE_SECRET_KEY is missing.');
      return Response.json({ error: 'אין חיבור לבסיס הנתונים' }, { status: 500 });
    }

    let id = '';
    try {
      id = String((await request.json())?.id ?? '');
    } catch {
      id = '';
    }
    if (!UUID.test(id)) {
      return Response.json({ error: 'בדיחה לא מזוהה' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('add_laugh', { joke_id: id });
    if (error) {
      console.error('add_laugh failed:', error.code, error.message);
      return Response.json({ error: 'לא הצלחנו לשמור את הצחוק' }, { status: 502 });
    }
    if (data === null) {
      return Response.json({ error: 'הבדיחה לא נמצאה' }, { status: 404 });
    }

    return Response.json({ laughs: data });
  }
};
