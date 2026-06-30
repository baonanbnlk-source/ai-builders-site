import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import UserSwitcher from "./UserSwitcher";
import SearchBar from "./SearchBar";
import LoginDialog from "./LoginDialog";
import { LOGIN_OPEN_EVENT } from "@/lib/auth";
import { Sparkles } from "lucide-react";

const NAV_LINKS = [
  { to: "/", label: "今日", end: true },
  { to: "/digest", label: "历史" },
  { to: "/builders", label: "博主" },
  { to: "/discussions", label: "讨论" },
  { to: "/me", label: "我的" },
];

export default function Layout() {
  const location = useLocation();
  const initialQuery = new URLSearchParams(
    location.pathname === "/search" ? location.search : ""
  ).get("q") ?? "";

  // Single, globally-controlled login dialog. Any write-action entry point can
  // open it via openLoginDialog() (window event), no prop drilling needed.
  const [loginOpen, setLoginOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => setLoginOpen(true);
    window.addEventListener(LOGIN_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(LOGIN_OPEN_EVENT, onOpen);
  }, []);

  return (
    <div className="min-h-screen bg-[hsl(220,30%,98%)] text-slate-800">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-6 px-6">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-indigo-500 to-emerald-500 text-white shadow-sm">
              <Sparkles className="h-4 w-4" />
            </span>
            <span>AI Builders Daily</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 transition ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700 font-medium"
                      : "text-slate-600 hover:bg-slate-50"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <SearchBar initial={initialQuery} />
            <UserSwitcher />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-6 py-8">
        <Outlet />
      </main>
      <footer className="mt-12 border-t border-slate-200 bg-white/60 py-6 text-center text-xs text-slate-400">
        AI Builders Daily · 内部协作原型 · 数据来自 follow-builders feed-x.json · {new Date().getFullYear()}
      </footer>
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
