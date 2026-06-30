import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BUILDERS, findBuilder } from "@/data/builders";
import { useFeed } from "@/lib/FeedProvider";
import { avatarUrl, formatDateTime, truncate } from "@/lib/format";

export default function SearchPage() {
  const [params] = useSearchParams();
  const q = (params.get("q") ?? "").trim();
  const ql = q.toLowerCase();
  const { todayTweets, digests } = useFeed();

  const result = useMemo(() => {
    if (!q) return { builders: [], tweets: [] as { tweet: any; date: string }[] };

    // direct handle match
    const exact = findBuilder(q.replace(/^@/, ""));
    const builders = BUILDERS.filter((b) => {
      if (exact && b.handle === exact.handle) return true;
      return (
        b.handle.toLowerCase().includes(ql) ||
        b.displayName.toLowerCase().includes(ql) ||
        b.aliases.some((a) => a.toLowerCase().includes(ql)) ||
        b.bio.toLowerCase().includes(ql) ||
        b.focus.toLowerCase().includes(ql)
      );
    });

    const allTweets = [...todayTweets, ...digests.slice(1).flatMap((d) => d.tweets.map((t) => ({ ...t, _date: d.date })))];
    const tweets = allTweets
      .filter((t) => t.text.toLowerCase().includes(ql) || t.handle.toLowerCase().includes(ql))
      .slice(0, 20)
      .map((t: any) => ({ tweet: t, date: t._date ?? t.createdAt.slice(0, 10) }));

    return { builders, tweets, exact };
  }, [q, ql, todayTweets, digests]);

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-xs text-slate-400">搜索结果</div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          {q ? `“${q}”` : "请输入关键词"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">命中 {result.builders.length} 位 builder · {result.tweets.length} 条推文片段（仅展示前 20 条）</p>
      </header>

      {result.builders.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Builder</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {result.builders.map((b) => (
              <Link
                key={b.handle}
                to={`/builders/${b.handle}`}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-200"
              >
                <img src={avatarUrl(b.avatarSeed, 48)} className="h-10 w-10 rounded-full bg-slate-100" alt="" />
                <div>
                  <div className="text-sm font-semibold text-slate-800">{b.displayName}</div>
                  <div className="text-xs text-slate-400">@{b.handle} · {b.focus}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {result.tweets.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">动态片段</h2>
          <div className="space-y-3">
            {result.tweets.map(({ tweet, date }) => (
              <Link
                key={tweet.id}
                to={`/digest/${date}`}
                className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-200"
              >
                <div className="text-xs text-slate-400">@{tweet.handle} · {formatDateTime(tweet.createdAt)} · {date}</div>
                <p className="mt-1 text-sm text-slate-700">{highlight(truncate(tweet.text.replace(/https?:\/\/\S+/g, ""), 200), ql)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {q && result.builders.length === 0 && result.tweets.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
          没有找到相关结果。可以试试 <Link to="/search?q=Claude" className="text-indigo-600">Claude</Link> · <Link to="/search?q=karpathy" className="text-indigo-600">karpathy</Link> · <Link to="/search?q=创业" className="text-indigo-600">创业</Link>
        </div>
      )}
    </div>
  );
}

function highlight(text: string, q: string): React.ReactNode {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q);
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-amber-200/60 px-0.5">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}
