import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAnnotationDrawer } from "./AnnotationDrawerContext";
import {
  addComment,
  deleteAnnotation,
  toggleReaction,
  useAnnotations,
  useCurrentUserId,
} from "@/lib/storage";
import { getUserById, FAKE_USERS } from "@/data/users";
import { useAuth, openLoginDialog } from "@/lib/auth";
import { relativeTime } from "@/lib/format";
import { MessageCircle, Trash2, X, ChevronRight, Smile } from "lucide-react";
import type { Annotation, Comment } from "@/data/types";

const QUICK_EMOJIS = ["👍", "🔥", "🤯", "💡", "❤️"];

export default function AnnotationDrawer() {
  const { open, focusId, close } = useAnnotationDrawer();
  const location = useLocation();
  // On the home page we render the digest view with targetPath="/digest/today"
  // so annotations live under "/digest/today" even when the user navigated to
  // "/".  Surface those annotations in the drawer for both routes.
  const annotations = useAnnotations((a) =>
    a.targetPath === location.pathname ||
    (location.pathname === "/" && a.targetPath === "/digest/today")
  );
  const [currentUserId] = useCurrentUserId();
  const { isLoggedIn } = useAuth();
  const [replyTarget, setReplyTarget] = useState<{ annId: string; commentId?: string } | null>(null);
  const [composer, setComposer] = useState("");
  const focusRef = useRef<HTMLDivElement>(null);

  // Gate write actions: unlogged users can read everything, but reply / react
  // pop the login dialog instead of writing.
  const requireLogin = (): boolean => {
    if (isLoggedIn) return true;
    openLoginDialog();
    return false;
  };

  useEffect(() => {
    if (open && focusId) {
      requestAnimationFrame(() => focusRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }, [open, focusId]);

  const ordered = useMemo(
    () => [...annotations].sort((a, b) => a.createdAt - b.createdAt),
    [annotations]
  );

  if (!open) {
    if (annotations.length === 0) return null;
    return <FloatingTab count={annotations.length} />;
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-30 flex w-[380px] flex-col border-l border-slate-200 bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-slate-800">本页讨论</div>
          <div className="text-xs text-slate-400">共 {annotations.length} 处标注</div>
        </div>
        <button onClick={close} className="rounded-full p-1 text-slate-400 hover:bg-slate-100">
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {ordered.length === 0 ? (
          <EmptyState />
        ) : (
          ordered.map((ann) => (
            <AnnotationCard
              key={ann.id}
              ann={ann}
              highlighted={focusId === ann.id}
              currentUserId={currentUserId}
              onDelete={() => deleteAnnotation(ann.id)}
              onReply={(commentId) => {
                if (!requireLogin()) return;
                setReplyTarget({ annId: ann.id, commentId });
                setComposer("");
              }}
              onReact={(commentId, emoji) => {
                if (!requireLogin()) return;
                toggleReaction(ann.id, commentId, emoji, currentUserId);
              }}
              cardRef={focusId === ann.id ? focusRef : undefined}
            />
          ))
        )}
      </div>
      {replyTarget && (
        <div className="border-t border-slate-100 p-3">
          <div className="mb-1 text-xs text-slate-500">回复 #{replyTarget.commentId ? "评论" : "标注"}</div>
          <textarea
            autoFocus
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            placeholder="输入回复…"
            className="h-16 w-full resize-none rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-indigo-300 focus:outline-none"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => setReplyTarget(null)}
              className="rounded-full px-3 py-1 text-xs text-slate-500 hover:bg-slate-50"
            >
              取消
            </button>
            <button
              onClick={() => {
                if (!composer.trim()) return;
                if (!requireLogin()) return;
                addComment(replyTarget.annId, composer.trim(), currentUserId, replyTarget.commentId);
                setComposer("");
                setReplyTarget(null);
              }}
              className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-indigo-700"
            >
              发布
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

function FloatingTab({ count }: { count: number }) {
  const { openAll } = useAnnotationDrawer();
  return (
    <button
      onClick={openAll}
      className="fixed right-4 top-1/2 z-30 flex -translate-y-1/2 items-center gap-2 rounded-full bg-indigo-600 px-3 py-2 text-xs text-white shadow-lg hover:bg-indigo-700"
    >
      <MessageCircle className="h-4 w-4" /> 本页讨论 · {count}
      <ChevronRight className="h-3 w-3 opacity-70" />
    </button>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
      还没有人在这个页面留下标注。
      <br />
      在正文里选中文本即可开始划线评论。
    </div>
  );
}

function AnnotationCard({
  ann,
  highlighted,
  currentUserId,
  onDelete,
  onReply,
  onReact,
  cardRef,
}: {
  ann: Annotation;
  highlighted: boolean;
  currentUserId: string;
  onDelete: () => void;
  onReply: (commentId?: string) => void;
  onReact: (commentId: string, emoji: string) => void;
  cardRef?: React.RefObject<HTMLDivElement>;
}) {
  const author = getUserById(ann.authorId);
  return (
    <div
      ref={cardRef}
      className={`rounded-xl border ${
        highlighted ? "border-indigo-300 ring-2 ring-indigo-100" : "border-slate-200"
      } bg-white p-3 shadow-sm`}
    >
      <div
        className="rounded-md px-2 py-1 text-[12px] text-slate-600 line-clamp-3"
        style={{ backgroundColor: author.bgColor }}
      >
        「{ann.quote}」
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-lg">{author.emoji}</span>
        <span className={`text-sm font-medium ${author.color}`}>{author.name}</span>
        <span className="text-xs text-slate-400">{relativeTime(ann.createdAt)}</span>
        {ann.authorId === currentUserId && (
          <button onClick={onDelete} className="ml-auto text-slate-400 hover:text-rose-500">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="mt-3 space-y-2">
        {ann.comments.map((c) => (
          <CommentItem
            key={c.id}
            comment={c}
            onReply={() => onReply(c.id)}
            onReact={(emoji) => onReact(c.id, emoji)}
            currentUserId={currentUserId}
          />
        ))}
      </div>
      <button
        onClick={() => onReply()}
        className="mt-2 inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
      >
        <MessageCircle className="h-3 w-3" /> 写评论
      </button>
    </div>
  );
}

function CommentItem({
  comment,
  onReply,
  onReact,
  currentUserId,
}: {
  comment: Comment;
  onReply: () => void;
  onReact: (emoji: string) => void;
  currentUserId: string;
}) {
  const author = getUserById(comment.authorId);
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="flex items-center gap-2">
        <span>{author.emoji}</span>
        <span className={`text-xs font-medium ${author.color}`}>{author.name}</span>
        <span className="text-[10px] text-slate-400">{relativeTime(comment.createdAt)}</span>
      </div>
      <div className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">
        {comment.body}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {comment.reactions.map((r) => (
          <button
            key={r.emoji}
            onClick={() => onReact(r.emoji)}
            className={`rounded-full border px-2 py-0.5 text-[11px] ${
              r.userIds.includes(currentUserId)
                ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            {r.emoji} {r.userIds.length}
          </button>
        ))}
        <Quickbar onReact={onReact} />
        <button
          onClick={onReply}
          className="ml-auto rounded-full px-2 py-0.5 text-[11px] text-indigo-600 hover:bg-indigo-50"
        >
          回复
        </button>
      </div>
    </div>
  );
}

function Quickbar({ onReact }: { onReact: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-50"
      >
        <Smile className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 flex gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 shadow">
          {QUICK_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => {
                onReact(e);
                setOpen(false);
              }}
              className="text-base leading-none hover:scale-125 transition-transform"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// re-export FAKE_USERS to avoid unused warning
export { FAKE_USERS };
