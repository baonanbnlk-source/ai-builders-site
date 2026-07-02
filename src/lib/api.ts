// HTTP client for AI Builders Daily backend.
// Token persisted in localStorage; same hook surface as before but networked.

export const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://b3p2ct1q.cn-east-fn.bytedance.net";

const TOKEN_KEY = "abd_session_token_v1";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event("auth:update"));
}

export type ApiUser = {
  id: string;
  email: string;
  name: string;
  emoji: string;
  color: string;
};

export type ApiReaction = { emoji: string; userIds: string[] };
export type ApiComment = {
  id: string;
  authorId: string;
  parentId?: string | null;
  body: string;
  createdAt: number;
  reactions: ApiReaction[];
};
export type ApiAnnotation = {
  id: string;
  targetPath: string;
  blockId: string;
  quote: string;
  authorId: string;
  createdAt: number;
  comments: ApiComment[];
};

// FaaS 冷启动第一枪可能要 20+s，本来 15s 兜底太严，改到 45s；同时把「登录/预热」类
// 请求做一次自动重试，避免用户直接看到 "请求超时"。
const DEFAULT_TIMEOUT_MS = 45000;

// 前端友好错误信息类型，让上层可以判断超时/网络/服务器错误。
export class ApiError extends Error {
  kind: "timeout" | "network" | "server" | "unauthorized" | "http";
  status?: number;
  constructor(kind: ApiError["kind"], message: string, status?: number) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

type RequestOpts = RequestInit & { timeoutMs?: number };

async function _fetchOnce<T>(path: string, opts: RequestOpts): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  const tok = getToken();
  if (tok) headers["Authorization"] = `Bearer ${tok}`;

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...opts, headers, signal: controller.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new ApiError("timeout", "请求超时（网络慢或后端冷启动中），请稍后重试");
    }
    throw new ApiError("network", "网络异常，请检查连接后重试");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401) {
    setToken(null);
    throw new ApiError("unauthorized", "未登录或登录已失效", 401);
  }
  if (res.status >= 500) {
    let detail = `服务器错误（HTTP ${res.status}）`;
    try {
      const j = await res.json();
      detail = `服务器错误：${j.detail || res.status}`;
    } catch {
      /* ignore */
    }
    throw new ApiError("server", detail, res.status);
  }
  if (!res.ok) {
    let detail = "请求失败";
    try {
      const j = await res.json();
      detail = j.detail || JSON.stringify(j);
    } catch {
      /* ignore */
    }
    throw new ApiError("http", detail, res.status);
  }
  return (await res.json()) as T;
}

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  return _fetchOnce<T>(path, opts);
}

/**
 * 允许在超时或网络错误时做一次自动重试。用于 /api/auth/login 这种冷启动敏感场景。
 */
async function requestWithRetry<T>(path: string, opts: RequestOpts = {}, retries = 1): Promise<T> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await _fetchOnce<T>(path, opts);
    } catch (e) {
      lastErr = e;
      // 只有 timeout / network 类才自动重试，业务错误 (4xx) 直接抛。
      if (!(e instanceof ApiError) || (e.kind !== "timeout" && e.kind !== "network")) {
        throw e;
      }
      // 稍作等待再重试（给 FaaS 一点冷启动时间）
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  throw lastErr;
}

/**
 * 静默预热后端：并行调 /api/health（若没有则回退 /）。任何错误都吞掉。
 * 目的是把 FaaS 冷启动的等待时间前置到用户看到页面时，而不是点登录时。
 */
export function warmupBackend(): void {
  const t = getToken() ? `?t=${Date.now()}` : `?t=${Date.now()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  fetch(`${API_BASE}/api/health${t}`, { signal: controller.signal })
    .catch(() => fetch(`${API_BASE}/${t}`, { signal: controller.signal }).catch(() => null))
    .finally(() => clearTimeout(timer));
}

export const api = {
  // auth
  login: (email: string, name?: string) =>
    requestWithRetry<{ token: string; user: ApiUser }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify({ email, name }) },
      1 // 冷启动自动重试 1 次
    ),
  me: () => request<{ user: ApiUser }>("/api/auth/me"),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  listUsers: () => request<{ users: ApiUser[] }>("/api/users"),

  // annotations
  listAnnotations: (targetPath?: string) =>
    request<{ annotations: ApiAnnotation[] }>(
      targetPath ? `/api/annotations?targetPath=${encodeURIComponent(targetPath)}` : "/api/annotations"
    ),
  createAnnotation: (payload: {
    targetPath: string;
    blockId: string;
    quote: string;
    initialComment?: string;
  }) =>
    request<{ annotations: ApiAnnotation[] }>("/api/annotations", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteAnnotation: (id: string) =>
    request<{ ok: boolean }>(`/api/annotations/${id}`, { method: "DELETE" }),

  // comments
  createComment: (annId: string, body: string, parentId?: string) =>
    request<{ annotations: ApiAnnotation[] }>(`/api/annotations/${annId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body, parentId }),
    }),
  toggleReaction: (annId: string, commentId: string, emoji: string) =>
    request<{ annotations: ApiAnnotation[] }>(
      `/api/annotations/${annId}/comments/${commentId}/reactions`,
      { method: "POST", body: JSON.stringify({ emoji }) }
    ),

  // builders
  recordVisit: (handle: string) =>
    request<{ ok: boolean }>("/api/builders/visit", {
      method: "POST",
      body: JSON.stringify({ handle }),
    }),
  topBuilders: (days = 30, limit = 10) =>
    request<{ top: { handle: string; visits: number; lastAt: number }[] }>(
      `/api/builders/top?days=${days}&limit=${limit}`
    ),

  // follows
  listFollows: () => request<{ handles: string[] }>("/api/follows"),
  toggleFollow: (handle: string) =>
    request<{ following: boolean }>("/api/follows/toggle", {
      method: "POST",
      body: JSON.stringify({ handle }),
    }),
};
