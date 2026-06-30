import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useFeed } from "@/lib/FeedProvider";
import DigestView from "@/components/DigestView";
import { formatDate, shiftDate } from "@/lib/format";
import { getDigestByDate, isoDate } from "@/lib/feed";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function DigestDate() {
  const params = useParams<{ date: string }>();
  const { todayTweets, generatedAt, digests, loading } = useFeed();

  const todayIso = isoDate(new Date(generatedAt));
  const dateParam = params.date === "today" || !params.date ? todayIso : params.date;
  const isToday = dateParam === todayIso;

  const digest = useMemo(() => {
    if (isToday) return { date: todayIso, tweets: todayTweets };
    const found = getDigestByDate(digests, dateParam);
    if (found) return found;
    return { date: dateParam, tweets: [] };
  }, [isToday, todayIso, todayTweets, digests, dateParam]);

  const dataMissing = !isToday && digest.tweets.length === 0;
  const prev = shiftDate(dateParam, -1);
  const next = shiftDate(dateParam, 1);

  if (loading) {
    return <div className="py-32 text-center text-slate-400">正在加载…</div>;
  }

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <Link
            to={`/digest/${prev}`}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 hover:bg-slate-50"
          >
            <ChevronLeft className="h-3 w-3" /> {prev}
          </Link>
          <Link
            to={`/digest/${next}`}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 hover:bg-slate-50"
          >
            {next} <ChevronRight className="h-3 w-3" />
          </Link>
          <Link
            to="/digest"
            className="ml-auto rounded-full px-3 py-1 text-indigo-600 hover:bg-indigo-50"
          >
            返回历史中心
          </Link>
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
          {isToday ? "今日" : formatDate(dateParam)} AI Builders 简报
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          原始 {digest.tweets.length} 条动态
          {!isToday && <span> · 来源：follow-builders 真实历史 commit</span>}
        </p>
      </header>

      {dataMissing ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-400">
          该日数据缺失（该日没有对应的 follow-builders feed-x.json commit）。
        </div>
      ) : (
        <DigestView
          date={dateParam}
          tweets={digest.tweets}
          isToday={isToday}
          targetPath={`/digest/${isToday ? "today" : dateParam}`}
          blockIdPrefix={isToday ? "today" : dateParam}
          showHero={false}
        />
      )}
    </div>
  );
}
