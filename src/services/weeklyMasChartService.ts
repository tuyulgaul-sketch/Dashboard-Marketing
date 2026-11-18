import { supabase } from "@/lib/supabase";
import { readWeeklyRevision, type ChartSnapshot, type WeeklyRevision } from "@/services/weeklyReportVersionService";
import type { MasBucket, MasMeta, MasOverride, MasSourceDetail, MasStatus, MasUnit, MasSegment } from "@/utils/weeklyMasChartEngine";

export type MasUpload = {
  id: string;
  meeting_date: string;
  source_filename: string;
  aggregates: MasBucket[];
  details_count: number;
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
      .select("id,meeting_date,source_filename,aggregates,details_count,parse_meta,created_at")
      .eq("meeting_date", meetingDate).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("weekly_marketing_chart_overrides")
      .select("id,meeting_date,unit,business_type,product,status,method,cases,premium,reason")
      .eq("meeting_date", meetingDate).order("product", { ascending: true })
  ]);
  if (uploadResult.error) throw new Error("Gagal membaca data CHART: " + uploadResult.error.message);
  if (manualResult.error) throw new Error("Gagal membaca penyesuaian manual: " + manualResult.error.message);
  return {upload: uploadResult.data as MasUpload | null, overrides: (manualResult.data || []) as MasOverride[]};
};

export const saveMasUpload = async (date: string, filename: string, buckets: MasBucket[], meta: MasMeta, details: MasSourceDetail[]): Promise<MasUpload> => {
  // Upload revisions are append-only. Each version stays available for an audit trail.
  const {data, error} = await supabase.from("weekly_marketing_chart_uploads")
    .insert({meeting_date: date, source_filename: filename, aggregates: buckets, parse_meta: meta, details, details_count: details.length})
    .select("id,meeting_date,source_filename,aggregates,details_count,parse_meta,created_at").single();
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


export type MasDetailFilter = {
  product?: string;
  unit?: MasUnit;
  segment?: MasSegment;
  status?: MasStatus;
};
export type MasDetailPage = {
  total: number;
  available: number;
  items: MasSourceDetail[];
};

/** Database filters and paginates the company-level quotation snapshot.
 * The RPC runs with the caller's RLS permissions: only active MS can read it.
 */
export const readMasQuotationDetails = async (
  uploadId: string,
  filter: MasDetailFilter,
  offset = 0,
  limit = 50
): Promise<MasDetailPage> => {
  const { data, error } = await supabase.rpc("get_weekly_marketing_chart_details", {
    p_upload_id: uploadId,
    p_product: filter.product || null,
    p_unit: filter.unit || null,
    p_segment: filter.segment || null,
    p_status: filter.status || null,
    p_offset: offset,
    p_limit: Math.min(100, Math.max(1, limit))
  });
  if (error) throw new Error(error.message);
  if (!data || !Array.isArray(data.items)) throw new Error("Daftar quotation tidak dapat dibaca.");
  return data as MasDetailPage;
};


/** Latest CHART snapshot valid as of a selected day, or a precise historical revision.
 * References stay immutable even when the current CHART is cleared/replaced.
 */
export const readMasVersion = async (
  asOfDate:string,cutoff?:number|null
):Promise<{upload:MasUpload|null;overrides:MasOverride[];revision:WeeklyRevision<ChartSnapshot>|null}>=>{
  const revision=await readWeeklyRevision<ChartSnapshot>("CHART",asOfDate,cutoff);
  const uploadId=revision?.payload?.upload_id;
  let upload:MasUpload|null=null;
  if(uploadId){
    const {data,error}=await supabase.from("weekly_marketing_chart_uploads")
      .select("id,meeting_date,source_filename,aggregates,details_count,parse_meta,created_at")
      .eq("id",uploadId).maybeSingle();
    if(error)throw new Error(error.message);
    if(!data)throw new Error("File sumber versi historis tidak ditemukan. Hubungi administrator.");
    upload=data as MasUpload;
  }
  return {upload,overrides:revision?.payload?.overrides||[],revision};
};
