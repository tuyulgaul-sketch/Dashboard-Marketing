import React, { useEffect, useMemo, useRef, useState } from "react";
import { AtSign, Reply, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ActivityCommentDetail,
  ActivityDetailPayload,
  DirectoryProfile,
  addUniversalActivityCommentV2,
  getUniversalActivityDetail,
} from "@/services/activityService";

type Props = {
  detail: ActivityDetailPayload;
  directory: DirectoryProfile[];
  currentProfileId?: string | null;
  highlightCommentId?: string | null;
  onDetailChange: (detail: ActivityDetailPayload) => void;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ActivityDiscussionV2: React.FC<Props> = ({
  detail,
  directory,
  currentProfileId,
  highlightCommentId,
  onDetailChange,
}) => {
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<ActivityCommentDetail | null>(null);
  const [mentionProfileIds, setMentionProfileIds] = useState<string[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const profileMap = useMemo(
    () => new Map(directory.map((item) => [item.id, item])),
    [directory]
  );

  const childrenMap = useMemo(() => {
    const result = new Map<string, string[]>();
    directory.forEach((item) => {
      if (!item.manager_id) return;
      const children = result.get(item.manager_id) || [];
      children.push(item.id);
      result.set(item.manager_id, children);
    });
    return result;
  }, [directory]);

  const mentionableProfiles = useMemo(() => {
    if (!currentProfileId) return [];
    const allowed = new Set<string>();
    const stack = [...(childrenMap.get(currentProfileId) || [])];

    while (stack.length > 0) {
      const id = stack.pop()!;
      if (allowed.has(id)) continue;
      allowed.add(id);
      (childrenMap.get(id) || []).forEach((childId) => stack.push(childId));
    }

    let cursor = profileMap.get(currentProfileId)?.manager_id || null;
    while (cursor) {
      if (allowed.has(cursor)) break;
      allowed.add(cursor);
      cursor = profileMap.get(cursor)?.manager_id || null;
    }

    allowed.add(detail.owner.id);
    allowed.add(detail.created_by.id);
    if (detail.validation_approver?.id) allowed.add(detail.validation_approver.id);
    if (replyTo?.created_by_profile_id) allowed.add(replyTo.created_by_profile_id);
    allowed.delete(currentProfileId);

    return directory
      .filter((item) => allowed.has(item.id))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "id"));
  }, [
    childrenMap,
    currentProfileId,
    detail.created_by.id,
    detail.owner.id,
    detail.validation_approver?.id,
    directory,
    profileMap,
    replyTo?.created_by_profile_id,
  ]);

  const selectedMentionProfiles = useMemo(
    () =>
      mentionProfileIds
        .map((id) => profileMap.get(id))
        .filter((item): item is DirectoryProfile => Boolean(item)),
    [mentionProfileIds, profileMap]
  );

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const query = mentionQuery.trim().toLowerCase();
    return mentionableProfiles
      .filter((item) => {
        if (!query) return true;
        return [item.full_name, item.role_level, item.department, item.unit]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .slice(0, 8);
  }, [mentionQuery, mentionableProfiles]);

  const handleTextChange = (value: string) => {
    setCommentText(value);
    const atIndex = value.lastIndexOf("@");
    if (atIndex < 0 || (atIndex > 0 && !/\s/.test(value.charAt(atIndex - 1)))) {
      setMentionQuery(null);
      return;
    }
    const fragment = value.slice(atIndex + 1);
    if (fragment.includes("\n") || fragment.length > 80) {
      setMentionQuery(null);
      return;
    }
    const alreadySelected = selectedMentionProfiles.some(
      (person) => fragment === person.full_name || fragment.startsWith(person.full_name + " ")
    );
    setMentionQuery(alreadySelected ? null : fragment);
  };

  const selectMention = (person: DirectoryProfile) => {
    const atIndex = commentText.lastIndexOf("@");
    if (atIndex < 0) return;
    setCommentText(commentText.slice(0, atIndex) + `@${person.full_name} `);
    setMentionProfileIds((current) => Array.from(new Set([...current, person.id])));
    setMentionQuery(null);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const clearComposer = () => {
    setCommentText("");
    setReplyTo(null);
    setMentionProfileIds([]);
    setMentionQuery(null);
  };

  const handleSubmit = async () => {
    if (!commentText.trim()) return;
    const effectiveMentionIds = selectedMentionProfiles
      .filter((person) => commentText.includes(`@${person.full_name}`))
      .map((person) => person.id);

    try {
      setCommentBusy(true);
      const result = await addUniversalActivityCommentV2(
        detail.activity.id,
        commentText.trim(),
        {
          parentCommentId: replyTo?.id || null,
          mentionedProfileIds: effectiveMentionIds,
        }
      );
      clearComposer();
      const refreshed = await getUniversalActivityDetail(detail.activity.id);
      onDetailChange(refreshed);
      if (result.warning) window.alert(result.warning);
    } catch (error: any) {
      console.error(error);
      window.alert(error?.message || "Gagal mengirim komentar.");
    } finally {
      setCommentBusy(false);
    }
  };

  useEffect(() => {
    if (!highlightCommentId) return;
    const timer = window.setTimeout(() => {
      document
        .getElementById(`activity-comment-${highlightCommentId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [detail.comments.length, highlightCommentId]);

  const renderBody = (comment: ActivityCommentDetail) => {
    const mentionNames = (comment.mentions || [])
      .map((item) => item.full_name)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    if (mentionNames.length === 0) return comment.body;
    const expression = new RegExp(
      `(@(?:${mentionNames.map(escapeRegExp).join("|")}))`,
      "gi"
    );
    const canonical = new Map(
      mentionNames.map((name) => [`@${name}`.toLowerCase(), `@${name}`])
    );
    return comment.body.split(expression).map((part, index) => {
      const key = part.toLowerCase();
      if (canonical.has(key)) {
        return (
          <span key={index} className="font-bold text-blue-700">
            {canonical.get(key)}
          </span>
        );
      }
      return <React.Fragment key={index}>{part}</React.Fragment>;
    });
  };

  return (
    <div className="space-y-4">
      <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
        {detail.comments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            Belum ada komentar.
          </div>
        ) : (
          detail.comments.map((comment) => {
            const isHighlighted = highlightCommentId === comment.id;
            return (
              <div
                id={`activity-comment-${comment.id}`}
                key={comment.id}
                className={`rounded-xl border p-4 transition ${
                  isHighlighted
                    ? "border-blue-400 bg-blue-50/70 shadow-md ring-2 ring-blue-200"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-bold text-slate-900">{comment.author_name}</div>
                    <div className="text-[10px] text-slate-500">
                      {comment.author_role} • {comment.author_department || comment.author_unit}
                    </div>
                  </div>
                  <div className="shrink-0 text-[10px] text-slate-400">
                    {formatDateTime(comment.created_at)}
                  </div>
                </div>

                {comment.parent_comment_id && (
                  <div className="mt-3 rounded-lg border-l-4 border-blue-300 bg-slate-50 px-3 py-2">
                    <div className="text-[10px] font-bold text-blue-700">
                      ↩ Membalas {comment.parent_author_name || "komentar sebelumnya"}
                    </div>
                    <div className="mt-1 line-clamp-3 whitespace-pre-wrap text-[11px] leading-5 text-slate-500">
                      {comment.parent_body || "-"}
                    </div>
                  </div>
                )}

                <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {renderBody(comment)}
                </div>

                {(comment.mentions || []).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(comment.mentions || []).map((mention) => (
                      <Badge
                        key={mention.profile_id}
                        variant="outline"
                        className="border-blue-200 bg-blue-50 text-[9px] text-blue-700"
                      >
                        @{mention.full_name}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[10px]"
                    onClick={() => {
                      setReplyTo(comment);
                      setMentionQuery(null);
                      requestAnimationFrame(() => textareaRef.current?.focus());
                    }}
                  >
                    <Reply className="mr-1.5 h-3.5 w-3.5" />
                    Balas
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="relative rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-xs font-bold text-slate-700">Discussion</div>
          <div className="flex items-center gap-1 text-[10px] text-slate-500">
            <AtSign className="h-3.5 w-3.5" /> Ketik @ untuk mention
          </div>
        </div>

        {replyTo && (
          <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-blue-700">
                  Membalas {replyTo.author_name}
                </div>
                <div className="mt-1 line-clamp-2 text-[11px] text-slate-600">
                  {replyTo.body}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700"
                aria-label="Batalkan reply"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <Textarea
          ref={textareaRef}
          value={commentText}
          onChange={(event) => handleTextChange(event.target.value)}
          placeholder="Tulis update, balasan, atau gunakan @Nama untuk memberi perhatian..."
          maxLength={4000}
        />

        {mentionQuery !== null && mentionSuggestions.length > 0 && (
          <div className="absolute left-4 right-4 z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
            {mentionSuggestions.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => selectMention(person)}
                className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left hover:bg-blue-50"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-black text-blue-700">
                  {person.full_name
                    .split(" ")
                    .slice(0, 2)
                    .map((part) => part.charAt(0))
                    .join("")
                    .toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-slate-900">{person.full_name}</div>
                  <div className="truncate text-[10px] text-slate-500">
                    {person.role_level} • {person.department || person.unit || "-"}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <div className="text-[10px] text-slate-400">{commentText.length}/4000</div>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={commentBusy || !commentText.trim()}
          >
            <Send className="mr-2 h-4 w-4" />
            {commentBusy ? "Mengirim..." : replyTo ? "Kirim Balasan" : "Kirim Komentar"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ActivityDiscussionV2;
