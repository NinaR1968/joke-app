// api/joke.js
// Vercel Function: gets a topic from the page, asks OpenAI for a short Hebrew joke,
// saves it in Supabase, and returns { joke, id }. Both keys live only here, in process.env.
// The browser never sees a key: it only talks to /api/joke on our own domain.

import { getSupabase } from '../lib/supabase.js';

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
      return Response.json({ error: 'אפשר לשלוח לכאן רק בקשת POST' }, { status: 405 });
    }

    // 1. The key comes from Vercel Environment Variables, never from the code
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OPENAI_API_KEY is missing. Add it in Vercel and redeploy.');
      return Response.json({ error: 'חסר מפתח בשרת' }, { status: 500 });
    }

    // 2. Read the topic. Empty or broken body means a general joke
    let topic = '';
    try {
      const body = await request.json();
      topic = String(body?.topic ?? '').trim().slice(0, MAX_TOPIC);
    } catch {
      topic = '';
    }

    // 3. The model name is a setting too, so switching models needs no code change
    const model = process.env.OPENAI_MODEL || 'gpt-5';
    const input = topic ? `נושא הבדיחה: ${topic}` : 'אין נושא. ספר בדיחה כללית על החיים.';

    // 4. Call OpenAI from the server, with the key in the Authorization header
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
      return Response.json({ error: 'אין חיבור ל-OpenAI כרגע. נסו שוב.' }, { status: 502 });
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Full details go to Vercel Logs. The user gets a short Hebrew message
      console.error('OpenAI error', res.status, data?.error?.code, data?.error?.message);
      return Response.json({ error: friendlyError(res.status, data?.error?.code) }, { status: 502 });
    }

    // 5. Pull the text out of the response and send only the joke back
    const joke = extractText(data);
    if (!joke) {
      console.error('No text in OpenAI response', data?.status, data?.incomplete_details);
      return Response.json({ error: 'לא התקבלה בדיחה. נסו שוב.' }, { status: 502 });
    }

    // 6. Save it. If the database is down, the joke still reaches the user
    const id = await saveJoke(topic, joke);

    console.log('Joke served. Topic:', topic || '(general)', '| model:', model, '| saved:', id ? 'yes' : 'no');
    return Response.json({ joke, id });
  }
};

async function saveJoke(topic, text) {
  const supabase = getSupabase();
  if (!supabase) {
    console.error('Not saved: SUPABASE_URL or SUPABASE_SECRET_KEY is missing.');
    return null;
  }
  const { data, error } = await supabase
    .from('jokes')
    .insert({ topic: topic || null, text })
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
