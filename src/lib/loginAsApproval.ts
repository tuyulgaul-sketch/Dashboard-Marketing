import { supabase } from "@/lib/supabase";

const KEY = "pertalife_dashboard_login_as_approval_v1";

export function storeLoginAsApproval(approval: string, targetEmail: string) {
  sessionStorage.setItem(KEY, JSON.stringify({ approval, targetEmail: targetEmail.toLowerCase(), expiresAt: Date.now() + 180000 }));
}

export async function claimPendingLoginAsApproval(email?: string): Promise<void> {
  let pending: { approval: string; targetEmail: string; expiresAt: number } | null = null;
  try { pending = JSON.parse(sessionStorage.getItem(KEY) || "null"); }
  catch { sessionStorage.removeItem(KEY); }
  if (!pending) return;
  if (pending.expiresAt <= Date.now()) { sessionStorage.removeItem(KEY); return; }
  if (pending.targetEmail !== email?.toLowerCase()) return;
  const { data, error } = await supabase.rpc("dashboard_login_as_claim", { p_approval: pending.approval });
  if (error) throw new Error("Verifikasi izin Login As belum berhasil. Coba Login As kembali.");
  sessionStorage.removeItem(KEY);
  if (data !== true) throw new Error("Izin Login As tidak valid atau telah berakhir.");
}
