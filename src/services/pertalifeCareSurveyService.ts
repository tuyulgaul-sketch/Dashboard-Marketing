import { supabase } from "@/lib/supabase";
import type { UniversalActivityStatus } from "@/services/activityService";

export type PertaLifeCareSurveyResponse = {
  id: string;
  sourceKey: string;
  sourceRow: number | null;
  submittedAt: string;
  respondentName: string;
  memberId: string | null;
  deviceType: string | null;
  osName: string | null;
  selectedProblemFeature: string | null;
  satisfactionScore: number | null;
  contactable: boolean;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PertaLifeCareSurveyIssue = {
  id: string;
  responseId: string;
  featureKey: string;
  featureLabel: string;
  issueDetail: string | null;
  evidenceUrl: string | null;
  linkedActivityId: string | null;
  active: boolean;
  activityReferenceNo: string | null;
  activityTitle: string | null;
  activityStatus: UniversalActivityStatus | null;
  activityPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | null;
  activityOwnerId: string | null;
  activityOwnerName: string | null;
  activityResult: string | null;
  activityUpdatedAt: string | null;
};

export type PertaLifeCareSurveyTask = {
  id: string;
  referenceNo: string | null;
  title: string;
  description: string | null;
  status: UniversalActivityStatus;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  ownerProfileId: string;
  ownerName: string;
  result: string | null;
  createdAt: string;
  updatedAt: string;
  linkedIssueCount: number;
  linkedResponseCount: number;
  featureKeys: string[];
  featureLabels: string[];
};

export type PertaLifeCareSurveyDashboard = {
  responses: PertaLifeCareSurveyResponse[];
  issues: PertaLifeCareSurveyIssue[];
  tasks: PertaLifeCareSurveyTask[];
};

const emptyDashboard: PertaLifeCareSurveyDashboard = {
  responses: [],
  issues: [],
  tasks: [],
};

export async function getPertaLifeCareSurveyDashboard(): Promise<PertaLifeCareSurveyDashboard> {
  const { data, error } = await supabase.rpc("list_pertalife_care_survey_v1");
  if (error) throw error;
  if (!data || typeof data !== "object") return emptyDashboard;

  const payload = data as Partial<PertaLifeCareSurveyDashboard>;
  return {
    responses: Array.isArray(payload.responses) ? payload.responses : [],
    issues: Array.isArray(payload.issues) ? payload.issues : [],
    tasks: Array.isArray(payload.tasks) ? payload.tasks : [],
  };
}

export async function createPertaLifeCareSurveyActivity(input: {
  issueId: string;
  title: string;
  dueDate?: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}) {
  const { data, error } = await supabase.rpc(
    "create_pertalife_care_followup_activity_v1",
    {
      p_issue_id: input.issueId,
      p_title: input.title,
      p_due_date: input.dueDate || null,
      p_priority: input.priority,
    },
  );
  if (error) throw error;
  return data as {
    issueId: string;
    activityId: string;
    referenceNo: string;
    status: UniversalActivityStatus;
  };
}

export async function linkPertaLifeCareIssueToActivity(
  issueId: string,
  activityId: string,
) {
  const { data, error } = await supabase.rpc(
    "link_pertalife_care_issue_activity_v1",
    {
      p_issue_id: issueId,
      p_activity_id: activityId,
    },
  );
  if (error) throw error;
  return data as {
    issueId: string;
    activityId: string;
    referenceNo: string | null;
    status: UniversalActivityStatus;
  };
}
