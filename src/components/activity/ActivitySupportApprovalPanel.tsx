import React, { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  ActivityActionRole,
  ActivityDetailPayload,
  reviewPersonalTaskSupportV30,
} from "@/services/activityService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  Clock3,
  ShieldCheck,
  XCircle,
} from "lucide-react";

type Props = {
  detail: ActivityDetailPayload;
  actionRole?: ActivityActionRole;
  onChanged: () => Promise<void> | void;
};

const decisionLabel: Record<string, string> = {
  PENDING: "Menunggu Approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Dibatalkan",
};

const decisionClass: Record<string, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-700",
  CANCELLED: "border-slate-200 bg-slate-50 text-slate-600",
};

const ActivitySupportApprovalPanel: React.FC<Props> = ({
  detail,
  actionRole,
  onChanged,
}) => {
  const { profile } = useAuth();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const approvals = detail.support_approvals || [];

  const myApproval = useMemo(
    () =>
      approvals.find(
        (item) => item.profile_id === profile?.id
      ),
    [approvals, profile?.id]
  );

  if (
    detail.activity.activity_mode !== "PERSONAL" ||
    approvals.length === 0
  ) {
    return null;
  }

  const total = detail.activity.support_approval_total || approvals.length;
  const approved =
    detail.activity.support_approval_approved ||
    approvals.filter((item) => item.decision_status === "APPROVED").length;

  const canReview =
    detail.activity.status === "NEED_SUPPORT" &&
    detail.activity.support_approval_status === "PENDING" &&
    actionRole === "SUPPORT" &&
    myApproval?.decision_status === "PENDING";

  const decide = async (decision: "APPROVE" | "REJECT") => {
    setError("");
    setMessage("");

    if (decision === "REJECT" && !note.trim()) {
      setError("Catatan penolakan wajib diisi.");
      return;
    }

    try {
      setBusy(true);
      await reviewPersonalTaskSupportV30(
        detail.activity.id,
        decision,
        note.trim()
      );
      setMessage(
        decision === "APPROVE"
          ? "Need Support berhasil di-approve."
          : "Need Support dikembalikan ke owner."
      );
      setNote("");
      await onChanged();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Keputusan Need Support belum dapat diproses."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <ShieldCheck className="h-4 w-4 text-amber-700" />
            Approval Need Support
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Task Pribadi baru dapat diselesaikan setelah seluruh user Need Support approve.
          </p>
        </div>
        <Badge className="border-amber-200 bg-white text-amber-800">
          {approved}/{total} Approved
        </Badge>
      </div>

      <div className="mt-4 grid gap-2">
        {approvals.map((item) => (
          <div
            key={item.profile_id}
            className="flex flex-col gap-2 rounded-lg border bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="font-medium text-slate-900">
                {item.full_name}
              </div>
              <div className="text-xs text-slate-500">
                {[item.role_level, item.department || item.unit]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              {item.decision_note && (
                <div className="mt-1 text-xs text-slate-600">
                  Catatan: {item.decision_note}
                </div>
              )}
            </div>
            <Badge
              className={
                decisionClass[item.decision_status] ||
                "border-slate-200 bg-slate-50 text-slate-600"
              }
            >
              {item.decision_status === "APPROVED" ? (
                <CheckCircle2 className="mr-1 h-3 w-3" />
              ) : item.decision_status === "REJECTED" ? (
                <XCircle className="mr-1 h-3 w-3" />
              ) : (
                <Clock3 className="mr-1 h-3 w-3" />
              )}
              {decisionLabel[item.decision_status] || item.decision_status}
            </Badge>
          </div>
        ))}
      </div>

      {canReview && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-white p-3">
          <div className="font-medium text-slate-900">
            Keputusan Anda
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Catatan boleh dikosongkan saat approve, tetapi wajib diisi saat reject.
          </p>
          <Textarea
            className="mt-3"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Catatan / alasan keputusan..."
            disabled={busy}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void decide("APPROVE")}
              disabled={busy}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve Need Support
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void decide("REJECT")}
              disabled={busy}
              className="gap-2 border-rose-200 text-rose-700 hover:bg-rose-50"
            >
              <XCircle className="h-4 w-4" />
              Reject / Kembalikan
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}
      {message && (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </div>
      )}
    </div>
  );
};

export default ActivitySupportApprovalPanel;
