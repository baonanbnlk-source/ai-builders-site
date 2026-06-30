// Module-level user cache so legacy synchronous getUserById(id) keeps working.
// Loaded from /api/users on app boot and after every relevant API response.

import type { ApiUser } from "./api";
import { api } from "./api";

const COLOR_TO_BG: Record<string, { underline: string; bg: string }> = {
  "text-indigo-700": { underline: "rgba(79,70,229,0.65)", bg: "rgba(79,70,229,0.14)" },
  "text-rose-700": { underline: "rgba(225,29,72,0.65)", bg: "rgba(225,29,72,0.12)" },
  "text-emerald-700": { underline: "rgba(5,150,105,0.65)", bg: "rgba(5,150,105,0.12)" },
  "text-amber-700": { underline: "rgba(217,119,6,0.65)", bg: "rgba(217,119,6,0.14)" },
  "text-sky-700": { underline: "rgba(2,132,199,0.65)", bg: "rgba(2,132,199,0.12)" },
  "text-fuchsia-700": { underline: "rgba(192,38,211,0.65)", bg: "rgba(192,38,211,0.12)" },
  "text-cyan-700": { underline: "rgba(8,145,178,0.65)", bg: "rgba(8,145,178,0.12)" },
  "text-violet-700": { underline: "rgba(124,58,237,0.65)", bg: "rgba(124,58,237,0.12)" },
};

export type DisplayUser = {
  id: string;
  email: string;
  name: string;
  emoji: string;
  color: string; // tailwind text class
  underlineColor: string;
  bgColor: string;
};

const store = new Map<string, DisplayUser>();
const listeners = new Set<() => void>();

function decorate(u: ApiUser): DisplayUser {
  const colorBg = COLOR_TO_BG[u.color] ?? { underline: "rgba(71,85,105,0.6)", bg: "rgba(71,85,105,0.12)" };
  return {
    id: String(u.id),
    email: u.email,
    name: u.name,
    emoji: u.emoji || "👤",
    color: u.color || "text-slate-700",
    underlineColor: colorBg.underline,
    bgColor: colorBg.bg,
  };
}

export function upsertUser(u: ApiUser) {
  store.set(String(u.id), decorate(u));
  notify();
}

export function upsertUsers(us: ApiUser[]) {
  for (const u of us) store.set(String(u.id), decorate(u));
  notify();
}

export function getUserById(id: string): DisplayUser {
  return (
    store.get(String(id)) ?? {
      id: String(id),
      email: "",
      name: id ? `用户 ${id}` : "未登录",
      emoji: "👤",
      color: "text-slate-700",
      underlineColor: "rgba(71,85,105,0.6)",
      bgColor: "rgba(71,85,105,0.12)",
    }
  );
}

export function allUsers(): DisplayUser[] {
  return Array.from(store.values()).sort((a, b) => Number(a.id) - Number(b.id));
}

function notify() {
  for (const l of listeners) l();
}

export function subscribeUsers(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export async function refreshUsers() {
  try {
    const { users } = await api.listUsers();
    upsertUsers(users);
  } catch {
    /* ignore */
  }
}
