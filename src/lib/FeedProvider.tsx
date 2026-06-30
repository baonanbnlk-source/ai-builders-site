import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { DailyDigest, Tweet } from "@/data/types";
import { loadFeed } from "./feed";

interface FeedContextValue {
  loading: boolean;
  error?: string;
  todayTweets: Tweet[];
  generatedAt: string;
  digests: DailyDigest[];
}

const FeedContext = createContext<FeedContextValue | null>(null);

export function FeedProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<{
    generatedAt: string;
    tweets: Tweet[];
    digests: DailyDigest[];
  } | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    loadFeed()
      .then((d) => setData(d))
      .catch((e) => setError(String(e)));
  }, []);

  const value: FeedContextValue = {
    loading: !data && !error,
    error,
    todayTweets: data?.tweets ?? [],
    generatedAt: data?.generatedAt ?? new Date().toISOString(),
    digests: data?.digests ?? [],
  };

  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}

export function useFeed(): FeedContextValue {
  const ctx = useContext(FeedContext);
  if (!ctx) throw new Error("useFeed must be used within FeedProvider");
  return ctx;
}
