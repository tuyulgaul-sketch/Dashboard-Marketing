import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TENANT_ID = Deno.env.get("MS_GRAPH_TENANT_ID") || "";
const CLIENT_ID = Deno.env.get("MS_GRAPH_CLIENT_ID") || "";
const STATE_SECRET = Deno.env.get("MS_GRAPH_TOKEN_ENCRYPTION_KEY") || "";

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/graph-oauth-callback`;
const encoder = new TextEncoder();

const toBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
};

const signState = async (value: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(STATE_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value)
  );
  return toBase64Url(new Uint8Array(signature));
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE || !TENANT_ID || !CLIENT_ID || !STATE_SECRET) {
    return json({ error: "Graph OAuth server configuration incomplete" }, 500);
  }
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "Invalid session" }, 401);

  const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: adminProfile } = await serviceClient
    .from("profiles")
    .select("role_level, unit, active")
    .eq("auth_user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  const isAdmin = Boolean(
    adminProfile && (
      String(adminProfile.role_level || "").trim().toUpperCase() === "SYSTEM_ADMIN" ||
      String(adminProfile.unit || "").trim().toLowerCase() === "administrasi sistem"
    )
  );
  if (!isAdmin) return json({ error: "SYSTEM_ADMIN access required" }, 403);

  const payload = JSON.stringify({ ts: Date.now(), nonce: crypto.randomUUID() });
  const stateBody = toBase64Url(encoder.encode(payload));
  const signature = await signState(stateBody);
  const state = `${stateBody}.${signature}`;

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    response_mode: "query",
    scope: "openid profile offline_access User.Read Mail.Send",
    state,
    prompt: "consent",
  });

  return json({
    success: true,
    authorization_url: `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?${params.toString()}`,
  });
});
