// lib/http.js
// Small helpers shared by all our functions. Outside api/, so it is not a URL.

// Every answer depends on who is asking, so nothing may be cached on the way.
export function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

// The page knows this code: it signs out and asks the user to sign in again.
export function authRequired(error = 'צריך להתחבר שוב') {
  return json({ error, code: 'auth_required' }, 401);
}

// Read a JSON body, but never more than maxBytes. Broken or too big: {}.
export async function readJson(request, maxBytes = 10_000) {
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > maxBytes) return {};
    const data = JSON.parse(text);
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}
