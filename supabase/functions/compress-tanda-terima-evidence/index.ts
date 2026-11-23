import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

// Restricted evidence migration API. Access bound to the single verified
// Banjar account, validated against user JWT and active database profile.
// The service-role key remains server-side only.
const BUCKET = "business-files";
const MAX_COMPRESSED_BYTES = 1024 * 1024;
const TRUSTED_PRODUCTION = "https://dashboard-marketing-roan.vercel.app";
const TRUSTED_PREVIEW = /^https:\/\/dashboard-marketing-[a-z0-9-]+-das-7350\.vercel\.app$/;

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const trusted = origin === TRUSTED_PRODUCTION || TRUSTED_PREVIEW.test(origin);
  return {
    "Access-Control-Allow-Origin": trusted ? origin : TRUSTED_PRODUCTION,
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}
function json(req: Request, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors(req), "Content-Type": "application/json" },
  });
}
function hex(bytes: Uint8Array): string {
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
async function sha256(bytes: Uint8Array): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}
function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 100 &&
    bytes[0] === 0xff && bytes[1] === 0xd8 &&
    bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
}
function filename(value: string): string {
  return (value || "photo.jpg")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120)
    .replace(/^\.+/, "") || "photo.jpg";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(req) });
  }
  if (req.method !== "POST") return json(req, 405, { error: "Method not allowed" });

  const origin = req.headers.get("origin") || "";
  if (origin && origin !== TRUSTED_PRODUCTION && !TRUSTED_PREVIEW.test(origin)) {
    return json(req, 403, { error: "Origin not allowed" });
  }

  const bearer = req.headers.get("authorization") || "";
  const jwt = bearer.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!jwt) return json(req, 401, { error: "Login required" });

  const url = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !anonKey || !serviceKey) {
    return json(req, 503, { error: "Service unavailable" });
  }

  // Caller-side checks use the *user* JWT and existing database authorization.
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await caller.auth.getUser(jwt);
  if (authError || !authData.user) {
    return json(req, 401, { error: "Session invalid" });
  }

  // Bind this high-risk migration to the exact verified Supabase Auth account.
  // An ordinary MAS role, SYSTEM_ADMIN, or similarly named account cannot run it.
  if (authData.user.id !== "22b5481e-ea83-42cb-a9a1-584a52def642") {
    return json(req, 403, { error: "Akun tidak diizinkan melakukan kompresi massal." });
  }

  const [mfa, operator] = await Promise.all([
    caller.rpc("is_mfa_session_ready"),
    caller.from("profiles")
      .select("id,auth_user_id,email,active,unit,department")
      .eq("auth_user_id", authData.user.id)
      .eq("email", "banjar@pertalife.com")
      .eq("active", true)
      .maybeSingle(),
  ]);
  if (mfa.error || !mfa.data || operator.error ||
      !operator.data ||
      operator.data.auth_user_id !== authData.user.id ||
      String(operator.data.unit).trim().toLowerCase() !== "marketing support" ||
      String(operator.data.department).trim().toLowerCase() !== "digital & affinity") {
    return json(req, 403, { error: "Akses khusus kompresi hanya tersedia untuk akun Banjar aktif dengan sesi yang valid." });
  }

  let form: FormData;
  try { form = await req.formData(); }
  catch { return json(req, 400, { error: "Invalid upload data" }); }

  const fileId = String(form.get("fileId") || "");
  const expectedOriginalSha256 = String(form.get("originalSha256") || "");
  const expectedOriginalBytes = Number(form.get("originalBytes"));
  const output = form.get("compressedPhoto");

  if (!/^TRM-[A-Z-]+-\d{10,}-[a-z0-9]+$/i.test(fileId) ||
      !/^[a-f0-9]{64}$/.test(expectedOriginalSha256) ||
      !Number.isSafeInteger(expectedOriginalBytes) ||
      expectedOriginalBytes < 100_000 || expectedOriginalBytes > 10 * 1024 * 1024 ||
      !(output instanceof File) || output.type !== "image/jpeg" ||
      output.size < 10_000 || output.size > MAX_COMPRESSED_BYTES ||
      output.size >= expectedOriginalBytes * 0.9) {
    return json(req, 400, { error: "Invalid or insufficiently compressed evidence" });
  }

  const { data: visibleRow, error: rowError } = await caller
    .from("central_business_files")
    .select("file_id,module,storage_key,entity_id,storage_path,file_name,mime_type,file_size,metadata")
    .eq("file_id", fileId)
    .maybeSingle();
  if (rowError || !visibleRow ||
      visibleRow.module !== "TANDA_TERIMA" ||
      visibleRow.storage_key !== "pertalife_document_handovers" ||
      visibleRow.mime_type !== "image/jpeg" ||
      !String(visibleRow.storage_path).startsWith(`TANDA_TERIMA/${visibleRow.entity_id}/`) ||
      visibleRow.metadata?.compression?.mode === "EXTREME_V1") {
    return json(req, 403, { error: "Evidence unavailable, inaccessible or already optimized" });
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Reject shared or ambiguous paths: remapping another registry row breaks access.
  const { count, error: countError } = await admin
    .from("central_business_files")
    .select("file_id", { head: true, count: "exact" })
    .eq("storage_path", visibleRow.storage_path);
  if (countError || count !== 1) {
    return json(req, 409, { error: "Storage path has ambiguous references" });
  }

  const { data: originalBlob, error: originalError } = await admin
    .storage.from(BUCKET).download(visibleRow.storage_path);
  if (originalError || !originalBlob) {
    return json(req, 409, { error: "Original evidence cannot be verified" });
  }

  const originalBytes = new Uint8Array(await originalBlob.arrayBuffer());
  if (originalBytes.length !== expectedOriginalBytes ||
      await sha256(originalBytes) !== expectedOriginalSha256) {
    return json(req, 409, { error: "Original changed since browser backup; retry required" });
  }

  const compressedBytes = new Uint8Array(await output.arrayBuffer());
  if (!isJpeg(compressedBytes)) {
    return json(req, 400, { error: "Invalid JPEG output" });
  }
  const outputSha = await sha256(compressedBytes);

  const newPath = [
    "TANDA_TERIMA",
    String(visibleRow.entity_id),
    `${crypto.randomUUID()}-EXTREME-${filename(String(visibleRow.file_name))}`,
  ].join("/");

  const { error: uploadError } = await admin.storage.from(BUCKET).upload(
    newPath,
    compressedBytes,
    { contentType: "image/jpeg", upsert: false }
  );
  if (uploadError) return json(req, 502, { error: "Failed to save compressed evidence" });

  // Verify the uploaded bytes before altering the registry.
  const { data: written, error: verifyError } = await admin.storage.from(BUCKET).download(newPath);
  if (verifyError || !written ||
      await sha256(new Uint8Array(await written.arrayBuffer())) !== outputSha) {
    await admin.storage.from(BUCKET).remove([newPath]);
    return json(req, 502, { error: "New evidence verification failed; original unchanged" });
  }

  const metadata = {
    ...(visibleRow.metadata && typeof visibleRow.metadata === "object" ? visibleRow.metadata : {}),
    compression: {
      mode: "EXTREME_V1",
      optimizedAt: new Date().toISOString(),
      originalBytes: originalBytes.length,
      compressedBytes: compressedBytes.length,
      originalSha256: expectedOriginalSha256,
      compressedSha256: outputSha,
    },
  };
  const { data: changed, error: updateError } = await admin
    .from("central_business_files")
    .update({ storage_path: newPath, file_size: compressedBytes.length, metadata })
    .eq("file_id", fileId)
    .eq("storage_path", visibleRow.storage_path)
    .select("file_id,storage_path");

  if (updateError || !changed || changed.length !== 1) {
    await admin.storage.from(BUCKET).remove([newPath]);
    return json(req, 409, { error: "Registry not updated; original unchanged" });
  }

  // Old object is retired only after the new object and registry are verified.
  const { error: deleteError } = await admin.storage.from(BUCKET)
    .remove([visibleRow.storage_path]);

  return json(req, 200, {
    ok: true,
    fileId,
    originalBytes: originalBytes.length,
    optimizedBytes: compressedBytes.length,
    warning: deleteError ? "New file active but old object could not be removed" : null,
  });
});
