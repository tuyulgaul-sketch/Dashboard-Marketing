import fs from "node:fs";

const replaceOnce = (source, label, before, after) => {
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly 1 match, found ${count}`);
  }
  return source.replace(before, after);
};

// 1) Every non-admin business account can read the complete Tanda Terima registry.
const handoverPath = "src/services/documentHandoverV14Service.ts";
let handover = fs.readFileSync(handoverPath, "utf8");
const oldVisibility = `export const getVisibleDocumentHandoversV14 = (\n  user: User = store.getCurrentUser()\n): V14DocumentHandover[] => {\n  if (user.role === "SYSTEM_ADMIN") {\n    return [];\n  }\n\n  const records = getRecords();\n\n  if (\n    user.role === "TEAM_LEADER_MARKETING_SUPPORT" ||\n    user.role === "DEPARTMENT_HEAD_MARKETING_ADMINISTRATION" ||\n    user.role === "SUPERVISOR_MARKETING_ADMINISTRATION"\n  ) {\n    return records;\n  }\n\n  const scopedIds =\n    new Set(\n      store.getSubordinateUserIds(\n        user.id\n      )\n    );\n\n  return records.filter(\n    receipt =>\n      scopedIds.has(\n        receipt.senderUserId\n      ) ||\n      scopedIds.has(\n        receipt.receiverUserId\n      )\n  );\n};`;
const newVisibility = `export const getVisibleDocumentHandoversV14 = (\n  user: User = store.getCurrentUser()\n): V14DocumentHandover[] => {\n  if (user.role === "SYSTEM_ADMIN") {\n    return [];\n  }\n\n  return getRecords();\n};`;
handover = replaceOnce(
  handover,
  "global Tanda Terima registry visibility",
  oldVisibility,
  newVisibility
);
fs.writeFileSync(handoverPath, handover);

// 2) Picker dropdowns must always open below their trigger.
const selectPath = "src/components/ui/select.tsx";
let selectSource = fs.readFileSync(selectPath, "utf8");
const selectPattern = /      position=\{position\}(\r?\n)      \{\.\.\.props\}\1/;
const match = selectSource.match(selectPattern);
if (!match) {
  throw new Error("SelectContent position props: expected exactly 1 match, found 0");
}
if ((selectSource.match(selectPattern) || []).length === 0) {
  throw new Error("SelectContent position props not found");
}
const eol = match[1];
selectSource = selectSource.replace(
  selectPattern,
  `      position={position}${eol}      {...props}${eol}      side="bottom"${eol}      avoidCollisions={false}${eol}`
);
fs.writeFileSync(selectPath, selectSource);

console.log("V22 targeted frontend patch applied successfully.");
