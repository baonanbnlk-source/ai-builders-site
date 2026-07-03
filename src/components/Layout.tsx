import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import UserSwitcher from "./UserSwitcher";
import SearchBar from "./SearchBar";
import LoginDialog from "./LoginDialog";
import { LOGIN_OPEN_EVENT } from "@/lib/auth";

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
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        {/* Row 1 · Masthead: left meta / centered serif logo / right meta */}
        <div className="mx-auto max-w-[1280px] px-6 pt-4 pb-3 border-b border-slate-200/70">
          <div className="grid grid-cols-[minmax(140px,1fr)_auto_minmax(140px,1fr)] items-center gap-4">
            <div className="text-[10.5px] uppercase tracking-[0.22em] text-slate-500 leading-tight">
              {new Date().toISOString().slice(0, 10).split("-").join(" · ")}
              <br />
              <span className="text-slate-400">
                {new Date().toLocaleDateString("en-US", { weekday: "short" })} · Daily Dispatch
              </span>
            </div>
            <Link to="/" className="flex flex-col items-center leading-none group">
              <span className="mb-1 text-[10.5px] uppercase tracking-[0.28em] text-slate-500">
                Est. 2026 · Team Edition
              </span>
              <span
                className="flex items-baseline gap-2 font-[700] tracking-tight text-slate-900 group-hover:opacity-90"
                style={{ fontFamily: "'Fraunces', serif" }}
              >
                <span className="text-[28px] leading-none font-[800]">AI Builders</span>
                <span
                  className="text-[28px] leading-none font-[700] italic"
                  style={{ color: "#c26949" }}
                >
                  Daily
                </span>
              </span>
            </Link>
            <div className="text-right text-[10.5px] uppercase tracking-[0.18em] text-slate-500 leading-tight">
              Created by <span className="text-slate-800 font-semibold not-italic tracking-[0.05em]">Bao Nan</span>
              <br />
              <span className="text-slate-400">
                Sources <span className="text-slate-700 font-medium not-italic tracking-[0.05em]">Zara Zhang</span>
              </span>
            </div>
          </div>
        </div>

        {/* Row 2 · Underline tabs + search + avatar */}
        <div className="mx-auto max-w-[1280px] px-6">
          <div className="flex h-12 items-center justify-between gap-6">
            <nav className="flex items-center gap-6 text-sm h-full">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    `relative flex h-full items-center border-b-2 pt-[2px] font-medium transition ${
                      isActive
                        ? "border-indigo-600 text-indigo-700 font-semibold"
                        : "border-transparent text-slate-600 hover:text-slate-900"
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
            <div className="flex items-center gap-3">
              <SearchBar initial={initialQuery} />
              <UserSwitcher />
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-6 py-8">
        <Outlet />
      </main>
      <footer className="mt-12 border-t border-slate-200 bg-white/60 py-6 text-center text-xs text-slate-400">
        AI Builders Daily · Created by Bao Nan · Sources: Zara Zhang · {new Date().getFullYear()}
      </footer>
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
