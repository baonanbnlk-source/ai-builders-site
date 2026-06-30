import { Link } from "react-router-dom";
import type { Builder } from "@/data/types";
import { CATEGORY_MAP } from "@/data/builders";
import { avatarUrl } from "@/lib/format";

interface BuilderCardProps {
  builder: Builder;
  todayCount?: number;
  compact?: boolean;
}

export default function BuilderCard({ builder, todayCount, compact }: BuilderCardProps) {
  const cat = CATEGORY_MAP[builder.category];
  return (
    <Link
      to={`/builders/${builder.handle}`}
      className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <img
          src={avatarUrl(builder.avatarSeed, 64)}
          alt={builder.displayName}
          className="h-12 w-12 rounded-full bg-slate-100"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold text-slate-800 group-hover:text-indigo-600">
            {builder.displayName}
          </div>
          <div className="truncate text-xs text-slate-400">@{builder.handle}</div>
        </div>
        <span className={`rounded-full ${cat.color} ${cat.textColor} px-2 py-0.5 text-[10px] font-medium whitespace-nowrap`}>
          {cat.label}
        </span>
      </div>
      {!compact && (
        <p className="text-[13px] leading-relaxed text-slate-600 line-clamp-3">{builder.bio}</p>
      )}
      <div className="mt-auto flex items-center justify-between text-xs text-slate-500">
        <span className="rounded-md bg-slate-50 px-2 py-1">关注方向：{builder.focus}</span>
        <span>
          {typeof todayCount === "number" ? (
            todayCount > 0 ? <span className="text-emerald-600">今日 {todayCount} 条</span> : <span className="text-slate-400">今日无更新</span>
          ) : null}
        </span>
      </div>
    </Link>
  );
}
