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

const REQUEST_TIMEOUT_MS = 15000;

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  const tok = getToken();
  if (tok) headers["Authorization"] = `Bearer ${tok}`;

  // Abort the request if the backend (e.g. FaaS cold start) is too slow, so the
  // UI never hangs forever on "登录中…" / boot loading.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...opts, headers, signal: controller.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("请求超时，请稍后重试");
    }
    throw new Error("网络异常，请检查连接后重试");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401) {
    setToken(null);
    throw new Error("未登录或登录已失效");
  }
  if (!res.ok) {
    let detail = "请求失败";
    try {
      const j = await res.json();
      detail = j.detail || JSON.stringify(j);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export const api = {
  // auth
  login: (email: string, name?: string) =>
    request<{ token: string; user: ApiUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, name }),
    }),
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
