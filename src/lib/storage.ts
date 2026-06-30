// Re-platformed storage layer. Public hook surface mirrors the legacy
// localStorage version so call sites do not need to change much.
// All data now lives in the backend; users without a session see an empty
// world and most write ops will fail with a "请先登录" toast.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Annotation, Comment } from "@/data/types";
import { api, type ApiAnnotation } from "./api";
import { useAuth } from "./auth";
import { upsertUsers as _upsertUsers, subscribeUsers } from "./userStore";
void _upsertUsers;

const FOLLOW_KEY_LEGACY = "prd_followed_builders_v1";
const SUBSCRIPTION_KEY = "prd_subscriptions_v1";
const VISITS_PENDING_KEY = "abd_visits_pending_v1";

function mapAnn(a: ApiAnnotation): Annotation {
  return {
    id: a.id,
    targetPath: a.targetPath,
    blockId: a.blockId,
    quote: a.quote,
    authorId: a.authorId,
    createdAt: a.createdAt,
    comments: a.comments.map<Comment>((c) => ({
      id: c.id,
      authorId: c.authorId,
      parentId: c.parentId || undefined,
      body: c.body,
      createdAt: c.createdAt,
      reactions: c.reactions || [],
    })),
  };
}

// ---- module-level annotation cache ----
let cache: Annotation[] = [];
const annListeners = new Set<() => void>();

function setCache(next: Annotation[]) {
  cache = next;
  for (const l of annListeners) l();
}

function mergeAnns(incoming: Annotation[]) {
  const idx = new Map(cache.map((a) => [a.id, a] as const));
  for (const a of incoming) idx.set(a.id, a);
  setCache(Array.from(idx.values()).sort((a, b) => a.createdAt - b.createdAt));
}

async function refreshAll() {
  try {
    const { annotations } = await api.listAnnotations();
    setCache(annotations.map(mapAnn));
  } catch {
    /* ignore */
  }
}

// Boot fetch once
let booted = false;
function ensureBoot() {
  if (booted) return;
  booted = true;
  refreshAll();
}

export function useAnnotations(filter?: (a: Annotation) => boolean) {
  ensureBoot();
  const [, force] = useState(0);
  useEffect(() => {
    const cb = () => force((v) => v + 1);
    annListeners.add(cb);
    return () => {
      annListeners.delete(cb);
    };
  }, []);
  return filter ? cache.filter(filter) : cache;
}

export function getAllAnnotations(): Annotation[] {
  return cache;
}

// Re-export user store subscription so consumers can listen if needed.
export { subscribeUsers };

function ensureLoggedIn(user: unknown): asserts user {
  if (!user) {
    alert("请先登录后再操作");
    throw new Error("not logged in");
  }
}

export function useAnnotationActions() {
  const { user } = useAuth();

  const addAnnotation = useCallback(
    async (input: { targetPath: string; blockId: string; quote: string; initialComment?: string }) => {
      ensureLoggedIn(user);
      const { annotations } = await api.createAnnotation(input);
      mergeAnns(annotations.map(mapAnn));
      const created = annotations
        .map(mapAnn)
        .filter((a) => a.targetPath === input.targetPath && a.blockId === input.blockId && a.quote === input.quote)
        .sort((a, b) => b.createdAt - a.createdAt)[0];
      return created;
    },
    [user]
  );

  const addComment = useCallback(
    async (annId: string, body: string, _authorId: string, parentId?: string) => {
      ensureLoggedIn(user);
      const { annotations } = await api.createComment(annId, body, parentId);
      mergeAnns(annotations.map(mapAnn));
    },
    [user]
  );

  const toggleReaction = useCallback(
    async (annId: string, cid: string, emoji: string, _userId: string) => {
      ensureLoggedIn(user);
      const { annotations } = await api.toggleReaction(annId, cid, emoji);
      mergeAnns(annotations.map(mapAnn));
    },
    [user]
  );

  const deleteAnnotation = useCallback(
    async (annId: string) => {
      ensureLoggedIn(user);
      await api.deleteAnnotation(annId);
      setCache(cache.filter((a) => a.id !== annId));
    },
    [user]
  );

  return { addAnnotation, addComment, toggleReaction, deleteAnnotation };
}

// Legacy named exports for components that still call these synchronously.
// They now create promises but discard the result; the cache will update via
// the await path inside.
export function addAnnotation(input: {
  targetPath: string;
  blockId: string;
  quote: string;
  authorId: string;
  initialComment?: string;
}): Annotation {
  // Optimistic stub; the real one comes back asynchronously and will update
  // the cache, triggering a re-render.
  const stub: Annotation = {
    id: `pending-${Date.now()}`,
    targetPath: input.targetPath,
    blockId: input.blockId,
    quote: input.quote,
    authorId: input.authorId,
    createdAt: Date.now(),
    comments: input.initialComment
      ? [
          {
            id: `pending-c-${Date.now()}`,
            authorId: input.authorId,
            body: input.initialComment,
            createdAt: Date.now(),
            reactions: [],
          },
        ]
      : [],
  };
  api
    .createAnnotation({
      targetPath: input.targetPath,
      blockId: input.blockId,
      quote: input.quote,
      initialComment: input.initialComment,
    })
    .then(({ annotations }) => {
      mergeAnns(annotations.map(mapAnn));
    })
    .catch((e) => alert((e as Error).message));
  return stub;
}

export function addComment(annId: string, body: string, _authorId: string, parentId?: string): void {
  api
    .createComment(annId, body, parentId)
    .then(({ annotations }) => mergeAnns(annotations.map(mapAnn)))
    .catch((e) => alert((e as Error).message));
}

export function toggleReaction(annId: string, cid: string, emoji: string, _userId: string): void {
  api
    .toggleReaction(annId, cid, emoji)
    .then(({ annotations }) => mergeAnns(annotations.map(mapAnn)))
    .catch((e) => alert((e as Error).message));
}

export function deleteAnnotation(annId: string): void {
  api
    .deleteAnnotation(annId)
    .then(() => setCache(cache.filter((a) => a.id !== annId)))
    .catch((e) => alert((e as Error).message));
}

// ---- current user ----

export function getCurrentUserId(): string {
  // Read from cached auth state via window — kept as fallback for non-hook
  // call sites. The reliable path is useCurrentUserId() in components.
  try {
    const t = localStorage.getItem("abd_session_token_v1");
    if (!t) return "";
  } catch {
    return "";
  }
  // We don't know the numeric id outside React; components should use the hook.
  return (window as any).__abdCurrentUserId || "";
}

export function useCurrentUserId(): [string, (_id: string) => void] {
  const { user } = useAuth();
  const id = user ? String(user.id) : "";
  useEffect(() => {
    (window as any).__abdCurrentUserId = id;
  }, [id]);
  // setter is now a no-op (login flow controls identity).
  return [id, () => undefined];
}

// ---- follows ----

function readFollowsLegacy(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FOLLOW_KEY_LEGACY) ?? "[]");
  } catch {
    return [];
  }
}

export function useFollowedHandles(): [string[], (handle: string) => void] {
  const { user } = useAuth();
  const [list, setList] = useState<string[]>(() => readFollowsLegacy());
  const fetched = useRef(false);

  useEffect(() => {
    if (!user) {
      setList(readFollowsLegacy());
      fetched.current = false;
      return;
    }
    if (fetched.current) return;
    fetched.current = true;
    api
      .listFollows()
      .then(({ handles }) => setList(handles))
      .catch(() => {
        /* ignore */
      });
  }, [user]);

  const toggle = (handle: string) => {
    if (!user) {
      const cur = readFollowsLegacy();
      const next = cur.includes(handle) ? cur.filter((h) => h !== handle) : [...cur, handle];
      localStorage.setItem(FOLLOW_KEY_LEGACY, JSON.stringify(next));
      setList(next);
      return;
    }
    setList((cur) => (cur.includes(handle) ? cur.filter((h) => h !== handle) : [...cur, handle]));
    api
      .toggleFollow(handle)
      .then(({ following }) => {
        setList((cur) => {
          if (following && !cur.includes(handle)) return [...cur, handle];
          if (!following) return cur.filter((h) => h !== handle);
          return cur;
        });
      })
      .catch(() => api.listFollows().then(({ handles }) => setList(handles)));
  };

  return [list, toggle];
}

// ---- subscriptions (still localStorage; no backend column) ----

export type Subscriptions = { daily: boolean; weekly: boolean; highlights: boolean };

function defaultSubs(): Subscriptions {
  return { daily: true, weekly: false, highlights: true };
}

export function useSubscriptions(): [Subscriptions, (k: keyof Subscriptions, v: boolean) => void] {
  const [subs, setSubs] = useState<Subscriptions>(() => {
    try {
      const raw = localStorage.getItem(SUBSCRIPTION_KEY);
      return raw ? { ...defaultSubs(), ...JSON.parse(raw) } : defaultSubs();
    } catch {
      return defaultSubs();
    }
  });
  const toggle = (k: keyof Subscriptions, v: boolean) => {
    const next = { ...subs, [k]: v };
    setSubs(next);
    localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(next));
  };
  return [subs, toggle];
}

// ---- builder visits ----

export type BuilderVisitRecord = { count: number; lastAt: number };
type BuilderVisitsMap = Record<string, BuilderVisitRecord>;

function readPending(): string[] {
  try {
    return JSON.parse(localStorage.getItem(VISITS_PENDING_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function writePending(list: string[]) {
  localStorage.setItem(VISITS_PENDING_KEY, JSON.stringify(list));
}

export function recordBuilderVisit(handle: string) {
  if (!handle) return;
  // queue + best-effort send; works even when not logged in (queued).
  const pending = readPending();
  pending.push(handle);
  writePending(pending);
  flushVisits();
}

function flushVisits() {
  const pending = readPending();
  if (!pending.length) return;
  const token = localStorage.getItem("abd_session_token_v1");
  if (!token) return;
  const next = pending.slice();
  writePending([]);
  Promise.all(
    next.map((h) =>
      api.recordVisit(h).catch(() => {
        writePending([...readPending(), h]);
      })
    )
  );
}

let visitsTimer: ReturnType<typeof setInterval> | null = null;
if (typeof window !== "undefined" && !visitsTimer) {
  visitsTimer = setInterval(flushVisits, 15000);
  window.addEventListener("auth:update", flushVisits);
}

export function useBuilderVisits(): BuilderVisitsMap {
  const [map, setMap] = useState<BuilderVisitsMap>({});
  useEffect(() => {
    let alive = true;
    const load = () => {
      api
        .topBuilders(30, 30)
        .then((r) => {
          if (!alive) return;
          const next: BuilderVisitsMap = {};
          for (const x of r.top) next[x.handle] = { count: x.visits, lastAt: x.lastAt };
          setMap(next);
        })
        .catch(() => {
          /* ignore */
        });
    };
    load();
    const t = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return map;
}

// Trigger ann cache refresh on login change.
if (typeof window !== "undefined") {
  window.addEventListener("auth:update", () => {
    refreshAll();
  });
}
