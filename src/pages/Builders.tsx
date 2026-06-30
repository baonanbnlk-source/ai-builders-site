import { useMemo, useState } from "react";
import { BUILDERS, CATEGORIES, buildersByCategory } from "@/data/builders";
import BuilderCard from "@/components/BuilderCard";
import { useFeed } from "@/lib/FeedProvider";
import type { Category } from "@/data/types";

export default function Builders() {
  const { todayTweets } = useFeed();
  const [filter, setFilter] = useState<Category | "all">("all");
  const [q, setQ] = useState("");

  const todayByHandle = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of todayTweets) map.set(t.handle, (map.get(t.handle) ?? 0) + 1);
    return map;
  }, [todayTweets]);

  const grouped = useMemo(() => buildersByCategory(), []);
  const search = q.trim().toLowerCase();

  const visibleByCat = useMemo(() => {
    const out: Record<string, typeof BUILDERS> = {};
    for (const c of CATEGORIES) {
      if (filter !== "all" && filter !== c.id) continue;
      out[c.id] = grouped[c.id].filter((b) => {
        if (!search) return true;
        return (
          b.handle.toLowerCase().includes(search) ||
          b.displayName.toLowerCase().includes(search) ||
          b.aliases.some((a) => a.toLowerCase().includes(search)) ||
          b.bio.toLowerCase().includes(search)
        );
      });
    }
    return out;
  }, [filter, search, grouped]);

  const totalShown = Object.values(visibleByCat).reduce((a, b) => a + b.length, 0);

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">26 位 AI Builders</h1>
        <p className="mt-1 text-sm text-slate-500">按 6 大分类编排，鼠标悬停查看背景，点击进入主页查看完整观点。</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-xs shadow-sm">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>全部 ({BUILDERS.length})</FilterChip>
            {CATEGORIES.map((c) => (
              <FilterChip key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)}>
                {c.label} ({grouped[c.id].length})
              </FilterChip>
            ))}
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="按姓名 / handle / 中文别名搜索"
            className="ml-auto w-64 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          <span className="text-xs text-slate-400">命中 {totalShown} 人</span>
        </div>
      </header>

      <div className="space-y-10">
        {CATEGORIES.map((cat) => {
          const list = visibleByCat[cat.id];
          if (!list || list.length === 0) return null;
          return (
            <section key={cat.id}>
              <div className="mb-3 flex items-center gap-2">
                <span className={`rounded-full ${cat.color} ${cat.textColor} px-3 py-1 text-xs font-medium`}>{cat.label}</span>
                <span className="text-xs text-slate-400">{cat.description}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((b) => (
                  <BuilderCard key={b.handle} builder={b} todayCount={todayByHandle.get(b.handle) ?? 0} />
                ))}
              </div>
            </section>
          );
        })}
        {totalShown === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-200 p-12 text-center text-slate-400">
            没有匹配的 builder，试试其他关键词。
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 transition ${
        active ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
