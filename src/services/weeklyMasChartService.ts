import { supabase } from "@/lib/supabase";
import type { MasBucket, MasMeta, MasOverride } from "@/utils/weeklyMasChartEngine";

export type MasUpload = {
  id: string;
  meeting_date: string;
  source_filename: string;
  aggregates: MasBucket[];
  parse_meta: MasMeta;
  created_at: string;
};
export type MasManualDraft = {
  unit: MasOverride["unit"];
  business_type: MasOverride["business_type"];
  product: string;
  status: MasOverride["status"];
  method: MasOverride["method"];
  cases: number | null;
  premium: number | null;
  reason: string;
};

export const readMasPeriod = async (meetingDate: string): Promise<{upload: MasUpload | null; overrides: MasOverride[]}> => {
  const [uploadResult, manualResult] = await Promise.all([
    supabase.from("weekly_marketing_chart_uploads")
      .select("id,meeting_date,source_filename,aggregates,parse_meta,created_at")
      .eq("meeting_date", meetingDate).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("weekly_marketing_chart_overrides")
      .select("id,meeting_date,unit,business_type,product,status,method,cases,premium,reason")
      .eq("meeting_date", meetingDate).order("product", { ascending: true })
  ]);
  if (uploadResult.error) throw new Error("Gagal membaca data CHART: " + uploadResult.error.message);
  if (manualResult.error) throw new Error("Gagal membaca penyesuaian manual: " + manualResult.error.message);
  return {upload: uploadResult.data as MasUpload | null, overrides: (manualResult.data || []) as MasOverride[]};
};

export const saveMasUpload = async (date: string, filename: string, buckets: MasBucket[], meta: MasMeta): Promise<MasUpload> => {
  // Upload revisions are append-only. Each version stays available for an audit trail.
  const {data, error} = await supabase.from("weekly_marketing_chart_uploads")
    .insert({meeting_date: date, source_filename: filename, aggregates: buckets, parse_meta: meta})
    .select("id,meeting_date,source_filename,aggregates,parse_meta,created_at").single();
  if (error || !data) throw new Error(error?.message || "Upload gagal disimpan.");
  return data as MasUpload;
};
export const saveMasOverride = async (date: string, draft: MasManualDraft): Promise<MasOverride> => {
  if (!draft.product.trim() || !draft.reason.trim()) throw new Error("Produk dan keterangan wajib diisi.");
  if (draft.cases === null && draft.premium === null) throw new Error("Isi jumlah case dan/atau nilai premi.");
  if (draft.cases !== null && (!Number.isSafeInteger(draft.cases) || (draft.method === "REPLACE" && draft.cases < 0))) throw new Error("Jumlah case harus bilangan bulat. Nilai pengganti tidak boleh negatif.");
  if (draft.premium !== null && (!Number.isFinite(draft.premium) || (draft.method === "REPLACE" && draft.premium < 0))) throw new Error("Nilai premi pengganti harus tidak negatif.");
  const {data: auth, error: authError} = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Sesi login tidak valid. Login kembali.");
  const {data,error} = await supabase.from("weekly_marketing_chart_overrides")
    .upsert({
      meeting_date: date, unit: draft.unit, business_type: draft.business_type,
      product: draft.product.trim(), status: draft.status, method: draft.method,
      cases: draft.cases, premium: draft.premium, reason: draft.reason.trim(),
      modified_by: auth.user.id, updated_at: new Date().toISOString()
    }, {onConflict: "meeting_date,unit,business_type,product,status"})
    .select("id,meeting_date,unit,business_type,product,status,method,cases,premium,reason").single();
  if (error || !data) throw new Error(error?.message || "Penyesuaian gagal disimpan.");
  return data as MasOverride;
};
export const removeMasOverride = async (id: string) => {
  const {error, count} = await supabase.from("weekly_marketing_chart_overrides")
    .delete({count: "exact"}).eq("id", id);
  if (error || count !== 1) throw new Error(error?.message || "Penyesuaian tidak ditemukan atau akses ditolak.");
};

export type MasResetResult = {
  meeting_date: string;
  upload_versions_deleted: number;
  manual_adjustments_deleted: number;
};

/** Permanently clear only the selected weekly period's CHART data.
 * Atomic RPC with server-side Marketing Administration RLS checks.
 */
export const resetMasPeriod = async (meetingDate: string): Promise<MasResetResult> => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meetingDate)) {
    throw new Error("Tanggal meeting tidak valid.");
  }
  const { data, error } = await supabase.rpc("reset_weekly_marketing_chart", {
    p_meeting_date: meetingDate
  });
  if (error) throw new Error(error.message);
  if (!data || data.meeting_date !== meetingDate) {
    throw new Error("Konfirmasi reset dari server tidak sesuai tanggal laporan.");
  }
  return data as MasResetResult;
};
