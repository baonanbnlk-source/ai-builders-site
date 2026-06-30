import { useEffect, useRef, useState } from "react";
import { useAuth, openLoginDialog } from "@/lib/auth";
import { ChevronDown, LogOut, LogIn, Loader2 } from "lucide-react";

export default function UserSwitcher() {
  const { user, isLoggedIn, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // During the initial me() boot we show a lightweight loading chip instead of
  // the login button, so a quick refresh doesn't flash "登录" / pop a dialog.
  if (loading && !user) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-400 shadow-sm">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> 加载中…
      </div>
    );
  }

  if (!isLoggedIn || !user) {
    return (
      <button
        onClick={() => openLoginDialog()}
        className="flex items-center gap-2 rounded-full bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
      >
        <LogIn className="h-3.5 w-3.5" /> 登录
      </button>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm hover:shadow transition"
      >
        <span className="text-lg leading-none">{user.emoji}</span>
        <span className={`${user.color} font-medium`}>{user.name}</span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          <div className="px-3 py-2">
            <div className="text-xs font-medium text-slate-700">{user.name}</div>
            <div className="text-[11px] text-slate-400">{user.email}</div>
          </div>
          <div className="h-px bg-slate-100" />
          <button
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <LogOut className="h-3.5 w-3.5" /> 退出登录
          </button>
        </div>
      )}
    </div>
  );
}
