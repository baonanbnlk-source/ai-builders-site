import type { Tweet, DailyDigest } from "@/data/types";
import { filterBlockedTweets } from "./contentFilter";

interface RawTweet {
  id: string;
  text: string;
  createdAt: string;
  url: string;
  likes: number;
  retweets: number;
  replies: number;
  isQuote: boolean;
  quotedTweetId: string | null;
}

interface RawFeed {
  generatedAt?: string;
  lookbackHours?: number;
  x?: Array<{
    source?: string;
    name: string;
    handle: string;
    bio?: string;
    tweets: RawTweet[];
  }>;
  stats?: { xBuilders: number; totalTweets: number };
}

interface HistoryFile {
  generatedAt: string;
  source?: string;
  days: Array<{
    date: string;
    lookback?: string;
    generatedAt?: string | null;
    x: { users: Array<{ name: string; handle: string; bio?: string; tweets: RawTweet[] }> };
  }>;
  stats?: { coveredDays: number; requestedDays: number; totalTweets: number };
}

let feedCache: { generatedAt: string; tweets: Tweet[]; digests: DailyDigest[] } | null = null;
let feedLoadPromise: Promise<{ generatedAt: string; tweets: Tweet[]; digests: DailyDigest[] }> | null = null;

function rawDayToTweets(day: HistoryFile["days"][number]): Tweet[] {
  const out: Tweet[] = [];
  for (const user of day.x.users) {
    for (const t of user.tweets) {
      out.push({
        ...t,
        handle: user.handle,
        authorName: user.name,
        authorBio: user.bio,
      });
    }
  }
  // Site-wide content safety filter: drop politically sensitive / illegal
  // tweets so they never appear in any digest, builder page, or annotation
  // surface.  See src/lib/contentFilter.ts for the rule list.
  return filterBlockedTweets(out);
}

function rawFeedToTweets(data: RawFeed): Tweet[] {
  const tweets: Tweet[] = [];
  for (const user of data.x ?? []) {
    for (const t of user.tweets) {
      tweets.push({
        ...t,
        handle: user.handle,
        authorName: user.name,
        authorBio: user.bio,
      });
    }
  }
  return filterBlockedTweets(tweets);
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const resp = await fetch(url, { cache: "no-cache" });
    if (!resp.ok) return null;
    return (await resp.json()) as T;
  } catch {
    return null;
  }
}

export async function loadFeed(): Promise<{ generatedAt: string; tweets: Tweet[]; digests: DailyDigest[] }> {
  if (feedCache) return feedCache;
  if (feedLoadPromise) return feedLoadPromise;
  feedLoadPromise = (async () => {
    const base = import.meta.env.BASE_URL ?? "/";
    const join = (p: string) => (base.endsWith("/") ? `${base}${p}` : `${base}/${p}`);

    // 1) Try the real 30-day history (preferred).
    const history = await fetchJson<HistoryFile>(join("data/feed-history.json"));

    if (history && history.days?.length) {
      const digests: DailyDigest[] = history.days.map((d) => {
        const tweets = rawDayToTweets(d);
        tweets.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
        return { date: d.date, tweets };
      });
      // newest first
      digests.sort((a, b) => (a.date < b.date ? 1 : -1));
      const newest = digests[0];
      feedCache = {
        generatedAt: newest?.tweets[0]?.createdAt ?? history.generatedAt,
        tweets: newest?.tweets ?? [],
        digests,
      };
      return feedCache;
    }

    // 2) Fallback to legacy single-day feed-x.json.
    const single = await fetchJson<RawFeed>(join("feed-x.json"));
    const tweets = single ? rawFeedToTweets(single) : [];
    tweets.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    const today = isoDate(new Date(single?.generatedAt ?? new Date().toISOString()));
    feedCache = {
      generatedAt: single?.generatedAt ?? new Date().toISOString(),
      tweets,
      digests: tweets.length ? [{ date: today, tweets }] : [],
    };
    return feedCache;
  })();
  return feedLoadPromise;
}

// Helpers

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function getDigestByDate(digests: DailyDigest[], date: string): DailyDigest | undefined {
  return digests.find((d) => d.date === date);
}

export function tweetsByHandle(tweets: Tweet[], handle: string): Tweet[] {
  return tweets.filter((t) => t.handle.toLowerCase() === handle.toLowerCase());
}
