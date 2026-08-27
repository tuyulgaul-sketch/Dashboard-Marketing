import { supabase } from "@/lib/supabase";

export type ActivityCategory =
  | "CUSTOMER_EXTERNAL"
  | "INTERNAL_COORDINATION"
  | "FOLLOW_UP"
  | "MEETING"
  | "PROJECT_DEVELOPMENT"
  | "ADMINISTRATION"
  | "DOCUMENT_REPORTING"
  | "MARKETING_COMMUNICATION"
  | "TENDER_PROPOSAL"
  | "MONITORING_REVIEW"
  | "OTHER";

export type ActivityPriority =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "URGENT";

export type UniversalActivityStatus =
  | "DRAFT"
  | "TO_DO"
  | "ON_PROGRESS"
  | "WAITING_FOLLOW_UP"
  | "NEED_SUPPORT"
  | "PENDING_VALIDATION"
  | "DONE"
  | "CANCELLED";

export type DirectoryProfile = {
  id: string;
  full_name: string;
  role_level: string;
  unit: string;
  manager_id: string | null;
};

export type UniversalActivity = {
  id: string;
  title: string;
  category: ActivityCategory;
  description: string | null;
  result: string | null;
  next_action: string | null;
  activity_date: string;
  start_time: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: ActivityPriority;
  status: UniversalActivityStatus;
  progress: number;
  owner_profile_id: string;
  created_by_profile_id: string;
  company_name: string | null;
  person_met: string | null;
  position_met: string | null;
  product_name: string | null;
  related_pipeline_id: string | null;
  potential_premium: number | null;
  interaction_method: string | null;
  validation_approver_profile_id: string | null;
  validation_submitted_at: string | null;
  validated_at: string | null;
  validation_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateActivityInput = {
  title: string;
  category: ActivityCategory;
  description?: string;
  next_action?: string;
  activity_date: string;
  start_time?: string;
  due_date?: string;
  due_time?: string;
  priority: ActivityPriority;
  owner_profile_id: string;
  company_name?: string;
  person_met?: string;
  position_met?: string;
  product_name?: string;
  related_pipeline_id?: string;
  potential_premium?: number | null;
  interaction_method?: string;
  collaborator_ids?: string[];
};

export async function getActivityDirectory() {
  const { data, error } =
    await supabase.rpc("get_profile_directory");

  if (error) throw error;

  return (data || []) as DirectoryProfile[];
}

export async function getUniversalActivities() {
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []) as UniversalActivity[];
}

export async function createUniversalActivity(
  input: CreateActivityInput,
  currentProfileId: string
) {
  const collaboratorIds = Array.from(
    new Set(input.collaborator_ids || [])
  ).filter((id) => id && id !== input.owner_profile_id);

  const { data, error } = await supabase
    .from("activities")
    .insert({
      title: input.title.trim(),
      category: input.category,
      description: input.description?.trim() || null,
      next_action: input.next_action?.trim() || null,
      activity_date: input.activity_date,
      start_time: input.start_time || null,
      due_date: input.due_date || null,
      due_time: input.due_time || null,
      priority: input.priority,
      status: "TO_DO",
      progress: 0,
      owner_profile_id: input.owner_profile_id,
      created_by_profile_id: currentProfileId,
      company_name: input.company_name?.trim() || null,
      person_met: input.person_met?.trim() || null,
      position_met: input.position_met?.trim() || null,
      product_name: input.product_name?.trim() || null,
      related_pipeline_id: input.related_pipeline_id?.trim() || null,
      potential_premium: input.potential_premium ?? null,
      interaction_method: input.interaction_method?.trim() || null,
    })
    .select("*")
    .single();

  if (error) throw error;

  const activity = data as UniversalActivity;

  if (collaboratorIds.length > 0) {
    const { error: collaboratorError } = await supabase
      .from("activity_collaborators")
      .insert(
        collaboratorIds.map((profileId) => ({
          activity_id: activity.id,
          profile_id: profileId,
          can_edit: true,
          added_by_profile_id: currentProfileId,
        }))
      );

    if (collaboratorError) throw collaboratorError;
  }

  return activity;
}

export async function updateUniversalActivityStatus(
  activityId: string,
  status: Exclude<
    UniversalActivityStatus,
    "PENDING_VALIDATION" | "DONE"
  >
) {
  const progress =
    status === "ON_PROGRESS"
      ? 25
      : status === "CANCELLED"
      ? 0
      : undefined;

  const payload: Record<string, unknown> = { status };

  if (progress !== undefined) {
    payload.progress = progress;
  }

  const { data, error } = await supabase
    .from("activities")
    .update(payload)
    .eq("id", activityId)
    .select("*")
    .single();

  if (error) throw error;

  return data as UniversalActivity;
}

export async function submitUniversalActivityForValidation(
  activityId: string
) {
  const { data, error } = await supabase.rpc(
    "submit_activity_for_validation",
    { p_activity_id: activityId }
  );

  if (error) throw error;

  return data as UniversalActivity;
}

export async function reviewUniversalActivityValidation(
  activityId: string,
  approve: boolean,
  notes?: string
) {
  const { data, error } = await supabase.rpc(
    "review_activity_validation",
    {
      p_activity_id: activityId,
      p_approve: approve,
      p_notes: notes || null,
    }
  );

  if (error) throw error;

  return data as UniversalActivity;
}
