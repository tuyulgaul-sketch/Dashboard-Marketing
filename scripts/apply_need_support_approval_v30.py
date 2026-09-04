from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


service_path = Path("src/services/activityService.ts")
service = service_path.read_text()

service = replace_once(
    service,
    '  status_note: string | null;\n  follow_up_date: string | null;\n',
    '  status_note: string | null;\n  follow_up_date: string | null;\n  support_approval_status: "PENDING" | "APPROVED" | "REJECTED" | null;\n  support_approval_total: number;\n  support_approval_approved: number;\n',
    "UniversalActivity support fields",
)

service = replace_once(
    service,
    'export type ActivityCommentMention = {\n',
    '''export type ActivitySupportApprovalDetail = {\n  profile_id: string;\n  full_name: string;\n  role_level: string;\n  unit: string;\n  department: string | null;\n  decision_status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";\n  decision_note: string | null;\n  requested_at: string;\n  decided_at: string | null;\n};\n\nexport type ActivityCommentMention = {\n''',
    "support approval detail type",
)

service = replace_once(
    service,
    '  collaborators: ActivityCollaboratorDetail[];\n  attachments: ActivityAttachmentDetail[];\n',
    '  collaborators: ActivityCollaboratorDetail[];\n  support_approvals: ActivitySupportApprovalDetail[];\n  attachments: ActivityAttachmentDetail[];\n',
    "detail payload support approvals",
)

review_anchor = '''export async function getActivityDirectory() {\n'''
review_functions = '''export async function getActivitySupportApprovalsV30(\n  activityId: string\n) {\n  const { data, error } = await supabase.rpc(\n    "list_activity_support_approvals_v30",\n    {\n      p_activity_id: activityId,\n    }\n  );\n\n  if (error) throw error;\n\n  return (data || []) as ActivitySupportApprovalDetail[];\n}\n\nexport async function reviewPersonalTaskSupportV30(\n  activityId: string,\n  decision: "APPROVE" | "REJECT",\n  note = ""\n) {\n  const { data, error } = await supabase.rpc(\n    "review_personal_task_support_v30",\n    {\n      p_activity_id: activityId,\n      p_decision: decision,\n      p_note: note || null,\n    }\n  );\n\n  if (error) throw error;\n\n  void flushNotificationEmailOutboxBestEffort();\n\n  return data as UniversalActivity;\n}\n\nexport async function getActivityDirectory() {\n'''
service = replace_once(service, review_anchor, review_functions, "support service RPCs")

old_detail_tail = '''  try {\n    detail.comments =\n      await getActivityDiscussionV2(\n        activityId\n      );\n  } catch (discussionError) {\n    console.warn(\n      "Comment V2 belum tersedia; menggunakan discussion legacy.",\n      discussionError\n    );\n  }\n\n  return detail;\n}\n'''
new_detail_tail = '''  try {\n    detail.comments =\n      await getActivityDiscussionV2(\n        activityId\n      );\n  } catch (discussionError) {\n    console.warn(\n      "Comment V2 belum tersedia; menggunakan discussion legacy.",\n      discussionError\n    );\n  }\n\n  try {\n    detail.support_approvals =\n      await getActivitySupportApprovalsV30(\n        activityId\n      );\n  } catch (supportApprovalError) {\n    // Backward-compatible while V30 migration is rolling out.\n    detail.support_approvals = [];\n    console.warn(\n      "Need Support Approval V30 belum tersedia.",\n      supportApprovalError\n    );\n  }\n\n  return detail;\n}\n'''
service = replace_once(service, old_detail_tail, new_detail_tail, "detail approval hydrate")
service_path.write_text(service)

page_path = Path("src/pages/AktivitasUniversalPage.tsx")
page = page_path.read_text()

page = replace_once(
    page,
    'import ActivityDiscussionV2 from "@/components/activity/ActivityDiscussionV2";\n',
    'import ActivityDiscussionV2 from "@/components/activity/ActivityDiscussionV2";\nimport ActivitySupportApprovalPanel from "@/components/activity/ActivitySupportApprovalPanel";\n',
    "support panel import",
)

page = replace_once(
    page,
    '''  const personal =\n    isPersonalActivity(activity);\n\n  switch (activity.status) {\n''',
    '''  const personal =\n    isPersonalActivity(activity);\n\n  const personalCanComplete =\n    personal &&\n    !["PENDING", "REJECTED"].includes(\n      activity.support_approval_status || ""\n    );\n\n  if (\n    personal &&\n    activity.status === "NEED_SUPPORT" &&\n    activity.support_approval_status === "PENDING"\n  ) {\n    return ["CANCELLED"];\n  }\n\n  switch (activity.status) {\n''',
    "personal support completion guard",
)

page = page.replace(
    '...(personal ? ["DONE" as const] : []),',
    '...(personalCanComplete ? ["DONE" as const] : []),',
)

page = replace_once(
    page,
    '''        personal\n          ? "DONE"\n          : "PENDING_VALIDATION",\n''',
    '''        ...(personalCanComplete\n          ? ["DONE" as const]\n          : personal\n          ? []\n          : ["PENDING_VALIDATION" as const]),\n''',
    "on progress personal done target",
)

page = replace_once(
    page,
    '''  const orgScopedActivities = useMemo(\n    () =>\n      workspaceOwnerFilterIds\n        ? periodFilteredActivities.filter((activity) =>\n            workspaceOwnerFilterIds.has(activity.owner_profile_id)\n          )\n        : periodFilteredActivities,\n    [periodFilteredActivities, workspaceOwnerFilterIds]\n  );\n''',
    '''  const orgScopedActivities = useMemo(\n    () =>\n      workspaceOwnerFilterIds\n        ? periodFilteredActivities.filter(\n            (activity) =>\n              workspaceOwnerFilterIds.has(activity.owner_profile_id) ||\n              Boolean(actionRoleByActivityId[activity.id])\n          )\n        : periodFilteredActivities,\n    [\n      actionRoleByActivityId,\n      periodFilteredActivities,\n      workspaceOwnerFilterIds,\n    ]\n  );\n''',
    "cross workspace action visibility",
)

page = replace_once(
    page,
    '      if (scope === "TEAM") {\n        const isHierarchyTeamMember =\n',
    '      if (scope === "TEAM" && !actionRoleByActivityId[activity.id]) {\n        const isHierarchyTeamMember =\n',
    "team scope action visibility",
)

page = replace_once(
    page,
    '  SUPPORT: "Support Requested",\n',
    '  SUPPORT: "Need Support — Awaiting Your Approval",\n',
    "support action role label",
)

owner_block = '''                  {actionRoleByActivityId[detail.activity.id] === "OWNER" &&\n'''
panel_block = '''                  <ActivitySupportApprovalPanel\n                    detail={detail}\n                    actionRole={\n                      actionRoleByActivityId[detail.activity.id]\n                    }\n                    onChanged={async () => {\n                      await refresh({ silent: true });\n                      const refreshed =\n                        await getUniversalActivityDetail(\n                          detail.activity.id\n                        );\n                      setDetail(refreshed);\n                    }}\n                  />\n\n                  {actionRoleByActivityId[detail.activity.id] === "OWNER" &&\n'''
page = replace_once(page, owner_block, panel_block, "detail support approval panel")

page_path.write_text(page)

print("V30 frontend patches applied")
