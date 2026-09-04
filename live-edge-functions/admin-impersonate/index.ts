import { createClient } from "npm:@supabase/supabase-js@2.57.4";

type TargetProfile = {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  email: string;
  role_level: string;
  unit: string;
  active: boolean;
};

type AdminProfile = {
  id: string;
  full_name: string;
  email: string;
  role_level: string;
  unit: string;
  active: boolean;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json; charset=utf-8",
    },
  });

const isSystemAdmin = (
  profile: Pick<AdminProfile, "role_level" | "unit">
) => {
  const role = String(profile.role_level || "").trim().toUpperCase();
  const unit = String(profile.unit || "").trim().toLowerCase();
  return role === "SYSTEM_ADMIN" || unit === "administrasi sistem";
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) {
    return json(
      { error: "Supabase server configuration belum lengkap." },
      500
    );
  }

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) {
    return json({ error: "Authenticated admin session required." }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: callerData, error: callerError } =
    await adminClient.auth.getUser(token);
  if (callerError || !callerData.user) {
    return json(
      { error: "Admin session tidak valid atau sudah berakhir." },
      401
    );
  }

  const { data: adminProfileData, error: adminProfileError } =
    await adminClient
      .from("profiles")
      .select("id, full_name, email, role_level, unit, active")
      .eq("auth_user_id", callerData.user.id)
      .eq("active", true)
      .maybeSingle();

  if (adminProfileError || !adminProfileData) {
    return json({ error: "Profile admin aktif tidak ditemukan." }, 403);
  }

  const adminProfile = adminProfileData as AdminProfile;
  if (!isSystemAdmin(adminProfile)) {
    return json(
      { error: "Hanya SYSTEM_ADMIN yang dapat menggunakan Login As." },
      403
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Request body tidak valid." }, 400);
  }

  const targetProfileId =
    typeof payload.profile_id === "string" ? payload.profile_id.trim() : "";
  if (!targetProfileId) {
    return json({ error: "Target profile wajib dipilih." }, 400);
  }
  if (targetProfileId === adminProfile.id) {
    return json({ error: "Tidak perlu Login As ke akun admin sendiri." }, 400);
  }

  const { data: targetProfileData, error: targetProfileError } =
    await adminClient
      .from("profiles")
      .select("id, auth_user_id, full_name, email, role_level, unit, active")
      .eq("id", targetProfileId)
      .eq("active", true)
      .maybeSingle();

  if (targetProfileError || !targetProfileData) {
    return json({ error: "Target user aktif tidak ditemukan." }, 404);
  }

  const targetProfile = targetProfileData as TargetProfile;
  if (isSystemAdmin(targetProfile)) {
    return json(
      { error: "Login As ke akun SYSTEM_ADMIN lain tidak diizinkan." },
      403
    );
  }
  if (!targetProfile.auth_user_id) {
    return json(
      { error: "Akun target belum diaktifkan di Supabase Auth." },
      409
    );
  }

  const { data: targetAuthData, error: targetAuthError } =
    await adminClient.auth.admin.getUserById(targetProfile.auth_user_id);
  if (targetAuthError || !targetAuthData.user?.email) {
    return json(
      { error: "Auth user target tidak ditemukan atau tidak memiliki email." },
      409
    );
  }

  const { data: linkData, error: linkError } =
    await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: targetAuthData.user.email,
    });

  const actionLink = linkData?.properties?.action_link || "";
  if (linkError || !actionLink) {
    console.error("[ADMIN_LOGIN_AS] generateLink failed", {
      admin_profile_id: adminProfile.id,
      target_profile_id: targetProfile.id,
      error: linkError?.message || "missing_action_link",
    });
    return json(
      {
        error:
          "Gagal membuat sesi Login As. Coba lagi atau periksa konfigurasi Auth Site URL.",
      },
      500
    );
  }

  console.info("[ADMIN_LOGIN_AS] issued", {
    admin_profile_id: adminProfile.id,
    admin_name: adminProfile.full_name,
    target_profile_id: targetProfile.id,
    target_name: targetProfile.full_name,
    issued_at: new Date().toISOString(),
  });

  return json({
    success: true,
    action_link: actionLink,
    admin: {
      profile_id: adminProfile.id,
      full_name: adminProfile.full_name,
      email: adminProfile.email,
    },
    target: {
      profile_id: targetProfile.id,
      full_name: targetProfile.full_name,
      email: targetProfile.email,
      role_level: targetProfile.role_level,
      unit: targetProfile.unit,
    },
  });
});
