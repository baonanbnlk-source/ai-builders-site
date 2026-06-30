// Content safety filter for AI Builders Daily.
//
// Goal: drop tweets whose ENGLISH text or CHINESE translation matches any of
// the politically-sensitive / illegal-content rules in
// `./contentFilterRules.json`.  The rule list is the single source of truth
// and is also consumed by build-time Node scripts via
// `scripts/content-filter.shared.mjs`.
//
// Matching is case-insensitive substring (works well for Chinese; for English
// we keep multi-word phrases to avoid false positives).
//
// Public API:
//   - isBlocked(text)               -> boolean (single string)
//   - tweetIsBlocked({text, zh})    -> boolean (checks both fields)
//   - filterBlockedTweets(tweets)   -> Tweet[]  (removes blocked tweets)

import rules from "./contentFilterRules.json";
import translationsJson from "@/data/translations.json";
import type { Tweet } from "@/data/types";

interface RulesShape {
  categories: Record<string, string[]>;
}

const RULES = rules as RulesShape;

// Flatten all category buckets into one lowercase term list (dedup just in case).
const ALL_TERMS: string[] = (() => {
  const seen = new Set<string>();
  for (const list of Object.values(RULES.categories)) {
    for (const term of list) {
      const t = term.trim().toLowerCase();
      if (t) seen.add(t);
    }
  }
  return [...seen];
})();

const TRANSLATIONS = translationsJson as Record<
  string,
  { zh?: string; quoteSummaryZh?: string }
>;

/** Case-insensitive substring match against the sensitive-term list. */
export function isBlocked(text: string | undefined | null): boolean {
  if (!text) return false;
  const hay = text.toLowerCase();
  for (const term of ALL_TERMS) {
    if (hay.includes(term)) return true;
  }
  return false;
}

/**
 * Decide whether a tweet must be hidden site-wide.  We check both the English
 * source text and any Chinese translation / quote summary we have for it.
 */
export function tweetIsBlocked(t: Pick<Tweet, "id" | "text">): boolean {
  if (isBlocked(t.text)) return true;
  const entry = TRANSLATIONS[t.id];
  if (entry?.zh && isBlocked(entry.zh)) return true;
  if (entry?.quoteSummaryZh && isBlocked(entry.quoteSummaryZh)) return true;
  return false;
}

/** Helper used by the feed loader to drop blocked tweets from any list. */
export function filterBlockedTweets<T extends Pick<Tweet, "id" | "text">>(
  tweets: T[]
): T[] {
  return tweets.filter((t) => !tweetIsBlocked(t));
}

/** Exposed for debugging / tests. */
export function _allTerms(): string[] {
  return ALL_TERMS.slice();
}
