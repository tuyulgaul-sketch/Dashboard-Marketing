import { supabase } from "@/lib/supabase";

export type InspireUnit = "DA" | "MARCOMM" | "MAS";
export type InspireStatus = "On Progress" | "Done" | "Need Attention";
export type InspireRow = {
  id: string;
  unit: InspireUnit;
  title: string;
  rootCause: string;
  nextPlan: string;
  support: string;
  deliverable: string;
  rangeTime: string;
  status: InspireStatus;
};
export type InspireDraft = Omit<InspireRow, "id">;
type DbRow = {
  id: string;
  unit: InspireUnit;
  issue: string;
  root_cause: string | null;
  next_plan: string | null;
  support_for_solution: string | null;
  deliverable: string | null;
  range_time: string | null;
  status: InspireStatus;
};

const fields = "id,unit,issue,root_cause,next_plan,support_for_solution,deliverable,range_time,status";
const asRow = (row: DbRow): InspireRow => ({
  id: row.id,
  unit: row.unit,
  title: row.issue,
  rootCause: row.root_cause || "",
  nextPlan: row.next_plan || "",
  support: row.support_for_solution || "",
  deliverable: row.deliverable || "",
  rangeTime: row.range_time || "",
  status: row.status
});
const toDatabase = (draft: InspireDraft) => ({
  unit: draft.unit,
  issue: draft.title.trim(),
  root_cause: draft.rootCause.trim(),
  next_plan: draft.nextPlan.trim(),
  support_for_solution: draft.support.trim(),
  deliverable: draft.deliverable.trim(),
  range_time: draft.rangeTime.trim(),
  status: draft.status,
  updated_at: new Date().toISOString()
});

export const loadWeeklyInspireRows = async (meetingDate: string): Promise<InspireRow[]> => {
  const { data, error } = await supabase
    .from("weekly_marketing_actions")
    .select(fields)
    .eq("meeting_date", meetingDate)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map(row => asRow(row as DbRow));
};

export const saveWeeklyInspireRow = async (
  meetingDate: string,
  draft: InspireDraft,
  existingId?: string
): Promise<InspireRow> => {
  if (!draft.title.trim()) throw new Error("Kolom Apa (Issue) wajib diisi.");
  if (existingId) {
    const { data, error } = await supabase
      .from("weekly_marketing_actions")
      .update(toDatabase(draft))
      .eq("id", existingId)
      .eq("meeting_date", meetingDate)
      .select(fields)
      .single();
    if (error || !data) throw new Error(error?.message || "Baris tidak ditemukan atau tidak dapat diubah.");
    return asRow(data as DbRow);
  }
  const { data, error } = await supabase
    .from("weekly_marketing_actions")
    .insert({ ...toDatabase(draft), meeting_date: meetingDate })
    .select(fields)
    .single();
  if (error || !data) throw new Error(error?.message || "Baris gagal disimpan.");
  return asRow(data as DbRow);
};

export const deleteWeeklyInspireRow = async (meetingDate: string, id: string): Promise<void> => {
  const { error, count } = await supabase
    .from("weekly_marketing_actions")
    .delete({ count: "exact" })
    .eq("meeting_date", meetingDate)
    .eq("id", id);
  if (error || count !== 1) throw new Error(error?.message || "Baris tidak ditemukan atau akses ditolak.");
};

/** Persist a complete unit's row order atomically; RLS limits writers to their own unit. */
export const reorderWeeklyInspireRows = async (
  meetingDate: string,
  unit: InspireUnit,
  rowIds: string[]
): Promise<void> => {
  if (new Set(rowIds).size !== rowIds.length || rowIds.length === 0) {
    throw new Error("Daftar urutan baris tidak valid.");
  }
  const { data, error } = await supabase.rpc("reorder_weekly_marketing_actions", {
    p_meeting_date: meetingDate,
    p_unit: unit,
    p_row_ids: rowIds
  });
  if (error) throw new Error(error.message);
  if (data !== rowIds.length) throw new Error("Jumlah baris yang diperbarui tidak sesuai.");
};
