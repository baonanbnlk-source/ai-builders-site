import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { addAnnotation, getCurrentUserId, useAnnotations } from "@/lib/storage";
import { useAuth, openLoginDialog } from "@/lib/auth";
import { getUserById } from "@/data/users";
import type { Annotation } from "@/data/types";
import { MessageSquare, Copy, Plus, X } from "lucide-react";
import { useAnnotationDrawer } from "./AnnotationDrawerContext";

interface AnnotatableProps {
  blockId: string;
  children: ReactNode;
  className?: string;
  // optional override for the path-key used in localStorage
  targetPath?: string;
  // optional: source label shown in drawer (e.g., "@karpathy · 2026-06-25")
  sourceLabel?: string;
}

interface ToolbarState {
  x: number;
  y: number;
  text: string;
}

/**
 * AnnotatableText is a wrapper that turns its inner text into a "微信读书 style"
 * annotatable block. Selecting text triggers a floating toolbar. Submitting a
 * highlight wraps that range with a colored underline + soft background and
 * stores an Annotation in localStorage.
 */
export default function AnnotatableText({
  blockId,
  children,
  className,
  targetPath,
  sourceLabel,
}: AnnotatableProps) {
  const location = useLocation();
  const path = targetPath ?? location.pathname;
  const ref = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const [toolbar, setToolbar] = useState<ToolbarState | null>(null);
  const [composer, setComposer] = useState<ToolbarState | null>(null);
  const [composerValue, setComposerValue] = useState("");
  const [copyTip, setCopyTip] = useState<string | null>(null);
  const annotations = useAnnotations(
    useCallback((a: Annotation) => a.targetPath === path && a.blockId === blockId, [path, blockId])
  );
  const drawer = useAnnotationDrawer();
  const { isLoggedIn } = useAuth();

  // Build highlight metadata: for each annotation, find start index in plain text
  const innerText = useMemo(() => extractText(children), [children]);

  const highlights = useMemo(() => {
    const items: Array<{ start: number; end: number; ann: Annotation }> = [];
    for (const ann of annotations) {
      const idx = innerText.indexOf(ann.quote);
      if (idx === -1) continue;
      items.push({ start: idx, end: idx + ann.quote.length, ann });
    }
    items.sort((a, b) => a.start - b.start);
    return items;
  }, [annotations, innerText]);

  // Group overlapping highlights by stacking colors
  const segments = useMemo(() => splitIntoSegments(innerText, highlights), [innerText, highlights]);

  // Toolbar logic
  useEffect(() => {
    const onMouseUp = (e: MouseEvent) => {
      if (!ref.current) return;
      // Ignore mouseups inside the floating toolbar / composer so they don't
      // immediately reset the selection state.
      if (
        toolbarRef.current?.contains(e.target as Node) ||
        composerRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setToolbar(null);
        return;
      }
      const range = sel.getRangeAt(0);
      if (!ref.current.contains(range.commonAncestorContainer)) {
        setToolbar(null);
        return;
      }
      const text = sel.toString().trim();
      if (text.length < 2) return;
      const rect = range.getBoundingClientRect();
      const containerRect = ref.current.getBoundingClientRect();
      setToolbar({
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top,
        text,
      });
      e.stopPropagation();
    };
    const onMouseDown = (e: MouseEvent) => {
      // Do NOT close the toolbar when the click target is inside the toolbar
      // or composer - otherwise the toolbar disappears between mousedown and
      // click, so the React onClick never fires (this is the "buttons do
      // nothing" bug).
      if (
        toolbarRef.current?.contains(e.target as Node) ||
        composerRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      if (!ref.current?.contains(e.target as Node)) {
        setToolbar(null);
      }
    };
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  const handleHighlight = (withComment: boolean) => {
    if (!toolbar) return;
    // Write op: require login. Unlogged users can read/select but划线标注/评论
    // must trigger the login dialog instead of writing.
    if (!isLoggedIn) {
      setToolbar(null);
      window.getSelection()?.removeAllRanges();
      openLoginDialog();
      return;
    }
    if (withComment) {
      setComposer(toolbar);
      setToolbar(null);
      return;
    }
    const ann = addAnnotation({
      targetPath: path,
      blockId,
      quote: toolbar.text,
      authorId: getCurrentUserId(),
    });
    setToolbar(null);
    window.getSelection()?.removeAllRanges();
    // Auto-open the drawer and focus the newly created annotation so the
    // user gets immediate visual feedback (per PRD).
    drawer.openFor(ann.id);
  };

  const handleSubmitComment = () => {
    if (!composer || !composerValue.trim()) return;
    if (!isLoggedIn) {
      setComposer(null);
      setComposerValue("");
      openLoginDialog();
      return;
    }
    const ann = addAnnotation({
      targetPath: path,
      blockId,
      quote: composer.text,
      authorId: getCurrentUserId(),
      initialComment: composerValue.trim(),
    });
    setComposer(null);
    setComposerValue("");
    window.getSelection()?.removeAllRanges();
    drawer.openFor(ann.id);
  };

  const handleCopyQuote = () => {
    if (!toolbar) return;
    const quoteText = `「${toolbar.text}」${sourceLabel ? ` —— ${sourceLabel}` : ""}`;
    const fallbackCopy = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = quoteText;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        return true;
      } catch {
        return false;
      }
    };
    const showTip = (msg: string) => {
      setCopyTip(msg);
      setTimeout(() => setCopyTip(null), 1500);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(quoteText).then(
        () => showTip("✅ 已复制引用"),
        () => showTip(fallbackCopy() ? "✅ 已复制引用" : "复制失败")
      );
    } else {
      showTip(fallbackCopy() ? "✅ 已复制引用" : "复制失败");
    }
    setToolbar(null);
  };

  return (
    <span className="relative block">
      <div
        ref={ref}
        data-annotatable-block={blockId}
        className={className}
      >
        {segments.map((seg, i) => {
          if (seg.type === "text") return <span key={i}>{seg.text}</span>;
          const anns = seg.annotations;
          // primary author color
          const author = getUserById(anns[0].authorId);
          const underline = author.underlineColor;
          const bg = author.bgColor;
          const isMulti = anns.length > 1;
          const onClick = () => drawer.openFor(anns[0].id);
          return (
            <span
              key={i}
              onClick={onClick}
              title={anns[0].comments[0]?.body ?? "查看标注"}
              className="cursor-pointer rounded px-0.5 transition hover:brightness-95"
              style={{
                backgroundColor: bg,
                boxShadow: `inset 0 -2px 0 0 ${underline}`,
              }}
            >
              {seg.text}
              {isMulti && (
                <sup className="ml-0.5 text-[10px] text-slate-500">×{anns.length}</sup>
              )}
            </span>
          );
        })}
      </div>

      {/* Sidebar badge for # of annotations */}
      {annotations.length > 0 && (
        <button
          onClick={() => drawer.openFor(annotations[0].id)}
          className="absolute -right-2 top-0 flex translate-x-full items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700 shadow-sm hover:bg-indigo-100"
        >
          <MessageSquare className="h-3 w-3" /> {annotations.length}
        </button>
      )}

      {/* Floating toolbar */}
      {toolbar && (
        <div
          ref={toolbarRef}
          data-annotation-toolbar={blockId}
          onMouseDown={(e) => {
            // Prevent the browser from clearing the selection before our
            // React click handler runs.
            e.preventDefault();
            e.stopPropagation();
          }}
          className="absolute z-20 flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-full border border-slate-200 bg-white px-1.5 py-1 text-xs shadow-lg"
          style={{ left: toolbar.x, top: toolbar.y - 6 }}
        >
          <button
            type="button"
            data-action="annotate"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleHighlight(false)}
            className="flex items-center gap-1 rounded-full px-2 py-1 text-indigo-600 hover:bg-indigo-50"
          >
            <Plus className="h-3 w-3" /> 标注
          </button>
          <button
            type="button"
            data-action="comment"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleHighlight(true)}
            className="flex items-center gap-1 rounded-full px-2 py-1 text-emerald-600 hover:bg-emerald-50"
          >
            <MessageSquare className="h-3 w-3" /> 评论
          </button>
          <button
            type="button"
            data-action="quote"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleCopyQuote}
            className="flex items-center gap-1 rounded-full px-2 py-1 text-slate-600 hover:bg-slate-50"
          >
            <Copy className="h-3 w-3" /> 引用
          </button>
        </div>
      )}

      {copyTip && (
        <div className="pointer-events-none absolute -top-8 right-0 z-30 rounded-full bg-slate-900/90 px-3 py-1 text-xs text-white shadow">
          {copyTip}
        </div>
      )}

      {/* Inline composer */}
      {composer && (
        <div
          ref={composerRef}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute z-30 w-72 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"
          style={{ left: composer.x, top: composer.y + 10 }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="rounded-lg bg-slate-50 px-2 py-1 text-[12px] text-slate-600 line-clamp-3">
              「{composer.text}」
            </div>
            <button
              onClick={() => {
                setComposer(null);
                setComposerValue("");
              }}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <textarea
            autoFocus
            value={composerValue}
            onChange={(e) => setComposerValue(e.target.value)}
            placeholder="写下你的评论 / 提问 / @ 同事 …"
            className="mt-2 h-20 w-full resize-none rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-indigo-300 focus:outline-none"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => {
                setComposer(null);
                setComposerValue("");
              }}
              className="rounded-full px-3 py-1 text-xs text-slate-500 hover:bg-slate-50"
            >
              取消
            </button>
            <button
              onClick={handleSubmitComment}
              className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-indigo-700"
            >
              发布
            </button>
          </div>
        </div>
      )}
    </span>
  );
}

// ---- helpers ----

function extractText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  // React element
  if (typeof node === "object" && "props" in (node as any)) {
    return extractText((node as any).props.children);
  }
  return "";
}

type Segment =
  | { type: "text"; text: string }
  | { type: "highlight"; text: string; annotations: Annotation[] };

function splitIntoSegments(
  text: string,
  highlights: Array<{ start: number; end: number; ann: Annotation }>
): Segment[] {
  if (highlights.length === 0) return [{ type: "text", text }];
  // Build sweep boundaries
  const boundaries = new Set<number>([0, text.length]);
  for (const h of highlights) {
    boundaries.add(Math.max(0, Math.min(text.length, h.start)));
    boundaries.add(Math.max(0, Math.min(text.length, h.end)));
  }
  const sorted = Array.from(boundaries).sort((a, b) => a - b);
  const out: Segment[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (start === end) continue;
    const slice = text.slice(start, end);
    const anns = highlights
      .filter((h) => h.start <= start && h.end >= end)
      .map((h) => h.ann);
    if (anns.length === 0) {
      out.push({ type: "text", text: slice });
    } else {
      out.push({ type: "highlight", text: slice, annotations: anns });
    }
  }
  return out;
}
