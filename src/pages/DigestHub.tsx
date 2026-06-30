import { useState } from "react";
import { Link } from "react-router-dom";
import { useFeed } from "@/lib/FeedProvider";
import { BUILDERS } from "@/data/builders";
import { formatDate, truncate } from "@/lib/format";
import { CalendarDays, LayoutList, Grid3x3 } from "lucide-react";

type ViewMode = "heatmap" | "list" | "matrix";

export default function DigestHub() {
  const { digests, loading } = useFeed();
  const [view, setView] = useState<ViewMode>("heatmap");

  if (loading) return <div className="py-24 text-center text-slate-400">加载历史…</div>;

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">历史简报中心</h1>
            <p className="mt-1 text-sm text-slate-500">最近 30 天 builder 动态 · 切换三种视图</p>
          </div>
          <div className="ml-auto inline-flex rounded-full border border-slate-200 bg-white p-1 text-xs shadow-sm">
            <ViewBtn icon={<CalendarDays className="h-3.5 w-3.5" />} active={view === "heatmap"} onClick={() => setView("heatmap")} label="热力图" />
            <ViewBtn icon={<LayoutList className="h-3.5 w-3.5" />} active={view === "list"} onClick={() => setView("list")} label="列表" />
            <ViewBtn icon={<Grid3x3 className="h-3.5 w-3.5" />} active={view === "matrix"} onClick={() => setView("matrix")} label="博主矩阵" />
          </div>
        </div>
      </header>

      {view === "heatmap" && <Heatmap digests={digests} />}
      {view === "list" && <ListView digests={digests} />}
      {view === "matrix" && <MatrixView digests={digests} />}
    </div>
  );
}

function ViewBtn({ icon, active, onClick, label }: { icon: React.ReactNode; active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 transition ${
        active ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      {icon} {label}
    </button>
  );
}

function colorFor(n: number, max: number): string {
  if (n === 0) return "bg-slate-100";
  const ratio = n / Math.max(1, max);
  if (ratio < 0.2) return "bg-indigo-100";
  if (ratio < 0.4) return "bg-indigo-200";
  if (ratio < 0.6) return "bg-indigo-300";
  if (ratio < 0.8) return "bg-indigo-400 text-white";
  return "bg-indigo-600 text-white";
}

function Heatmap({ digests }: { digests: { date: string; tweets: any[] }[] }) {
  const max = Math.max(...digests.map((d) => d.tweets.length));
  // Layout in 5 rows × 6 cols (30 days), newest at top-left
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid grid-cols-6 gap-3">
        {digests.map((d) => (
          <Link
            key={d.date}
            to={`/digest/${d.date}`}
            className={`flex aspect-square flex-col items-center justify-center rounded-xl p-2 text-center text-xs transition hover:scale-[1.02] hover:shadow ${colorFor(
              d.tweets.length,
              max
            )}`}
          >
            <div className="text-[11px] opacity-80">{d.date.slice(5)}</div>
            <div className="mt-1 text-base font-semibold">{d.tweets.length}</div>
            <div className="text-[10px] opacity-70">条</div>
          </Link>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-end gap-2 text-[11px] text-slate-500">
        <span>少</span>
        <span className="h-3 w-3 rounded bg-slate-100" />
        <span className="h-3 w-3 rounded bg-indigo-200" />
        <span className="h-3 w-3 rounded bg-indigo-400" />
        <span className="h-3 w-3 rounded bg-indigo-600" />
        <span>多</span>
      </div>
    </section>
  );
}

function ListView({ digests }: { digests: { date: string; tweets: any[] }[] }) {
  return (
    <section className="space-y-3">
      {digests.map((d) => {
        const handles = new Set(d.tweets.map((t) => t.handle));
        const preview = d.tweets[0]?.text ?? "";
        return (
          <Link
            key={d.date}
            to={`/digest/${d.date}`}
            className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-indigo-200 hover:shadow-md"
          >
            <div className="flex flex-wrap items-baseline gap-3">
              <h3 className="text-base font-semibold text-slate-800">{formatDate(d.date)}</h3>
              <span className="text-xs text-slate-500">{d.tweets.length} 条 · {handles.size} 位 builder</span>
              <span className="ml-auto text-xs text-indigo-600 group-hover:translate-x-1">查看 →</span>
            </div>
            <p className="mt-2 text-sm text-slate-600 line-clamp-2">
              {truncate(preview.replace(/https?:\/\/\S+/g, ""), 160) || "（无文本）"}
            </p>
          </Link>
        );
      })}
    </section>
  );
}

function MatrixView({ digests }: { digests: { date: string; tweets: any[] }[] }) {
  const handles = BUILDERS.map((b) => b.handle);
  const counts: Record<string, Record<string, number>> = {};
  for (const d of digests) {
    counts[d.date] = {};
    for (const t of d.tweets) {
      counts[d.date][t.handle] = (counts[d.date][t.handle] ?? 0) + 1;
    }
  }
  const max = Math.max(
    ...digests.flatMap((d) => handles.map((h) => counts[d.date]?.[h] ?? 0))
  );
  return (
    <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <table className="min-w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white px-2 py-1 text-left text-slate-500">Builder \ 日期</th>
            {digests.map((d) => (
              <th key={d.date} className="px-1 py-1 text-center text-[10px] font-medium text-slate-400">
                {d.date.slice(5)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {handles.map((h) => {
            const builder = BUILDERS.find((b) => b.handle === h)!;
            return (
              <tr key={h}>
                <th className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1 text-left">
                  <Link to={`/builders/${h}`} className="text-slate-700 hover:text-indigo-600">
                    {builder.displayName}
                  </Link>
                  <div className="text-[10px] text-slate-400">@{h}</div>
                </th>
                {digests.map((d) => {
                  const n = counts[d.date]?.[h] ?? 0;
                  return (
                    <td key={d.date} className="p-1">
                      <Link
                        to={`/digest/${d.date}`}
                        className={`grid h-6 w-6 place-items-center rounded ${colorFor(n, max)} text-[10px]`}
                        title={`${d.date} · ${n} 条`}
                      >
                        {n > 0 ? n : ""}
                      </Link>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
