import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TENANT_ID = Deno.env.get("MS_GRAPH_TENANT_ID") || "";
const CLIENT_ID = Deno.env.get("MS_GRAPH_CLIENT_ID") || "";
const CLIENT_SECRET = Deno.env.get("MS_GRAPH_CLIENT_SECRET") || "";
const EXPECTED_SENDER =
  (Deno.env.get("MS_GRAPH_SENDER") || "").trim().toLowerCase();
const ENCRYPTION_KEY =
  Deno.env.get("MS_GRAPH_TOKEN_ENCRYPTION_KEY") || "";

const REDIRECT_URI =
  `${SUPABASE_URL}/functions/v1/graph-oauth-callback`;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
};

const fromBase64Url = (value: string) => {
  const padded =
    value.replaceAll("-", "+").replaceAll("_", "/") +
    "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const getAesKey = async () => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(ENCRYPTION_KEY)
  );
  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
};

const encryptRefreshToken = async (value: string) => {
  const key = await getAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(value)
  );
  return `${toBase64Url(iv)}.${toBase64Url(new Uint8Array(cipher))}`;
};

const signState = async (value: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(ENCRYPTION_KEY),
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

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

Deno.serve(async (req) => {
  if (
    !SUPABASE_URL ||
    !SERVICE_ROLE ||
    !TENANT_ID ||
    !CLIENT_ID ||
    !CLIENT_SECRET ||
    !EXPECTED_SENDER ||
    !ENCRYPTION_KEY
  ) {
    return new Response(
      "Graph OAuth server configuration incomplete",
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const oauthErrorDescription = url.searchParams.get("error_description");

  if (oauthError) {
    return new Response(
      `<h2>Microsoft Graph authorization gagal</h2><p>${escapeHtml(
        oauthErrorDescription || oauthError
      )}</p>`,
      {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  if (!code || !state) {
    return new Response("Missing OAuth code/state", { status: 400 });
  }

  const [stateBody, stateSignature] = state.split(".");
  if (!stateBody || !stateSignature) {
    return new Response("Invalid OAuth state", { status: 400 });
  }

  const expectedSignature = await signState(stateBody);
  if (expectedSignature !== stateSignature) {
    return new Response("OAuth state signature mismatch", { status: 400 });
  }

  let statePayload: Record<string, unknown> = {};
  try {
    statePayload = JSON.parse(
      decoder.decode(fromBase64Url(stateBody))
    );
  } catch {
    return new Response("Invalid OAuth state payload", { status: 400 });
  }

  const stateTimestamp = Number(statePayload.ts || 0);
  if (
    !stateTimestamp ||
    Math.abs(Date.now() - stateTimestamp) > 10 * 60 * 1000
  ) {
    return new Response("OAuth state expired", { status: 400 });
  }

  const tokenBody = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
    scope: "openid profile offline_access User.Read Mail.Send",
  });

  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody,
    }
  );
  const tokenPayload = await tokenResponse.json();

  if (!tokenResponse.ok) {
    return new Response(
      `<h2>Token exchange gagal</h2><pre>${escapeHtml(
        tokenPayload?.error_description ||
          tokenPayload?.error ||
          String(tokenResponse.status)
      )}</pre>`,
      {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  const accessToken = String(tokenPayload.access_token || "");
  const refreshToken = String(tokenPayload.refresh_token || "");
  if (!accessToken || !refreshToken) {
    return new Response(
      "Microsoft tidak mengembalikan access_token/refresh_token.",
      { status: 400 }
    );
  }

  const meResponse = await fetch(
    "https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const me = await meResponse.json();
  if (!meResponse.ok) {
    return new Response(
      "Gagal memverifikasi mailbox Microsoft Graph.",
      { status: 400 }
    );
  }

  const senderCandidates = [
    String(me.mail || "").trim().toLowerCase(),
    String(me.userPrincipalName || "").trim().toLowerCase(),
  ].filter(Boolean);

  if (!senderCandidates.includes(EXPECTED_SENDER)) {
    return new Response(
      `<h2>Mailbox tidak sesuai</h2><p>Login harus menggunakan <b>${escapeHtml(
        EXPECTED_SENDER
      )}</b>.</p>`,
      {
        status: 403,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  const encryptedRefreshToken = await encryptRefreshToken(refreshToken);
  const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: saveError } = await serviceClient
    .from("graph_oauth_credentials")
    .upsert(
      {
        id: 1,
        sender_email: EXPECTED_SENDER,
        encrypted_refresh_token: encryptedRefreshToken,
        token_scope: String(tokenPayload.scope || ""),
        authorized_at: new Date().toISOString(),
        last_refresh_at: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (saveError) {
    return new Response(
      `Gagal menyimpan refresh token: ${escapeHtml(saveError.message)}`,
      { status: 500 }
    );
  }

  return new Response(
    `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Graph Connected</title>
      </head>
      <body style="font-family:Arial,sans-serif;padding:40px;max-width:720px;margin:auto">
        <h2>Microsoft Graph berhasil terhubung ✅</h2>
        <p>Mailbox <b>${escapeHtml(EXPECTED_SENDER)}</b> sudah memiliki refresh token terenkripsi.</p>
        <p>Silakan kembali ke Dashboard Marketing. Tab ini boleh ditutup.</p>
      </body>
    </html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );
});
