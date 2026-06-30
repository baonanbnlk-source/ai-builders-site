import { Link } from "react-router-dom";
import type { Tweet } from "@/data/types";
import { findBuilder } from "@/data/builders";
import { avatarUrl, formatDateTime } from "@/lib/format";
import { Heart, Repeat2, MessageSquare, ExternalLink, Quote } from "lucide-react";
import { translateTweet, getQuoteSummary, hasRealTranslation } from "@/lib/translate";
import AnnotatableText from "./AnnotatableText";

interface TweetCardProps {
  tweet: Tweet;
  blockIdPrefix?: string; // e.g. "today" or "2026-06-25"
  showAuthor?: boolean;
}

export default function TweetCard({ tweet, blockIdPrefix = "today", showAuthor = true }: TweetCardProps) {
  const builder = findBuilder(tweet.handle);
  const cleanText = tweet.text.replace(/https?:\/\/t\.co\/\S+/g, "").trim();
  const zh = translateTweet(tweet.id, cleanText);
  const quoteSummary = getQuoteSummary(tweet.id);
  const real = hasRealTranslation(tweet.id);
  const blockId = `tweet-${tweet.id}`;
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      {showAuthor && builder && (
        <div className="mb-3 flex items-center gap-2">
          <img src={avatarUrl(builder.avatarSeed, 40)} alt={builder.displayName} className="h-8 w-8 rounded-full bg-slate-100" />
          <div className="flex-1">
            <Link to={`/builders/${builder.handle}`} className="text-sm font-semibold text-slate-800 hover:text-indigo-600">
              {builder.displayName}
            </Link>
            <div className="text-xs text-slate-400">@{builder.handle} · {formatDateTime(tweet.createdAt)}</div>
          </div>
        </div>
      )}
      <div className="rounded-xl border-l-2 border-slate-200 bg-slate-50/60 px-3 py-2">
        <AnnotatableText
          blockId={`${blockIdPrefix}-${blockId}-en`}
          sourceLabel={`@${tweet.handle} · ${formatDateTime(tweet.createdAt)}`}
          className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-600"
        >
          {cleanText || "(无文本)"}
        </AnnotatableText>
      </div>
      <div className="mt-2">
        <AnnotatableText
          blockId={`${blockIdPrefix}-${blockId}-zh`}
          sourceLabel={`@${tweet.handle} · 中文翻译`}
          className="whitespace-pre-wrap text-[14px] leading-relaxed text-slate-800"
        >
          {zh}
        </AnnotatableText>
        <div className="mt-1 text-[11px] uppercase tracking-wider text-slate-400">
          {real ? "中文翻译" : "暂未翻译"}
        </div>
      </div>
      {quoteSummary && (
        <div className="mt-2 rounded-lg bg-slate-100/80 px-3 py-2 text-[12.5px] leading-relaxed text-slate-600">
          <div className="mb-1 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
            <Quote className="h-3 w-3" /> 📎 被转内容核心结论
          </div>
          <div>{quoteSummary}</div>
        </div>
      )}
      <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" /> {tweet.likes}</span>
        <span className="inline-flex items-center gap-1"><Repeat2 className="h-3 w-3" /> {tweet.retweets}</span>
        <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {tweet.replies}</span>
        <a
          href={tweet.url}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700"
        >
          <ExternalLink className="h-3 w-3" /> 原文
        </a>
      </div>
    </article>
  );
}
