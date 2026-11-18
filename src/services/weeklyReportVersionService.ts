import { supabase } from "@/lib/supabase";
import type { InspireRow, InspireUnit } from "@/services/weeklyMarketingReviewService";
import type { MasOverride } from "@/utils/weeklyMasChartEngine";

export type WeeklyArea = InspireUnit | "CHART";
export type ChartSnapshot = { upload_id: string | null; overrides: MasOverride[] };
export type WeeklyRevision<T = unknown> = {
  id: string;
  revision_no: number;
  area: WeeklyArea;
  effective_date: string;
  payload: T;
  created_at: string;
  created_by: string | null;
  source: string;
};
export type VersionHeader = Omit<WeeklyRevision,"payload">;

export const emptyChartSnapshot = (): ChartSnapshot => ({upload_id:null,overrides:[]});

export async function readWeeklyRevision<T>(
  area: WeeklyArea, date: string, cutoff?: number | null
): Promise<WeeklyRevision<T> | null> {
  let query = supabase.from("weekly_marketing_revisions")
    .select("id,revision_no,area,effective_date,payload,created_at,created_by,source")
    .eq("area",area).lte("effective_date",date);
  if (cutoff !== undefined && cutoff !== null) query = query.lte("revision_no",cutoff);
  const {data,error} = await query
    .order("effective_date",{ascending:false})
    .order("revision_no",{ascending:false})
    .limit(1).maybeSingle();
  if(error)throw new Error(error.message);
  return data as WeeklyRevision<T> | null;
}

export async function readInspireVersions(
  date:string,cutoff?:number|null
):Promise<Record<InspireUnit,WeeklyRevision<InspireRow[]>|null>>{
  const areas:InspireUnit[]=["DA","MARCOMM","MAS"];
  const [da,marcomm,mas] = await Promise.all(areas.map(area=>readWeeklyRevision<InspireRow[]>(area,date,cutoff)));
  return {DA:da,MARCOMM:marcomm,MAS:mas};
}

export async function listWeeklyRevisions():Promise<VersionHeader[]>{
  // Fetch history metadata in pages; the 17 November baseline must remain
  // reachable after many years of weekly changes, not disappear after 300 saves.
  const all:VersionHeader[]=[];
  const size=500;
  for(let offset=0;offset<10000;offset+=size){
    const {data,error}=await supabase.from("weekly_marketing_revisions")
      .select("id,revision_no,area,effective_date,created_at,created_by,source")
      .order("revision_no",{ascending:false})
      .range(offset,offset+size-1);
    if(error)throw new Error(error.message);
    const page=(data||[]) as VersionHeader[];
    all.push(...page);
    if(page.length<size)break;
  }
  return all;
}

/** Append a new immutable version. On concurrent edits, the server rejects a stale expected ID. */
export async function saveWeeklyRevision<T>(
  area:WeeklyArea,date:string,payload:T,expectedId:string|null
):Promise<WeeklyRevision<T>>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error("Tanggal perubahan tidak valid.");
  const {data,error} = await supabase.rpc("save_weekly_marketing_revision",{
    p_area:area,p_effective_date:date,p_payload:payload,p_expected_id:expectedId
  });
  if(error)throw new Error(error.message);
  if(!data?.id)throw new Error("Konfirmasi versi baru dari server belum diterima.");
  return data as WeeklyRevision<T>;
}
