import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const BUCKET = "activity-attachments";

type TargetProfile = {
  id: string;
  full_name: string;
  email: string;
  auth_user_id: string | null;
  role_level: string;
  unit: string;
  active: boolean;
};

const passwordIsValid = (value: string) =>
  value.length >= 12 &&
  /[A-Z]/.test(value) &&
  /[a-z]/.test(value) &&
  /[0-9]/.test(value);

const randomIndex = (max: number) => {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] % max;
};

const generateTemporaryPassword = () => {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const number = "23456789";
  const symbol = "!@#$%*-_";
  const all = upper + lower + number + symbol;
  const chars = [
    upper[randomIndex(upper.length)],
    lower[randomIndex(lower.length)],
    number[randomIndex(number.length)],
    symbol[randomIndex(symbol.length)],
  ];
  while (chars.length < 16) chars.push(all[randomIndex(all.length)]);
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swap = randomIndex(index + 1);
    [chars[index], chars[swap]] = [chars[swap], chars[index]];
  }
  return chars.join("");
};

const findAuthUserByEmail = async (
  serviceClient: ReturnType<typeof createClient>,
  email: string
) => {
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await serviceClient.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;
    const found = data.users.find(
      (user) =>
        String(user.email || "").trim().toLowerCase() ===
        email.trim().toLowerCase()
    );
    if (found) return found;
    if (data.users.length < perPage) return null;
    page += 1;
  }
};

const activateTargetProfile = async (
  serviceClient: ReturnType<typeof createClient>,
  targetProfile: TargetProfile,
  temporaryPassword: string
) => {
  if (targetProfile.auth_user_id) {
    return {
      status: "SKIPPED" as const,
      auth_user_id: targetProfile.auth_user_id,
    };
  }

  if (!targetProfile.email.trim().toLowerCase().endsWith("@pertalife.com")) {
    throw new Error("Aktivasi hanya diizinkan untuk email @pertalife.com.");
  }
  if (!passwordIsValid(temporaryPassword)) {
    throw new Error(
      "Password minimal 12 karakter dan wajib memiliki huruf besar, huruf kecil, serta angka."
    );
  }

  const existingUser = await findAuthUserByEmail(
    serviceClient,
    targetProfile.email
  );

  if (existingUser) {
    const { error: repairError } =
      await serviceClient.auth.admin.updateUserById(existingUser.id, {
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          ...(existingUser.user_metadata || {}),
          full_name: targetProfile.full_name,
          activated_by_system_admin: true,
        },
      });
    if (repairError) throw repairError;

    const { error: profileLinkError } = await serviceClient
      .from("profiles")
      .update({
        auth_user_id: existingUser.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetProfile.id)
      .eq("active", true);
    if (profileLinkError) throw profileLinkError;

    return { status: "REPAIRED" as const, auth_user_id: existingUser.id };
  }

  const { data: created, error: createError } =
    await serviceClient.auth.admin.createUser({
      email: targetProfile.email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: targetProfile.full_name,
        activated_by_system_admin: true,
      },
    });
  if (createError || !created.user) {
    throw createError || new Error("Auth user gagal dibuat.");
  }

  const { error: profileLinkError } = await serviceClient
    .from("profiles")
    .update({
      auth_user_id: created.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", targetProfile.id)
    .eq("active", true);

  if (profileLinkError) {
    try {
      await serviceClient.auth.admin.deleteUser(created.user.id);
    } catch {
      // Best-effort rollback.
    }
    throw profileLinkError;
  }

  return { status: "CREATED" as const, auth_user_id: created.user.id };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Supabase server environment is not configured." }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const serviceClient = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "Invalid session" }, 401);

  const { data: adminProfile, error: adminError } = await serviceClient
    .from("profiles")
    .select("id, full_name, email, role_level, unit, active")
    .eq("auth_user_id", user.id)
    .eq("active", true)
    .single();

  if (
    adminError ||
    !adminProfile ||
    !(
      String(adminProfile.role_level || "").trim().toUpperCase() ===
        "SYSTEM_ADMIN" ||
      String(adminProfile.unit || "").trim().toLowerCase() ===
        "administrasi sistem"
    )
  ) {
    return json({ error: "SYSTEM_ADMIN access required" }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const action = String(body.action || "").trim();

  if (action === "activate_account") {
    const profileId = String(body.profile_id || "").trim();
    const temporaryPassword = String(body.temporary_password || "");
    if (!profileId) return json({ error: "profile_id is required" }, 400);

    const { data: targetProfile, error: targetError } = await serviceClient
      .from("profiles")
      .select("id, full_name, email, auth_user_id, role_level, unit, active")
      .eq("id", profileId)
      .eq("active", true)
      .single();
    if (targetError || !targetProfile) {
      return json({ error: "Target account tidak ditemukan." }, 404);
    }

    try {
      const result = await activateTargetProfile(
        serviceClient,
        targetProfile as TargetProfile,
        temporaryPassword
      );
      return json({
        success: true,
        action: "activate_account",
        profile_id: targetProfile.id,
        full_name: targetProfile.full_name,
        email: targetProfile.email,
        activation_status: result.status,
        auth_user_id: result.auth_user_id,
      });
    } catch (error) {
      return json(
        {
          error:
            error instanceof Error ? error.message : "Aktivasi akun gagal.",
        },
        500
      );
    }
  }

  if (action === "activate_all_accounts") {
    const { data: profiles, error: profilesError } = await serviceClient
      .from("profiles")
      .select("id, full_name, email, auth_user_id, role_level, unit, active")
      .eq("active", true)
      .is("auth_user_id", null)
      .order("full_name");
    if (profilesError) return json({ error: profilesError.message }, 500);

    const results: Array<Record<string, unknown>> = [];
    for (const profileRow of profiles || []) {
      if (
        String(profileRow.role_level || "").trim().toUpperCase() ===
        "SYSTEM_ADMIN"
      ) {
        continue;
      }
      const temporaryPassword = generateTemporaryPassword();
      try {
        const result = await activateTargetProfile(
          serviceClient,
          profileRow as TargetProfile,
          temporaryPassword
        );
        results.push({
          profile_id: profileRow.id,
          full_name: profileRow.full_name,
          email: profileRow.email,
          status: result.status,
          temporary_password:
            result.status === "SKIPPED" ? null : temporaryPassword,
          error: null,
        });
      } catch (error) {
        results.push({
          profile_id: profileRow.id,
          full_name: profileRow.full_name,
          email: profileRow.email,
          status: "FAILED",
          temporary_password: null,
          error:
            error instanceof Error ? error.message : "Aktivasi gagal.",
        });
      }
    }
    return json({ success: true, action: "activate_all_accounts", results });
  }

  if (action === "send_test_notification") {
    const profileId = String(body.profile_id || "").trim();
    if (!profileId) return json({ error: "profile_id is required" }, 400);

    const { data: targetProfile, error: targetError } = await serviceClient
      .from("profiles")
      .select("id, full_name, email, auth_user_id, active")
      .eq("id", profileId)
      .eq("active", true)
      .single();
    if (targetError || !targetProfile) {
      return json({ error: "Target account tidak ditemukan." }, 404);
    }
    if (!targetProfile.auth_user_id) {
      return json(
        { error: "Target belum memiliki Auth user. Aktifkan akun terlebih dahulu." },
        409
      );
    }

    const { data: notificationId, error: notificationError } =
      await serviceClient.rpc("create_system_notification", {
        p_recipient_profile_id: targetProfile.id,
        p_notification_type: "SYSTEM_TEST",
        p_title: "Tes sinkronisasi notifikasi",
        p_message: `Notifikasi uji dikirim dari Administrasi Sistem oleh ${adminProfile.full_name}.`,
        p_related_record_id: null,
        p_link_path: "/aktivitas",
        p_module: "SYSTEM",
        p_dedupe_key: `system-test:${targetProfile.id}:${crypto.randomUUID()}`,
      });
    if (notificationError) return json({ error: notificationError.message }, 500);

    return json({
      success: true,
      action: "send_test_notification",
      notification_id: notificationId,
      recipient_email: targetProfile.email,
    });
  }

  if (action === "reset_all_passwords") {
    const newPassword = String(body.new_password || "");
    if (!passwordIsValid(newPassword)) {
      return json(
        {
          error:
            "Password minimal 12 karakter dan wajib memiliki huruf besar, huruf kecil, serta angka.",
        },
        400
      );
    }

    const { data: profiles, error: profilesError } = await serviceClient
      .from("profiles")
      .select("id, full_name, email, auth_user_id, role_level, unit, active")
      .eq("active", true)
      .not("auth_user_id", "is", null)
      .order("full_name");
    if (profilesError) return json({ error: profilesError.message }, 500);

    const failed: Array<{
      profile_id: string;
      full_name: string;
      email: string;
      error: string;
    }> = [];
    let updatedAccounts = 0;
    const rows = profiles || [];
    const batchSize = 5;

    for (let index = 0; index < rows.length; index += batchSize) {
      const batch = rows.slice(index, index + batchSize);
      const results = await Promise.all(
        batch.map(async (profileRow) => {
          try {
            const { error: passwordError } =
              await serviceClient.auth.admin.updateUserById(
                String(profileRow.auth_user_id),
                { password: newPassword }
              );
            if (passwordError) throw passwordError;
            return { ok: true, profileRow, error: "" };
          } catch (error) {
            return {
              ok: false,
              profileRow,
              error:
                error instanceof Error
                  ? error.message
                  : typeof error === "object"
                    ? JSON.stringify(error)
                    : String(error),
            };
          }
        })
      );

      for (const result of results) {
        if (result.ok) {
          updatedAccounts += 1;
          continue;
        }
        failed.push({
          profile_id: String(result.profileRow.id),
          full_name: String(result.profileRow.full_name || ""),
          email: String(result.profileRow.email || ""),
          error: result.error,
        });
      }
    }

    console.log("SYSTEM_ADMIN bulk password reset completed", {
      initiated_by: adminProfile.id,
      total_accounts: rows.length,
      updated_accounts: updatedAccounts,
      failed_accounts: failed.length,
    });

    return json({
      success: failed.length === 0,
      action: "reset_all_passwords",
      total_accounts: rows.length,
      updated_accounts: updatedAccounts,
      failed_accounts: failed.length,
      failed,
    });
  }

  if (action === "reset_password") {
    const profileId = String(body.profile_id || "").trim();
    const newPassword = String(body.new_password || "");
    if (!profileId) return json({ error: "profile_id is required" }, 400);
    if (!passwordIsValid(newPassword)) {
      return json(
        {
          error:
            "Password minimal 12 karakter dan wajib memiliki huruf besar, huruf kecil, serta angka.",
        },
        400
      );
    }

    const { data: targetProfile, error: targetError } = await serviceClient
      .from("profiles")
      .select("id, full_name, email, auth_user_id, active")
      .eq("id", profileId)
      .eq("active", true)
      .single();
    if (targetError || !targetProfile) {
      return json({ error: "Target account tidak ditemukan." }, 404);
    }
    if (!targetProfile.auth_user_id) {
      return json({ error: "Akun belum memiliki Supabase Auth user." }, 409);
    }

    const { error: passwordError } =
      await serviceClient.auth.admin.updateUserById(targetProfile.auth_user_id, {
        password: newPassword,
      });
    if (passwordError) return json({ error: passwordError.message }, 500);

    return json({
      success: true,
      action: "reset_password",
      profile_id: targetProfile.id,
      full_name: targetProfile.full_name,
      email: targetProfile.email,
    });
  }

  if (action === "global_reset") {
    try {
      const { error: emptyBucketError } =
        await serviceClient.storage.emptyBucket(BUCKET);
      if (emptyBucketError) {
        const storageMessage = String(
          emptyBucketError.message || emptyBucketError
        );
        const bucketMissing =
          storageMessage.toLowerCase().includes("bucket") &&
          storageMessage.toLowerCase().includes("not");
        if (!bucketMissing) {
          throw new Error(
            `activity-attachments cleanup failed: ${storageMessage}`
          );
        }
      }

      const { data: resetResult, error: resetError } =
        await userClient.rpc("admin_global_reset_database");
      if (resetError) {
        throw new Error(`Database reset failed: ${resetError.message}`);
      }

      return json({
        success: true,
        action: "global_reset",
        storage_cleanup: emptyBucketError ? "bucket_not_present" : "completed",
        database: resetResult,
      });
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : typeof error === "object"
            ? JSON.stringify(error)
            : String(error);
      console.error("global_reset failed:", detail);
      return json({ error: detail }, 500);
    }
  }

  return json(
    {
      error:
        "Unknown action. Use activate_account, activate_all_accounts, send_test_notification, reset_password, reset_all_passwords, or global_reset.",
    },
    400
  );
});
