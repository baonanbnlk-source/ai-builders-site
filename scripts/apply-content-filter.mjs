#!/usr/bin/env node
/**
 * Apply the same site-wide content safety filter (src/lib/contentFilterRules.json)
 * to the generated public/feed-x.json and public/data/feed-history.json so that
 * sensitive tweets are stripped before they ever reach the browser.
 *
 * Designed to be called by daily-update.mjs after fetch-history + feed-x refresh.
 * Re-uses scripts/content-filter.shared.mjs (single source of truth for the rule list).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tweetIsBlocked, getAllTerms } from "./content-filter.shared.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const FEED_X = path.join(ROOT, "public/feed-x.json");
const FEED_HISTORY = path.join(ROOT, "public/data/feed-history.json");
const TRANSLATIONS = path.join(ROOT, "public/data/translations.json");

function loadJsonSafely(p) {
  try {
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, "utf8");
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[content-filter] could not read ${p}: ${err.message}`);
    return null;
  }
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data));
}

function filterUsers(users, translations) {
  let removed = 0;
  const cleaned = users.map((u) => {
    const kept = [];
    for (const t of u.tweets ?? []) {
      if (tweetIsBlocked(t, translations)) {
        removed++;
        continue;
      }
      kept.push(t);
    }
    return { ...u, tweets: kept };
  });
  return { users: cleaned, removed };
}

function filterFeedX(data, translations) {
  if (!data || !Array.isArray(data.x)) return { data, removed: 0 };
  const { users, removed } = filterUsers(data.x, translations);
  return {
    data: {
      ...data,
      x: users,
      stats: data.stats
        ? {
            ...data.stats,
            totalTweets: users.reduce((s, u) => s + (u.tweets?.length ?? 0), 0),
          }
        : data.stats,
    },
    removed,
  };
}

function filterFeedHistory(data, translations) {
  if (!data || !Array.isArray(data.days)) return { data, removed: 0 };
  let totalRemoved = 0;
  const days = data.days.map((d) => {
    const usrs = d.x?.users ?? [];
    const { users, removed } = filterUsers(usrs, translations);
    totalRemoved += removed;
    return { ...d, x: { ...(d.x ?? {}), users } };
  });
  return {
    data: {
      ...data,
      days,
      stats: data.stats
        ? {
            ...data.stats,
            totalTweets: days.reduce(
              (s, d) =>
                s + (d.x.users ?? []).reduce((ss, u) => ss + (u.tweets?.length ?? 0), 0),
              0
            ),
          }
        : data.stats,
    },
    removed: totalRemoved,
  };
}

const translations = loadJsonSafely(TRANSLATIONS) ?? {};
const terms = getAllTerms();
console.log(`[content-filter] loaded ${terms.length} sensitive terms`);

const feedX = loadJsonSafely(FEED_X);
if (feedX) {
  const { data, removed } = filterFeedX(feedX, translations);
  writeJson(FEED_X, data);
  console.log(`[content-filter] feed-x.json: removed ${removed} blocked tweets`);
}

const feedHistory = loadJsonSafely(FEED_HISTORY);
if (feedHistory) {
  const { data, removed } = filterFeedHistory(feedHistory, translations);
  writeJson(FEED_HISTORY, data);
  console.log(
    `[content-filter] feed-history.json: removed ${removed} blocked tweets`
  );
}
