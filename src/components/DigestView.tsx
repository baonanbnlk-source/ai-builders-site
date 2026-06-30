import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { Tweet } from "@/data/types";
import { BUILDERS, CATEGORIES, findBuilder } from "@/data/builders";
import {
  buildBuilderBriefs,
  filterTweets,
  makeHighlightLine,
  pickTopFocus,
} from "@/lib/highlights";
import { avatarUrl, formatDateTime } from "@/lib/format";
import { translateTweet, getQuoteSummary, hasRealTranslation } from "@/lib/translate";
import AnnotatableText from "@/components/AnnotatableText";
import { ExternalLink, Flame, Heart, Repeat2, MessageSquare } from "lucide-react";

interface DigestViewProps {
  date: string; // 2026-06-25
  tweets: Tweet[]; // raw tweets for that day
  isToday?: boolean;
  /** override the targetPath used for annotations (so home and /digest/today share the same annotations) */
  targetPath?: string;
  /** prefix for annotation blockIds (must be stable across home / digest) */
  blockIdPrefix?: string;
  /** custom heading */
  title?: string;
  /** show stats banner */
  showHero?: boolean;
}

/**
 * High quality AI-industry briefing view.  Renders:
 *   - Top 3 focuses banner
 *   - Per category sticky section header
 *   - Per builder card with takeaway + 1-3 highlight tweets
 * Builders with zero highlights are *not* rendered.
 */
export default function DigestView({
  date,
  tweets,
  isToday,
  targetPath,
  blockIdPrefix = "digest",
  title,
  showHero = true,
}: DigestViewProps) {
  const scored = useMemo(() => filterTweets(tweets), [tweets]);
  const briefs = useMemo(() => buildBuilderBriefs(scored), [scored]);
  const topFocus = useMemo(() => pickTopFocus(scored, 3), [scored]);

  const briefsByCategory = useMemo(() => {
    const map = new Map<string, typeof briefs>();
    for (const c of CATEGORIES) map.set(c.id, []);
    for (const b of briefs) {
      const builder = findBuilder(b.handle);
      const catId = builder?.category ?? "official";
      const arr = map.get(catId) ?? [];
      arr.push(b);
      map.set(catId, arr);
    }
    return map;
  }, [briefs]);

  return (
    <div className="space-y-8">
      {showHero && (
        <header className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-indigo-50/40 to-emerald-50/30 p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-indigo-600 shadow-sm">
              <Flame className="h-3 w-3" /> AI 行业要闻精选
            </span>
            <span>{date}</span>
            {isToday && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">今日</span>}
            <span className="text-slate-400">·</span>
            <span>原文 {tweets.length} 条 → 精选 {scored.length} 条 / {briefs.length} 位 builder</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-[34px]">
            {title ?? (isToday ? "今日 AI Builders 简报" : `${date} AI Builders 简报`)}
          </h1>
          <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-slate-700">
            过滤掉无意义转发 / 闲聊 / 与 AI 无关的内容后，下面是基于真实 X 动态生成的 AI 行业要闻精选。每位
            builder 只保留 1–3 条高分 highlight，配上一句话要点、英文原文与人工中文翻译。
          </p>
        </header>
      )}

      {topFocus.length > 0 && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Flame className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-amber-700">今日三大焦点</h2>
            <span className="text-[11px] text-amber-700/70">基于关键词评分的跨 builder 最高分推文</span>
          </div>
          <ol className="space-y-2">
            {topFocus.map((s, idx) => {
              const b = findBuilder(s.tweet.handle);
              return (
                <li key={s.tweet.id}>
                  <a
                    href={`#brief-${s.tweet.handle}`}
                    className="flex items-start gap-3 rounded-2xl bg-white/80 p-3 shadow-sm transition hover:bg-white"
                  >
                    <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-full bg-amber-200 text-xs font-bold text-amber-800">
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-800">
                        {makeHighlightLine({
                          text: s.tweet.text,
                          hits: s.hits,
                          handle: s.tweet.handle,
                        }).replace(/^📌\s*/, "")}
                      </div>
                      <div className="mt-1 text-[12px] text-slate-500 line-clamp-1">
                        ❝ {s.tweet.text.replace(/https?:\/\/\S+/g, "")}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        @{s.tweet.handle}
                        {b ? ` · ${b.displayName}` : ""} · 评分 {s.score.toFixed(1)}
                      </div>
                    </div>
                  </a>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {briefs.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-400">
          这一天暂时没有抓到符合精选条件的 builder 动态。
        </div>
      )}

      {CATEGORIES.map((cat) => {
        const items = briefsByCategory.get(cat.id) ?? [];
        if (items.length === 0) return null;
        return (
          <section key={cat.id} id={`cat-${cat.id}`} className="scroll-mt-20">
            <div
              className={`sticky top-14 z-[5] -mx-2 mb-4 flex items-center gap-3 rounded-full ${cat.color} ${cat.textColor} px-4 py-2 text-xs font-medium shadow-sm backdrop-blur`}
            >
              <span>{cat.label}</span>
              <span className="text-[11px] opacity-75">
                {items.length} 位 builder · {items.reduce((s, b) => s + b.highlights.length, 0)} 条 highlight
              </span>
            </div>
            <div className="space-y-5">
              {items.map((b) => {
                const builder = findBuilder(b.handle);
                if (!builder) return null;
                return (
                  <article
                    key={b.handle}
                    id={`brief-${b.handle}`}
                    className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <img
                        src={avatarUrl(builder.avatarSeed, 56)}
                        alt={builder.displayName}
                        className="h-10 w-10 rounded-full bg-slate-100"
                      />
                      <div className="flex-1">
                        <Link
                          to={`/builders/${builder.handle}`}
                          className="text-base font-semibold text-slate-800 hover:text-indigo-600"
                        >
                          {builder.displayName}
                        </Link>
                        <div className="text-xs text-slate-400">@{builder.handle} · {builder.focus}</div>
                      </div>
                      <span className={`rounded-full ${cat.color} ${cat.textColor} px-2 py-0.5 text-[10px] font-medium`}>{cat.label}</span>
                      <a
                        href={builder.xUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700"
                      >
                        <ExternalLink className="h-3 w-3" /> X
                      </a>
                    </div>

                    <div className="mt-3 rounded-xl bg-indigo-50/60 px-4 py-3">
                      <AnnotatableText
                        blockId={`${blockIdPrefix}-${date}-takeaway-${b.handle}`}
                        targetPath={targetPath}
                        sourceLabel={`@${b.handle} · ${date} 要点`}
                        className="text-sm leading-relaxed text-slate-700"
                      >
                        {b.takeawayLine}
                      </AnnotatableText>
                    </div>

                    <ul className="mt-4 space-y-4">
                      {b.highlights.map((s) => {
                        const t = s.tweet;
                        return (
                          <li
                            key={t.id}
                            className="rounded-xl border border-slate-100 bg-slate-50/40 p-3"
                          >
                            <AnnotatableText
                              blockId={`${blockIdPrefix}-${date}-${t.id}-hl`}
                              targetPath={targetPath}
                              sourceLabel={`@${t.handle} · highlight 提炼`}
                              className="text-[13px] font-medium text-slate-800"
                            >
                              {makeHighlightLine({ text: t.text, hits: s.hits, handle: t.handle })}
                            </AnnotatableText>
                            <div className="mt-2 rounded-md border-l-2 border-slate-200 bg-white px-3 py-2">
                              <AnnotatableText
                                blockId={`${blockIdPrefix}-${date}-${t.id}-en`}
                                targetPath={targetPath}
                                sourceLabel={`@${t.handle} · ${formatDateTime(t.createdAt)}`}
                                className="whitespace-pre-wrap text-[12.5px] italic leading-relaxed text-slate-500"
                              >
                                {`❝ ${t.text.replace(/https?:\/\/t\.co\/\S+/g, "").trim()}`}
                              </AnnotatableText>
                            </div>
                            <div className="mt-2">
                              <AnnotatableText
                                blockId={`${blockIdPrefix}-${date}-${t.id}-zh`}
                                targetPath={targetPath}
                                sourceLabel={`@${t.handle} · 中文翻译`}
                                className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-slate-700"
                              >
                                {translateTweet(t.id, t.text)}
                              </AnnotatableText>
                              <div className="mt-1 text-[11px] uppercase tracking-wider text-slate-400">
                                {hasRealTranslation(t.id) ? "中文翻译" : "暂未翻译"}
                              </div>
                            </div>
                            {(() => {
                              const qs = getQuoteSummary(t.id);
                              if (!qs) return null;
                              return (
                                <div className="mt-2 rounded-lg bg-slate-100/80 px-3 py-2 text-[12.5px] leading-relaxed text-slate-600">
                                  <div className="mb-1 text-[11px] font-medium text-slate-500">📎 被转内容核心结论</div>
                                  <div>{qs}</div>
                                </div>
                              );
                            })()}
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                              <span className="inline-flex items-center gap-1">
                                <Heart className="h-3 w-3" /> {t.likes}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Repeat2 className="h-3 w-3" /> {t.retweets}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" /> {t.replies}
                              </span>
                              <span>{formatDateTime(t.createdAt)}</span>
                              <a
                                href={t.url}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-auto inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700"
                              >
                                <ExternalLink className="h-3 w-3" /> 原文
                              </a>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">分 {s.score.toFixed(1)}</span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Show non-active categories at the bottom for transparency */}
      {briefs.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            未上榜的分类
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.filter((c) => (briefsByCategory.get(c.id)?.length ?? 0) === 0).map((c) => {
              const cnt = BUILDERS.filter((b) => b.category === c.id).length;
              return (
                <span
                  key={c.id}
                  className={`rounded-full ${c.color} ${c.textColor} px-3 py-1 text-[11px]`}
                >
                  {c.label}（{cnt} 位 builder 今日无高分 highlight）
                </span>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
