import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,x-pertalife-survey-key",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  try {
    const ingestKey = req.headers.get("x-pertalife-survey-key") || "";
    if (!ingestKey) {
      return new Response(JSON.stringify({ error: "Missing survey ingest key" }), { status: 401, headers });
    }

    const payload = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Supabase service environment is not configured.");

    const client = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.rpc("ingest_pertalife_care_survey_v1", {
      p_secret: ingestKey,
      p_payload: payload,
    });

    if (error) {
      const unauthorized = /invalid survey ingest key/i.test(error.message || "");
      return new Response(
        JSON.stringify({ error: unauthorized ? "Unauthorized" : error.message }),
        { status: unauthorized ? 401 : 400, headers },
      );
    }

    return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }),
      { status: 500, headers },
    );
  }
});
