import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TENANT_ID = Deno.env.get("MS_GRAPH_TENANT_ID") || "";
const CLIENT_ID = Deno.env.get("MS_GRAPH_CLIENT_ID") || "";
const CLIENT_SECRET = Deno.env.get("MS_GRAPH_CLIENT_SECRET") || "";
const EXPECTED_SENDER =
  (Deno.env.get("MS_GRAPH_SENDER") || "").trim().toLowerCase();
const ENCRYPTION_KEY = Deno.env.get("MS_GRAPH_TOKEN_ENCRYPTION_KEY") || "";
const TEMP_ACCESS_TOKEN = Deno.env.get("MS_GRAPH_ACCESS_TOKEN") || "";
const WEBHOOK_SECRET = Deno.env.get("NOTIFICATION_WEBHOOK_SECRET") || "";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const fromBase64Url = (value: string) => {
  const padded =
    value.replaceAll("-", "+").replaceAll("_", "/") +
    "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const toBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
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
    ["encrypt", "decrypt"]
  );
};

const decryptRefreshToken = async (payload: string) => {
  const [ivPart, cipherPart] = payload.split(".");
  if (!ivPart || !cipherPart) {
    throw new Error("Encrypted token format invalid");
  }
  const key = await getAesKey();
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(ivPart) },
    key,
    fromBase64Url(cipherPart)
  );
  return decoder.decode(plain);
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

const sendDelegatedMail = async (
  token: string,
  to: string,
  subject: string,
  html: string
) => {
  const response = await fetch(
    "https://graph.microsoft.com/v1.0/me/sendMail",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "HTML", content: html },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: true,
      }),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Graph sendMail ${response.status}: ${await response.text()}`
    );
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE) {
    return json({ error: "Supabase server config missing" }, 500);
  }

  let authorized = false;
  const authHeader = req.headers.get("Authorization");
  if (authHeader) {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: userError } =
      await userClient.auth.getUser();
    if (!userError && user) {
      const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: activeProfile } = await serviceClient
        .from("profiles")
        .select("id, active")
        .eq("auth_user_id", user.id)
        .eq("active", true)
        .maybeSingle();
      authorized = Boolean(activeProfile?.id);
    }
  }

  if (
    !authorized &&
    WEBHOOK_SECRET &&
    req.headers.get("x-webhook-secret") === WEBHOOK_SECRET
  ) {
    authorized = true;
  }
  if (!authorized) return json({ error: "Unauthorized" }, 403);

  const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let accessToken = "";
  let mode = "not-configured";
  const { data: credential } = await serviceClient
    .from("graph_oauth_credentials")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (
    credential &&
    TENANT_ID &&
    CLIENT_ID &&
    CLIENT_SECRET &&
    EXPECTED_SENDER &&
    ENCRYPTION_KEY
  ) {
    try {
      const refreshToken = await decryptRefreshToken(
        credential.encrypted_refresh_token
      );
      const refreshBody = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
        scope: "openid profile offline_access User.Read Mail.Send",
      });
      const refreshResponse = await fetch(
        `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: refreshBody,
        }
      );
      const refreshPayload = await refreshResponse.json();
      if (!refreshResponse.ok) {
        throw new Error(
          refreshPayload?.error_description ||
            refreshPayload?.error ||
            `Refresh failed ${refreshResponse.status}`
        );
      }
      accessToken = String(refreshPayload.access_token || "");
      if (!accessToken) throw new Error("Refresh response missing access_token");

      const rotatedRefreshToken = String(
        refreshPayload.refresh_token || refreshToken
      );
      const encryptedRotated = await encryptRefreshToken(rotatedRefreshToken);
      await serviceClient
        .from("graph_oauth_credentials")
        .update({
          encrypted_refresh_token: encryptedRotated,
          token_scope: String(
            refreshPayload.scope || credential.token_scope || ""
          ),
          last_refresh_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
      mode = "delegated-refresh-token";
    } catch (error) {
      await serviceClient
        .from("graph_oauth_credentials")
        .update({
          last_error:
            error instanceof Error ? error.message : "Refresh token error",
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
      if (TEMP_ACCESS_TOKEN) {
        accessToken = TEMP_ACCESS_TOKEN;
        mode = "delegated-temporary-fallback";
      } else {
        return json(
          {
            error:
              error instanceof Error ? error.message : "Graph refresh failed",
            mode: "refresh-token-failed",
          },
          500
        );
      }
    }
  } else if (TEMP_ACCESS_TOKEN) {
    accessToken = TEMP_ACCESS_TOKEN;
    mode = "delegated-temporary";
  } else {
    return json({ error: "Microsoft Graph belum terhubung.", mode }, 503);
  }

  const { data: rows, error: readError } = await serviceClient
    .from("notification_email_outbox")
    .select("id, recipient_email, subject, html_body, attempts")
    .in("status", ["PENDING", "FAILED"])
    .lt("attempts", 5)
    .order("created_at")
    .limit(25);

  if (readError) return json({ error: readError.message }, 500);

  const batch = (rows || []) as Array<{
    id: string;
    recipient_email: string;
    subject: string;
    html_body: string;
    attempts: number;
  }>;

  let sent = 0;
  let failed = 0;
  for (const row of batch) {
    await serviceClient
      .from("notification_email_outbox")
      .update({
        status: "PROCESSING",
        attempts: Number(row.attempts || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    try {
      await sendDelegatedMail(
        accessToken,
        row.recipient_email,
        row.subject,
        row.html_body
      );
      await serviceClient
        .from("notification_email_outbox")
        .update({
          status: "SENT",
          sent_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      sent += 1;
    } catch (error) {
      await serviceClient
        .from("notification_email_outbox")
        .update({
          status: "FAILED",
          last_error:
            error instanceof Error ? error.message : "Unknown send error",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      failed += 1;
    }
  }

  return json({ success: true, sent, failed, mode });
});
