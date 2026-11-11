// lib/supabase.js
// One Supabase client for all our functions. It lives outside api/, so it is not a URL.
// It uses the SECRET key, which bypasses RLS. That is why it may only run on the server.

import { createClient } from '@supabase/supabase-js';

let client = null;
let clientFor = '';

export function getSupabase() {
  const url = process.env.SUPABASE_URL;
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
