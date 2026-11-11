// api/joke.js
// Vercel Function: gets a topic from the page, asks OpenAI for a short Hebrew joke,
// saves it in Supabase, and returns { joke, id, author_name }. Both keys live only here, in process.env.
// The browser never sees a key: it only talks to /api/joke on our own domain.
// A signed-in user is known only from the token, never from the body.

import { getSupabase, hasToken, getUserFromRequest, displayName } from '../lib/supabase.js';
import { json, authRequired, readJson } from '../lib/http.js';

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const MAX_TOPIC = 100; // anyone can call this URL, so keep the input short

const INSTRUCTIONS = [
  'אתה כותב בדיחות קצרות בעברית.',
  'כתוב בדיחה אחת בלבד, עד ארבעה משפטים, נקייה ומתאימה לכל גיל.',
  'בלי הקדמה, בלי הסבר ובלי אימוג׳י. רק הבדיחה.'
].join(' ');

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return json({ error: 'אפשר לשלוח לכאן רק בקשת POST' }, 405);
    }

    // 1. The key comes from Vercel Environment Variables, never from the code
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OPENAI_API_KEY is missing. Add it in Vercel and redeploy.');
      return json({ error: 'חסר מפתח בשרת' }, 500);
    }

    // 2. Who is asking? Checked BEFORE OpenAI, so a bad token costs nothing.
    const supabase = getSupabase();
    let user = null;
    let canSave = Boolean(supabase);
    if (hasToken(request)) {
      try {
        user = await getUserFromRequest(request, supabase);
        if (!user) return authRequired();
      } catch (err) {
        // Supabase is down: the joke still comes, it just is not saved
        console.error('Supabase Auth not reachable, joke will not be saved:', err?.status, err?.message);
        canSave = false;
      }
    }

    // 3. Read the topic. Empty or broken body means a general joke
    const body = await readJson(request);
    const topic = String(body.topic ?? '').trim().slice(0, MAX_TOPIC);

    // 4. The model name is a setting too, so switching models needs no code change
    const model = process.env.OPENAI_MODEL || 'gpt-5';
    const input = topic ? `נושא הבדיחה: ${topic}` : 'אין נושא. ספר בדיחה כללית על החיים.';

    // 5. Call OpenAI from the server, with the key in the Authorization header
    let res;
    try {
      res = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          instructions: INSTRUCTIONS,
          input,
          reasoning: { effort: 'low' },
          max_output_tokens: 1000
        })
      });
    } catch (err) {
      console.error('Network error calling OpenAI:', err);
      return json({ error: 'אין חיבור ל-OpenAI כרגע. נסו שוב.' }, 502);
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Full details go to Vercel Logs. The user gets a short Hebrew message
      console.error('OpenAI error', res.status, data?.error?.code, data?.error?.message);
      return json({ error: friendlyError(res.status, data?.error?.code) }, 502);
    }

    // 6. Pull the text out of the response and send only the joke back
    const joke = extractText(data);
    if (!joke) {
      console.error('No text in OpenAI response', data?.status, data?.incomplete_details);
      return json({ error: 'לא התקבלה בדיחה. נסו שוב.' }, 502);
    }

    // 7. Save it, with the name from the token. If the database is down, the joke still reaches the user
    const author_name = user ? displayName(user) : null;
    const id = canSave ? await saveJoke(supabase, topic, joke, user?.id ?? null, author_name) : null;
    if (!supabase) console.error('Not saved: SUPABASE_URL or SUPABASE_SECRET_KEY is missing.');

    console.log('Joke served. Topic:', topic || '(general)', '| model:', model,
      '| user:', user ? 'yes' : 'guest', '| saved:', id ? 'yes' : 'no');
    return json({ joke, id, author_name });
  }
};

async function saveJoke(supabase, topic, text, userId, authorName) {
  const { data, error } = await supabase
    .from('jokes')
    .insert({ topic: topic || null, text, user_id: userId, author_name: authorName })
    .select('id')
    .single();
  if (error) {
    console.error('Not saved:', error.code, error.message);
    return null;
  }
  return data.id;
}

// The Responses API returns an `output` array. Text sits in items of type "message",
// inside content parts of type "output_text". There may be other items before it.
function extractText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }
  const parts = [];
  for (const item of data?.output ?? []) {
    if (item?.type !== 'message') continue;
    for (const c of item.content ?? []) {
      if (c?.type === 'output_text' && c.text) parts.push(c.text);
    }
  }
  return parts.join('\n').trim();
}

function friendlyError(status, code) {
  if (status === 401) return 'המפתח לא תקין. צרו מפתח חדש ועדכנו אותו ב-Vercel.';
  if (code === 'credit_balance_exhausted' || code === 'insufficient_quota') {
    return 'נגמר הקרדיט בחשבון OpenAI.';
  }
  if (code === 'project_spend_limit_exceeded' || code === 'organization_spend_limit_exceeded') {
    return 'הגעתם למגבלת ההוצאה החודשית ב-OpenAI.';
  }
  if (status === 429) return 'יותר מדי בקשות. נסו שוב בעוד רגע.';
  if (status === 404) return 'המודל לא נמצא. בדקו את OPENAI_MODEL ב-Vercel.';
  return 'משהו השתבש מול OpenAI. נסו שוב.';
}
