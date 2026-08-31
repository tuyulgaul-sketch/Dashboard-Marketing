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

export type ActivityActionRole =
  | "OWNER"
  | "COLLABORATOR"
  | "FOLLOW_UP"
  | "SUPPORT"
  | "APPROVER"
  | "CREATOR";

export type ActivityTransitionPayload = {
  note?: string;
  next_action?: string;
  follow_up_date?: string;
  result?: string;
  collaborator_ids?: string[];
};

export type ActivityActionRoleRow = {
  activity_id: string;
  action_role: ActivityActionRole;
};

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
  status_note: string | null;
  follow_up_date: string | null;
  created_at: string;
  updated_at: string;
};

const ACTIVITY_PRIORITY_WEIGHT: Record<ActivityPriority, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
};

export function compareUniversalActivities(
  a: UniversalActivity,
  b: UniversalActivity
) {
  const priorityDelta =
    ACTIVITY_PRIORITY_WEIGHT[b.priority] -
    ACTIVITY_PRIORITY_WEIGHT[a.priority];

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const aDue = a.due_date || "9999-12-31";
  const bDue = b.due_date || "9999-12-31";

  if (aDue !== bDue) {
    return aDue.localeCompare(bDue);
  }

  const updatedDelta =
    new Date(b.updated_at).getTime() -
    new Date(a.updated_at).getTime();

  if (updatedDelta !== 0) {
    return updatedDelta;
  }

  return (
    new Date(b.created_at).getTime() -
    new Date(a.created_at).getTime()
  );
}

export type CreateActivityInput = {
  activity_mode: ActivityMode;
  initial_status?: "DRAFT" | "TO_DO";
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

export type ActivityAttachmentDetail = {
  id: string;
  activity_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  file_size: number;
  uploaded_by_profile_id: string;
  uploaded_by_name: string;
  created_at: string;
};

export type ActivityDetailPayload = {
  activity: UniversalActivity;
  can_edit: boolean;
  owner: ActivityDetailPerson;
  created_by: ActivityDetailPerson;
  validation_approver: ActivityDetailPerson | null;
  collaborators: ActivityCollaboratorDetail[];
  attachments: ActivityAttachmentDetail[];
  comments: ActivityCommentDetail[];
  history: ActivityHistoryDetail[];
};

async function flushNotificationEmailOutboxBestEffort() {
  try {
    const { error } = await supabase.functions.invoke(
      "notification-email-dispatcher",
      {
        body: {
          action: "dispatch",
          source: "activity",
        },
      }
    );

    if (error) {
      console.warn(
        "Email notification dispatcher belum berhasil dipanggil:",
        error
      );
    }
  } catch (error) {
    console.warn(
      "Email notification dispatcher tidak tersedia:",
      error
    );
  }
}

async function generateDueNotificationsBestEffort() {
  try {
    const { error } = await supabase.rpc(
      "generate_activity_due_notifications"
    );

    if (error) {
      console.warn(
        "Generator due/overdue notification belum tersedia:",
        error
      );
      return;
    }

    void flushNotificationEmailOutboxBestEffort();
  } catch (error) {
    console.warn(
      "Generator due/overdue notification gagal:",
      error
    );
  }
}

export async function getMyActivityActionRoles() {
  const { data, error } = await supabase.rpc(
    "get_my_activity_action_roles"
  );

  if (error) throw error;

  return (data || []) as ActivityActionRoleRow[];
}

export async function transitionUniversalActivity(
  activityId: string,
  targetStatus: UniversalActivityStatus,
  payload: ActivityTransitionPayload = {}
) {
  const { data, error } = await supabase.rpc(
    "transition_activity_vnext",
    {
      p_activity_id: activityId,
      p_target_status: targetStatus,
      p_payload: {
        ...payload,
        collaborator_ids: Array.from(
          new Set(payload.collaborator_ids || [])
        ),
      },
    }
  );

  if (error) throw error;

  void flushNotificationEmailOutboxBestEffort();

  return data as UniversalActivity;
}

export async function getActivityDirectory() {
  const { data, error } =
    await supabase.rpc("get_profile_directory");

  if (error) throw error;

  return (data || []) as DirectoryProfile[];
}

export async function getUniversalActivities() {
  void generateDueNotificationsBestEffort();

  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  return ((data || []) as UniversalActivity[]).sort(
    compareUniversalActivities
  );
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

  void flushNotificationEmailOutboxBestEffort();

  return data as UniversalActivity;
}

export async function updateUniversalActivityStatus(
  activityId: string,
  status: Exclude<
    UniversalActivityStatus,
    "PENDING_VALIDATION" | "DONE"
  >
) {
  return transitionUniversalActivity(
    activityId,
    status,
    {}
  );
}

export async function submitUniversalActivityForValidation(
  activityId: string,
  result?: string
) {
  return transitionUniversalActivity(
    activityId,
    "PENDING_VALIDATION",
    {
      result: result || "",
    }
  );
}

export async function reviewUniversalActivityValidation(
  activityId: string,
  approve: boolean,
  notes?: string
) {
  return transitionUniversalActivity(
    activityId,
    approve ? "DONE" : "ON_PROGRESS",
    {
      note: notes || "",
    }
  );
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


const ACTIVITY_ATTACHMENT_BUCKET = "activity-attachments";
const MAX_ACTIVITY_ATTACHMENT_SIZE = 10 * 1024 * 1024;

const ALLOWED_ACTIVITY_ATTACHMENT_EXTENSIONS = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "txt",
  "csv",
  "zip",
]);

function sanitizeAttachmentFileName(fileName: string) {
  const cleaned = fileName
    .replace(/[^\w.\-() ]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 140);

  return cleaned || "attachment";
}

export async function updateUniversalActivityProgress(
  activityId: string,
  progress: number
) {
  const { data, error } = await supabase.rpc(
    "update_activity_progress",
    {
      p_activity_id: activityId,
      p_progress: progress,
    }
  );

  if (error) throw error;

  return data as UniversalActivity;
}

export async function uploadUniversalActivityAttachment(
  activityId: string,
  file: File
) {
  if (file.size <= 0) {
    throw new Error("File kosong tidak dapat diunggah.");
  }

  if (file.size > MAX_ACTIVITY_ATTACHMENT_SIZE) {
    throw new Error("Ukuran file maksimal 10 MB.");
  }

  const extension =
    file.name.split(".").pop()?.toLowerCase() || "";

  if (
    extension &&
    !ALLOWED_ACTIVITY_ATTACHMENT_EXTENSIONS.has(extension)
  ) {
    throw new Error(
      "Tipe file belum diizinkan. Gunakan PDF, image, Office document, TXT/CSV, atau ZIP."
    );
  }

  const safeName = sanitizeAttachmentFileName(file.name);

  const storagePath =
    `${activityId}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(ACTIVITY_ATTACHMENT_BUCKET)
    .upload(storagePath, file, {
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) throw uploadError;

  const { data, error: registerError } = await supabase.rpc(
    "register_activity_attachment",
    {
      p_activity_id: activityId,
      p_storage_path: storagePath,
      p_file_name: file.name,
      p_mime_type: file.type || null,
      p_file_size: file.size,
    }
  );

  if (registerError) {
    await supabase.storage
      .from(ACTIVITY_ATTACHMENT_BUCKET)
      .remove([storagePath]);

    throw registerError;
  }

  return data as ActivityAttachmentDetail;
}

export async function getUniversalActivityAttachmentUrl(
  storagePath: string
) {
  const { data, error } = await supabase.storage
    .from(ACTIVITY_ATTACHMENT_BUCKET)
    .createSignedUrl(storagePath, 60);

  if (error) throw error;

  return data.signedUrl;
}

export async function deleteUniversalActivityAttachment(
  attachmentId: string
) {
  const { data, error } = await supabase.rpc(
    "delete_activity_attachment_metadata",
    {
      p_attachment_id: attachmentId,
    }
  );

  if (error) throw error;

  const storagePath = data?.storage_path as string | undefined;

  if (storagePath) {
    const { error: removeError } = await supabase.storage
      .from(ACTIVITY_ATTACHMENT_BUCKET)
      .remove([storagePath]);

    if (removeError) {
      console.warn(
        "Metadata lampiran terhapus, tetapi cleanup storage gagal:",
        removeError
      );
    }
  }

  return data as {
    storage_path: string;
    file_name: string;
  };
}
