// lib/supabase.js
// One Supabase client for all our functions. It lives outside api/, so it is not a URL.
// It uses the SECRET key, which bypasses RLS. That is why it may only run on the server.

import { createClient } from '@supabase/supabase-js';

let client = null;
let clientFor = '';

// Only the project address, e.g. https://abc.supabase.co. A pasted ".../rest/v1/" is cut off.
export function projectUrl() {
  try {
    return new URL(process.env.SUPABASE_URL).origin;
  } catch {
    return '';
  }
}

export function getSupabase() {
  const url = projectUrl();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null; // the caller decides what to do without a database

  // Create the client once, and again only if the address or the key changed
  if (!client || clientFor !== url + key) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false } // a server has no user session
    });
    clientFor = url + key;
  }
  return client;
}

// The token the page sent in "Authorization: Bearer <token>", or ''.
function tokenOf(request) {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

export function hasToken(request) {
  return tokenOf(request) !== '';
}

// Who is asking? Only Supabase decides, from the token. Nothing from the body counts.
// Returns the user, or null for no token or a token Supabase does not know.
// Throws when Supabase itself is not reachable, so the caller can tell the two apart.
export async function getUserFromRequest(request, supabase) {
  const token = tokenOf(request);
  if (!token) return null;
  if (!supabase) throw new Error('Supabase is not configured');

  const { data, error } = await supabase.auth.getUser(token);
  if (error) {
    const status = error.status ?? 0;
    if (status >= 400 && status < 500) return null; // bad, expired or deleted user's token
    throw error; // network error or 5xx
  }
  return data?.user ?? null;
}

// The name the user chose at sign up (or that Google sent), up to 30 characters.
export function displayName(user) {
  const name = String(user?.user_metadata?.full_name ?? '').trim().slice(0, 30).trim();
  return name || null;
}
