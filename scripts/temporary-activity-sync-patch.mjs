import fs from "node:fs";

const path = "src/pages/AktivitasUniversalPage.tsx";
let source = fs.readFileSync(path, "utf8");

const replaceOnce = (label, before, after) => {
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly 1 match, found ${count}`);
  }
  source = source.replace(before, after);
};

replaceOnce(
  "detail ref",
  `  const deepLinkHandledRef = useRef<string | null>(null);\n  const directoryFetchedAtRef = useRef(0);\n  const [unseenCountByActivityId, setUnseenCountByActivityId] =`,
  `  const deepLinkHandledRef = useRef<string | null>(null);\n  const directoryFetchedAtRef = useRef(0);\n  const detailRef = useRef<ActivityDetailPayload | null>(null);\n  const [unseenCountByActivityId, setUnseenCountByActivityId] =`
);

replaceOnce(
  "detail ref synchronization",
  `  const [workspaceSection, setWorkspaceSection] =\n    useState<\"WORKSPACE\" | \"MONITORING\">(\"WORKSPACE\");\n\n  const profileMap = useMemo(`,
  `  const [workspaceSection, setWorkspaceSection] =\n    useState<\"WORKSPACE\" | \"MONITORING\">(\"WORKSPACE\");\n\n  useEffect(() => {\n    detailRef.current = detail;\n  }, [detail]);\n\n  const profileMap = useMemo(`
);

replaceOnce(
  "refresh active detail id",
  `  const refresh = async (options?: { silent?: boolean }) => {\n    const silent = Boolean(options?.silent);\n\n    if (!silent) {`,
  `  const refresh = async (options?: { silent?: boolean }) => {\n    const silent = Boolean(options?.silent);\n    const activeDetailId = detailRef.current?.activity.id || null;\n\n    if (!silent) {`
);

replaceOnce(
  "refresh tuple",
  `        actionRoleRows,\n        attentionRows,\n        discussionAttentionRows,\n      ] = await Promise.all([`,
  `        actionRoleRows,\n        attentionRows,\n        discussionAttentionRows,\n        liveDetailRows,\n      ] = await Promise.all([`
);

replaceOnce(
  "refresh detail promise",
  `        getMyActivityActionRoles(),\n        getMyActivityAttention(profile?.id || \"\"),\n        getMyActivityDiscussionAttention(profile?.id || \"\"),\n      ]);`,
  `        getMyActivityActionRoles(),\n        getMyActivityAttention(profile?.id || \"\"),\n        getMyActivityDiscussionAttention(profile?.id || \"\"),\n        activeDetailId\n          ? getUniversalActivityDetail(activeDetailId).catch((detailError) => {\n              console.warn(\n                \"Gagal menyinkronkan detail aktivitas aktif:\",\n                detailError\n              );\n              return null;\n            })\n          : Promise.resolve<ActivityDetailPayload | null>(null),\n      ]);`
);

replaceOnce(
  "apply refreshed detail",
  `      setActionRoleByActivityId(\n        actionRoleRows.reduce<\n          Record<string, ActivityActionRole>\n        >((result, row) => {\n          result[row.activity_id] =\n            row.action_role;\n          return result;\n        }, {})\n      );\n\n      setError(\"\");`,
  `      setActionRoleByActivityId(\n        actionRoleRows.reduce<\n          Record<string, ActivityActionRole>\n        >((result, row) => {\n          result[row.activity_id] =\n            row.action_role;\n          return result;\n        }, {})\n      );\n\n      if (\n        liveDetailRows &&\n        detailRef.current?.activity.id === activeDetailId\n      ) {\n        detailRef.current = liveDetailRows;\n        setDetail(liveDetailRows);\n        setProgressValue(liveDetailRows.activity.progress);\n      }\n\n      setError(\"\");`
);

fs.writeFileSync(path, source);
console.log("Targeted Activity sync patch applied successfully.");
