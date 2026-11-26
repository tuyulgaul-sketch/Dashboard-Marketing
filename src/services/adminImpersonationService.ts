import { supabase } from "@/lib/supabase";

export type AdminImpersonationResult = {
  success: boolean;
  action_link: string;
  admin: { profile_id: string; full_name: string; email: string };
  target: { profile_id: string; full_name: string; email: string; role_level: string; unit: string };
};

const readError = async (error: unknown): Promise<string> => {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try {
      const payload = await context.clone().json();
      if (payload && typeof payload === "object" && "error" in payload && payload.error) {
        return String(payload.error);
      }
    } catch {
      // Preserve the original error when the response is not JSON.
    }
  }
  return error instanceof Error ? error.message : "Permintaan Login As gagal.";
};

export const startAdminImpersonation = async (
  profileId: string
): Promise<AdminImpersonationResult> => {
  const { data, error } = await supabase.functions.invoke("admin-impersonate", {
    body: { profile_id: profileId },
  });
  if (error) throw new Error(await readError(error));
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String(data.error));
  }
  if (!data || typeof data !== "object" || !data.success || !data.action_link || !data.target?.profile_id) {
    throw new Error("Server tidak mengembalikan Login As link yang valid.");
  }
  const result = data as AdminImpersonationResult;
  const url = new URL(result.action_link);
  const expected = new URL(import.meta.env.VITE_SUPABASE_URL);
  if (url.origin !== expected.origin || !url.pathname.startsWith("/auth/v1/verify")) {
    throw new Error("Alamat verifikasi Login As tidak sesuai dengan project Supabase.");
  }
  if (url.searchParams.get("type") !== "magiclink") {
    throw new Error("Tipe verifikasi Login As tidak sesuai.");
  }
  return result;
};
