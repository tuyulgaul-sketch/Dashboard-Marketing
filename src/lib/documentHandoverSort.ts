export interface SubmissionSortableHandover {
  id: string;
  submittedAt?: string | null;
}

/** Invalid or missing submission timestamps are unknown, not the handover date. */
export const getHandoverSubmissionTime = (value?: string | null): number | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

/** Latest actual submission first; unknown dates last. Never mutate the source. */
export function sortHandoversBySubmission<T extends SubmissionSortableHandover>(
  receipts: readonly T[],
): T[] {
  return [...receipts].sort((a, b) => {
    const first = getHandoverSubmissionTime(a.submittedAt);
    const second = getHandoverSubmissionTime(b.submittedAt);
    if (first === null && second !== null) return 1;
    if (second === null && first !== null) return -1;
    if (first !== null && second !== null && first !== second) return second - first;
    return a.id.localeCompare(b.id, 'id');
  });
}
