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

export type ActivityMode =
  | "PERSONAL"
  | "ASSIGNMENT"
  | "COLLABORATION";

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
  department: string | null;
  manager_id: string | null;
};

export type UniversalActivity = {
  id: string;
  activity_mode: ActivityMode;
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
  activity_mode: ActivityMode;
  title: string;
  category: ActivityCategory;
  description?: string;
  next_action?: string;
  activity_date: string;
  due_date?: string;
  priority: ActivityPriority;
  owner_profile_id?: string;
  company_name?: string;
  person_met?: string;
  position_met?: string;
  product_name?: string;
  related_pipeline_id?: string;
  potential_premium?: number | null;
  interaction_method?: string;
  collaborator_ids?: string[];
};

export type ActivityDetailPerson = {
  id: string;
  full_name: string;
  role_level: string;
  unit: string;
  department: string | null;
};

export type ActivityCollaboratorDetail = {
  profile_id: string;
  full_name: string;
  role_level: string;
  unit: string;
  department: string | null;
  can_edit: boolean;
  created_at: string;
};

export type ActivityCommentDetail = {
  id: string;
  body: string;
  created_by_profile_id: string;
  author_name: string;
  author_role: string;
  author_unit: string;
  author_department: string | null;
  created_at: string;
};

export type ActivityHistoryDetail = {
  id: string;
  actor_profile_id: string | null;
  actor_name: string;
  actor_role: string | null;
  action: string;
  old_status: string | null;
  new_status: string | null;
  notes: string | null;
  created_at: string;
};

export type ActivityDetailPayload = {
  activity: UniversalActivity;
  owner: ActivityDetailPerson;
  created_by: ActivityDetailPerson;
  validation_approver: ActivityDetailPerson | null;
  collaborators: ActivityCollaboratorDetail[];
  comments: ActivityCommentDetail[];
  history: ActivityHistoryDetail[];
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
  input: CreateActivityInput
) {
  const { data, error } = await supabase.rpc(
    "create_universal_activity",
    {
      p_payload: {
        ...input,
        collaborator_ids: Array.from(
          new Set(input.collaborator_ids || [])
        ),
      },
    }
  );

  if (error) throw error;

  return data as UniversalActivity;
}

export async function updateUniversalActivityStatus(
  activityId: string,
  status: Exclude<
    UniversalActivityStatus,
    "PENDING_VALIDATION" | "DONE"
  >
) {
  const { data, error } = await supabase.rpc(
    "update_universal_activity_status",
    {
      p_activity_id: activityId,
      p_status: status,
    }
  );

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

export async function getUniversalActivityDetail(
  activityId: string
) {
  const { data, error } = await supabase.rpc(
    "get_activity_detail",
    {
      p_activity_id: activityId,
    }
  );

  if (error) throw error;

  return data as ActivityDetailPayload;
}

export async function addUniversalActivityComment(
  activityId: string,
  body: string
) {
  const { data, error } = await supabase.rpc(
    "add_activity_comment",
    {
      p_activity_id: activityId,
      p_body: body,
    }
  );

  if (error) throw error;

  return data as ActivityCommentDetail;
}
