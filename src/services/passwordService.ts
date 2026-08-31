import { supabase } from "@/lib/supabase";

const passwordIsValid = (value: string) =>
  value.length >= 12 &&
  /[A-Z]/.test(value) &&
  /[a-z]/.test(value) &&
  /[0-9]/.test(value);

const assertPassword = (value: string) => {
  if (!passwordIsValid(value)) {
    throw new Error(
      "Password minimal 12 karakter dan wajib memiliki huruf besar, huruf kecil, serta angka."
    );
  }
};

const readFunctionError = async (error: unknown) => {
  const fallback =
    error instanceof Error ? error.message : "Permintaan ke server gagal.";

  const context = (error as { context?: Response } | null)?.context;

  if (context && typeof context.clone === "function") {
    try {
      const payload = await context.clone().json();

      if (
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        payload.error
      ) {
        return String(payload.error);
      }
    } catch {
      // Fall back to the original FunctionsHttpError message.
    }
  }

  return fallback;
};

export const changeMyPassword = async (
  currentPassword: string,
  newPassword: string
) => {
  assertPassword(newPassword);

  if (currentPassword === newPassword) {
    throw new Error("Password baru harus berbeda dari password saat ini.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || !user.email) {
    throw new Error("Sesi login tidak valid. Silakan login ulang.");
  }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (reauthError) {
    throw new Error("Password saat ini tidak sesuai.");
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    throw new Error(updateError.message);
  }

  try {
    await supabase.auth.signOut({ scope: "others" });
  } catch {
    // Password update itself is already complete.
  }
};

export type BulkPasswordResetResult = {
  success: boolean;
  action: string;
  total_accounts: number;
  updated_accounts: number;
  failed_accounts: number;
  failed: Array<{
    profile_id: string;
    full_name: string;
    email: string;
    error: string;
  }>;
};

export const resetAllAccountPasswords = async (
  newPassword: string
): Promise<BulkPasswordResetResult> => {
  assertPassword(newPassword);

  const { data, error } = await supabase.functions.invoke(
    "admin-user-control",
    {
      body: {
        action: "reset_all_passwords",
        new_password: newPassword,
      },
    }
  );

  if (error) {
    throw new Error(await readFunctionError(error));
  }

  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    data.error
  ) {
    throw new Error(String(data.error));
  }

  return data as BulkPasswordResetResult;
};
