import { useEffect, useMemo, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { findBuilder, CATEGORY_MAP } from "@/data/builders";
import { useFeed } from "@/lib/FeedProvider";
import { tweetsByHandle } from "@/lib/feed";
import { avatarUrl, formatDateTime } from "@/lib/format";
import TweetCard from "@/components/TweetCard";
import AnnotatableText from "@/components/AnnotatableText";
import { recordBuilderVisit, useAnnotations, useFollowedHandles } from "@/lib/storage";
import { ExternalLink, Heart, Repeat2, MessageSquare } from "lucide-react";
import { filterTweets, makeHighlightLine } from "@/lib/highlights";
import { translateTweet } from "@/lib/translate";

type Tab = "summary" | "timeline" | "team";

export default function BuilderDetail() {
  const { handle } = useParams<{ handle: string }>();
  const builder = handle ? findBuilder(handle) : undefined;
  const { todayTweets, digests } = useFeed();
  const [tab, setTab] = useState<Tab>("summary");
  const [follows, toggleFollow] = useFollowedHandles();

  // history collection: pull all tweets for this handle across 30-day digests
  const monthTweets = useMemo(() => {
    if (!builder) return [];
    const all = digests.flatMap((d) => tweetsByHandle(d.tweets, builder.handle));
    all.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return all;
  }, [digests, builder]);

  const todayCount = useMemo(() => (builder ? tweetsByHandle(todayTweets, builder.handle).length : 0), [todayTweets, builder]);

  // 页头 badge "本机已标注 N 处": 保留原语义 (只算当前博主详情页上的标注)
  const annotations = useAnnotations((a) => a.targetPath === `/builders/${builder?.handle}`);

  // 收集这位 builder 名下的全部 tweet ID (用于团队讨论 Tab 里，把在「今日」「历史」
  // 等页面上对这条 tweet 打的标注也识别为「针对该 builder」的讨论)。
  const builderTweetIds = useMemo(() => {
    const ids = new Set<string>();
    if (!builder) return ids;
    for (const t of todayTweets) {
      if (t.handle.toLowerCase() === builder.handle.toLowerCase()) ids.add(t.id);
    }
    for (const d of digests) {
      for (const t of d.tweets) {
        if (t.handle.toLowerCase() === builder.handle.toLowerCase()) ids.add(t.id);
      }
    }
    return ids;
  }, [builder, todayTweets, digests]);

  // 团队讨论 Tab: 拉全站标注、按 builder 相关性过滤 (支持在文摘/时间线/详情页所有地方
  // 讨论到这个 builder 的都在此汇总)。判定规则:
  //   1. targetPath 精确等于 /builders/{handle} (来自博主详情页)
  //   2. 或 blockId 中含 handle 片段 (来自 BuilderDetail timeline 的 builder-{handle}- 前缀 / 观点块)
  //   3. 或 blockId 中含 builder 名下任何一条 tweet 的 ID (覆盖「今日」「历史」「按日期文摘」等页面
  //      里对该 builder tweet 打的标注 —— 它们的 blockId 形如 today-tweet-<tid>-en /
  //      2026-07-01-<tid>-zh / digest-<date>-<tid>-hl 等)
  // 目的: 让"团队讨论"真实反映"团队对 @handle 的讨论"，而不是只有 profile 页那一小撮。
  const teamAnnotations = useAnnotations((a) => {
    const h = builder?.handle;
    if (!h) return false;
    if (a.targetPath === `/builders/${h}`) return true;
    const bid = a.blockId || "";
    // handle 命中 (BuilderDetail 页面上的标注)
    if (
      bid === `builder-${h}` ||
      bid.startsWith(`builder-${h}-`) ||
      bid.includes(`-${h}-`) ||
      bid.endsWith(`-${h}`)
    ) {
      return true;
    }
    // tweet ID 命中 (今日/历史/文摘页对该 builder 的 tweet 打的标注)
    for (const tid of builderTweetIds) {
      if (!tid) continue;
      if (bid.includes(`-${tid}-`) || bid.includes(`-${tid}`) || bid === tid) {
        return true;
      }
    }
    return false;
  });

  // Record a visit when this profile mounts (per builder, per mount).
  useEffect(() => {
    if (builder?.handle) recordBuilderVisit(builder.handle);
  }, [builder?.handle]);

  if (!builder) return <Navigate to="/builders" replace />;

  const cat = CATEGORY_MAP[builder.category];
  const isFollowed = follows.includes(builder.handle);

  const keyTakeaways = makeKeyTakeaways(monthTweets, builder.displayName, builder.handle);

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="h-28 bg-gradient-to-r from-indigo-100 via-sky-100 to-emerald-100" />
        <div className="-mt-12 flex flex-wrap items-end gap-5 px-6 pb-6">
          <img
            src={avatarUrl(builder.avatarSeed, 120)}
            className="h-24 w-24 rounded-2xl border-4 border-white bg-white shadow"
            alt={builder.displayName}
          />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{builder.displayName}</h1>
              <span className={`rounded-full ${cat.color} ${cat.textColor} px-2 py-0.5 text-xs font-medium`}>{cat.label}</span>
              <span className="text-sm text-slate-500">@{builder.handle}</span>
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{builder.bio}</p>
            <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
              <span>📌 关注方向：{builder.focus}</span>
              <span>·</span>
              <span>近 30 天 {monthTweets.length} 条，今日 {todayCount} 条</span>
              {annotations.length > 0 && <><span>·</span><span>本机已标注 {annotations.length} 处</span></>}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href={builder.xUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm hover:bg-slate-50"
            >
              <ExternalLink className="h-4 w-4" /> X 主页
            </a>
            <button
              onClick={() => toggleFollow(builder.handle)}
              className={`rounded-full px-4 py-2 text-sm font-medium shadow-sm transition ${
                isFollowed
                  ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  : "bg-indigo-600 text-white hover:bg-indigo-700"
              }`}
            >
              {isFollowed ? "已关注" : "+ 关注"}
            </button>
          </div>
        </div>
      </header>

      <nav className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm shadow-sm">
        <TabBtn active={tab === "summary"} onClick={() => setTab("summary")}>近一月主要观点</TabBtn>
        <TabBtn active={tab === "timeline"} onClick={() => setTab("timeline")}>原始动态时间线</TabBtn>
        <TabBtn active={tab === "team"} onClick={() => setTab("team")}>团队讨论</TabBtn>
      </nav>

      {tab === "summary" && (
        <section className="space-y-4">
          {keyTakeaways.length === 0 ? (
            <EmptyTab tip="近 30 天没有抓到该 builder 的 tweet。" />
          ) : (
            keyTakeaways.map((k, idx) => (
              <article key={idx} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">观点 {idx + 1}</span>
                  <span className="text-slate-400">(基于 {k.sources.length} 条信源)</span>
                </div>
                <AnnotatableText
                  blockId={`summary-${builder.handle}-${idx}`}
                  sourceLabel={`@${builder.handle} · 近一月观点 ${idx + 1}`}
                  className="mt-3 text-[15px] leading-relaxed text-slate-800"
                >
                  {k.point}
                </AnnotatableText>
                <div className="mt-3 flex flex-wrap gap-2">
                  {k.sources.map((s) => (
                    <a
                      key={s.id}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-200"
                    >
                      <ExternalLink className="h-3 w-3" /> {s.date}
                    </a>
                  ))}
                </div>
              </article>
            ))
          )}
        </section>
      )}

      {tab === "timeline" && (
        <section className="space-y-4">
          {monthTweets.length === 0 && <EmptyTab tip="近 30 天没有该 builder 的动态。" />}
          {monthTweets.map((t) => (
            <TweetCard key={t.id} tweet={t} blockIdPrefix={`builder-${builder.handle}`} showAuthor={false} />
          ))}
        </section>
      )}

      {tab === "team" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-800">团队对 @{builder.handle} 的讨论</h3>
          <p className="mt-1 text-sm text-slate-500">下面汇总了整站里团队对 @{builder.handle} 相关内容的所有标注与回复。在「近一月观点」和「时间线」中选中文本即可创建新的讨论。</p>
          <div className="mt-4 space-y-3">
            {teamAnnotations.length === 0 ? (
              <EmptyTab tip={`@${builder.handle} 还没有讨论，去其他 Tab 划一段话开个头吧～`} />
            ) : (
              teamAnnotations.map((a) => (
                <div key={a.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">「{a.quote}」</div>
                  <div className="mt-2 space-y-2">
                    {a.comments.map((c) => (
                      <div key={c.id} className="text-sm text-slate-700">
                        <span className="text-xs text-slate-400">{formatDateTime(new Date(c.createdAt).toISOString())}</span>
                        <div>{c.body}</div>
                      </div>
                    ))}
                    {a.comments.length === 0 && (
                      <div className="text-xs text-slate-400">仅标注，未附评论。</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* small tweet stats card */}
      {monthTweets.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold">最近 30 天互动概览</h3>
          <div className="mt-2 grid grid-cols-3 gap-4 text-center">
            <Stat icon={<Heart className="h-4 w-4 text-rose-500" />} label="累计点赞" value={sum(monthTweets, "likes")} />
            <Stat icon={<Repeat2 className="h-4 w-4 text-emerald-500" />} label="累计转发" value={sum(monthTweets, "retweets")} />
            <Stat icon={<MessageSquare className="h-4 w-4 text-sky-500" />} label="累计回复" value={sum(monthTweets, "replies")} />
          </div>
        </section>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 transition ${
        active ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <div className="flex items-center justify-center gap-1 text-xs text-slate-500">{icon} {label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-800">{value.toLocaleString()}</div>
    </div>
  );
}

function EmptyTab({ tip }: { tip: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">{tip}</div>;
}

function sum<T extends { [k: string]: any }>(list: T[], key: keyof T): number {
  return list.reduce((a, b) => a + Number(b[key] ?? 0), 0);
}

interface KeyTakeaway {
  point: string;
  sources: { id: string; date: string; url: string }[];
}

function makeKeyTakeaways(
  tweets: { id: string; text: string; createdAt: string; url: string; handle: string; likes: number; retweets: number; replies: number; isQuote: boolean; quotedTweetId: string | null }[],
  name: string,
  handle: string
): KeyTakeaway[] {
  if (tweets.length === 0) return [];
  // Use the same scoring as the digest so summaries are based on real high-signal tweets.
  const scored = filterTweets(tweets as any);
  if (scored.length === 0) {
    // fall back to taking the longest tweet per bucket so the UI is not empty
    const buckets: typeof tweets[] = [];
    const target = Math.min(5, Math.max(3, Math.ceil(tweets.length / 4)));
    const size = Math.ceil(tweets.length / target);
    for (let i = 0; i < tweets.length; i += size) buckets.push(tweets.slice(i, i + size));
    return buckets.slice(0, 5).map((bucket, idx) => {
      const seed = bucket[0];
      const summary = seed ? translateTweet(seed.id, seed.text) : "";
      const trimmed = summary.replace(/^（暂未翻译[^）]*）：?/, "").slice(0, 120);
      return {
        point: `${name} 在近一月发声中提到：${trimmed}（第 ${idx + 1} 组观察）`,
        sources: bucket.slice(0, 3).map((t) => ({ id: t.id, date: t.createdAt.slice(0, 10), url: t.url })),
      };
    });
  }
  // Group scored tweets into up to 5 "themes" by sliding window
  const themes: typeof scored[] = [];
  const targetThemes = Math.min(5, Math.max(3, Math.ceil(scored.length / 3)));
  const size = Math.ceil(scored.length / targetThemes);
  for (let i = 0; i < scored.length; i += size) themes.push(scored.slice(i, i + size));
  return themes.slice(0, 5).map((theme, idx) => {
    const lead = theme[0];
    const line = makeHighlightLine({
      text: lead.tweet.text,
      hits: lead.hits,
      handle,
    }).replace(/^📌\s*/, "");
    return {
      point: `${name} 的核心观点 ${idx + 1}：${line}。覆盖 ${theme.length} 条真实推文，最高分 ${lead.score.toFixed(1)}。`,
      sources: theme.slice(0, 3).map((s) => ({
        id: s.tweet.id,
        date: s.tweet.createdAt.slice(0, 10),
        url: s.tweet.url,
      })),
    };
  });
}
