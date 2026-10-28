const INSTRUCTIONS =
  "אתה כותב בדיחות קצרות בעברית. כתוב בדיחה אחת בלבד, עד ארבעה משפטים, נקייה ומתאימה לכל גיל. בלי הקדמה, בלי הסבר ובלי אימוג׳י. רק הבדיחה.";

const MESSAGES = {
  noKey: "השרת לא מוגדר עדיין.",
  auth: "יש בעיה במפתח של השרת. נסו שוב מאוחר יותר.",
  limit: "הבדיחות נגמרו להיום. נסו שוב מאוחר יותר.",
  model: "המודל לא נמצא. בדקו את ההגדרות בשרת.",
  generic: "לא הצלחתי להביא בדיחה. נסו שוב.",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

function extractText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }
  const parts = [];
  for (const item of data?.output ?? []) {
    if (item?.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part?.type === "output_text" && typeof part.text === "string") parts.push(part.text);
    }
  }
  return parts.join("").trim();
}

function openaiErrorMessage(status, code) {
  if (status === 401) return MESSAGES.auth;
  if (status === 404) return MESSAGES.model;
  if (status === 429 || code === "insufficient_quota") return MESSAGES.limit;
  return MESSAGES.generic;
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return json({ error: "אפשר לשלוח רק בקשת POST." }, 405);
    }

    let topic = "";
    try {
      const body = await request.json();
      if (typeof body?.topic === "string") topic = body.topic.trim().slice(0, 100);
    } catch {
      topic = "";
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("OPENAI_API_KEY is missing");
      return json({ error: MESSAGES.noKey }, 500);
    }

    const model = process.env.OPENAI_MODEL || "gpt-5";
    console.log(`joke request: topic="${topic}" model=${model}`);

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          instructions: INSTRUCTIONS,
          input: topic ? `נושא הבדיחה: ${topic}` : "אין נושא. ספר בדיחה כללית על החיים.",
          reasoning: { effort: "low" },
          max_output_tokens: 2000,
        }),
        signal: AbortSignal.timeout(25000),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const code = data?.error?.code;
        console.error(`OpenAI error: status=${response.status} code=${code} message=${data?.error?.message}`);
        return json({ error: openaiErrorMessage(response.status, code) }, 502);
      }

      const joke = extractText(data);
      if (!joke) {
        console.error(
          `OpenAI returned no text: status=${data?.status} reason=${data?.incomplete_details?.reason}`
        );
        return json({ error: MESSAGES.generic }, 502);
      }

      return json({ joke });
    } catch (err) {
      console.error(`joke function failed: ${err?.name}: ${err?.message}`);
      return json({ error: MESSAGES.generic }, 500);
    }
  },
};
