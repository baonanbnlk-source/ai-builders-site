#!/usr/bin/env node
/**
 * Collect the tweets that the UI will actually surface, so the agent can
 * translate them once and store results into public/data/translations.json.
 *
 * Priority A (must-translate): every highlight that the digest view shows
 *   for each day -> filterTweets() ordered by score, then per-builder top 3.
 * Priority B (nice-to-have): every builder's monthly top-N high-score tweets
 *   that show up on the builder detail page "近一月观点" tab + timeline.
 *
 * Outputs scripts/_to_translate.json with shape:
 *   {
 *     priorityA: [{ id, text, handle, isQuote, quotedTweetId, createdAt }],
 *     priorityB: [...],
 *     all:       [...]   // dedup union, agent translates this
 *   }
 *
 * Note: the keyword rules below MUST stay in sync with src/lib/highlights.ts.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const FEED_PATH = path.join(ROOT, "public/data/feed-history.json");
const OUT_PATH = path.join(__dirname, "_to_translate.json");

// === Mirror of src/lib/highlights.ts (after the new "keep AI quote" rule) ===

const KEYWORD_RULES = [
  { pattern: /\bAI\b|\bAGI\b|artificial intelligence/gi, weight: 3 },
  {
    pattern:
      /\b(model|models|LLM|LLMs|agent|agents|RAG|fine[- ]?tune|embedding|inference|reasoning|alignment|safety|eval|evals)\b/gi,
    weight: 3,
  },
  {
    pattern:
      /\b(Claude|GPT|Anthropic|OpenAI|Gemini|Mistral|DeepSeek|Llama|Sonnet|Haiku|Opus|o1|o3)\b/gi,
    weight: 3,
  },
  {
    pattern:
      /\b(Cursor|Replit|Vercel|v0|Codex|Copilot|LangChain|MCP|nanoGPT|notebooklm|loveable|bolt)\b/gi,
    weight: 2,
  },
  {
    pattern:
      /\b(code|coding|coder|dev|developer|build|building|builder|ship|shipped|shipping|deploy|deployed)\b/gi,
    weight: 1,
  },
  {
    pattern:
      /\b(product|launch|launched|launching|release|released|releasing|update|feature)\b/gi,
    weight: 1,
  },
  {
    pattern:
      /\b(startup|startups|founder|founders|founded|ceo|cto|YC|a16z|seed|round|funding|raised)\b/gi,
    weight: 1,
  },
  {
    pattern:
      /\b(prompt|prompting|context|tokens?|benchmark|paper|research|dataset|pretrain|post[- ]?train|RLHF|RLAIF)\b/gi,
    weight: 2,
  },
];

const NEG_RULES = [
  {
    pattern:
      /\b(politics?|election|vote|biden|trump|harris|gop|democrat|republican)\b/gi,
    weight: -3,
  },
  {
    pattern:
      /\b(birthday|wedding|holiday|vacation|breakfast|dinner|coffee shop)\b/gi,
    weight: -2,
  },
  { pattern: /\b(stocks?|crypto|btc|eth|bitcoin|nft)\b/gi, weight: -1 },
];

function scoreTweet(t) {
  const text = (t.text ?? "").trim();
  let score = 0;
  const hits = [];
  for (const r of KEYWORD_RULES) {
    const m = text.match(r.pattern);
    if (m) {
      score += m.length * r.weight;
      hits.push(...m.map((x) => x.toLowerCase()));
    }
  }
  for (const r of NEG_RULES) {
    const m = text.match(r.pattern);
    if (m) score += m.length * r.weight;
  }
  score += Math.min(text.length / 200, 1);
  return { tweet: t, score, hits };
}

function isObviousNoise(t, text) {
  if (!text) return true;
  if (text.length < 8) return true;
  if (/^RT @/i.test(text)) return true;
  if (t.retweetedFrom) return true;
  // For quote tweets: only filter when commentary is short AND no AI keyword
  // hit (matches the new "keep AI-related quote tweets" rule).
  if (t.isQuote) {
    const noUrl = text.replace(/https?:\/\/\S+/g, "").trim();
    const aiHit = /\b(AI|AGI|LLM|agent|claude|gpt|openai|anthropic|cursor|replit|vercel|codex|model|prompt|RAG|MCP|gemini|llama|sonnet|haiku|opus|o[13])\b/i.test(text);
    if (noUrl.length < 15 && !aiHit) return true;
  }
  const noMentions = text.replace(/@\w+/g, "").trim();
  if (noMentions.length < 12) return true;
  return false;
}

function filterTweets(tweets, options = {}) {
  const minScore = options.minScore ?? 2;
  const minLength = options.minLength ?? 30;
  const out = [];
  for (const t of tweets) {
    const text = (t.text ?? "").trim();
    if (text.length < minLength) continue;
    if (isObviousNoise(t, text)) continue;
    const s = scoreTweet(t);
    if (s.score < minScore) continue;
    out.push(s);
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

function buildBuilderBriefs(scored) {
  const byHandle = new Map();
  for (const s of scored) {
    const arr = byHandle.get(s.tweet.handle) ?? [];
    arr.push(s);
    byHandle.set(s.tweet.handle, arr);
  }
  const briefs = [];
  for (const [handle, items] of byHandle.entries()) {
    items.sort((a, b) => b.score - a.score);
    const top = items.slice(0, 3);
    briefs.push({ handle, highlights: top });
  }
  return briefs;
}

// === Main ===

const feed = JSON.parse(fs.readFileSync(FEED_PATH, "utf8"));

/**
 * Build flat list per day with handle/authorName attached, like rawDayToTweets
 * in src/lib/feed.ts.
 */
function dayTweets(day) {
  const out = [];
  for (const u of day.x.users) {
    for (const t of u.tweets) {
      out.push({ ...t, handle: u.handle, authorName: u.name });
    }
  }
  return out;
}

const priorityAMap = new Map();
const priorityBMap = new Map();

for (const day of feed.days) {
  const tweets = dayTweets(day);
  const scored = filterTweets(tweets);
  const briefs = buildBuilderBriefs(scored);
  for (const b of briefs) {
    for (const s of b.highlights) {
      const t = s.tweet;
      if (!priorityAMap.has(t.id)) {
        priorityAMap.set(t.id, {
          id: t.id,
          text: t.text,
          handle: t.handle,
          isQuote: !!t.isQuote,
          quotedTweetId: t.quotedTweetId ?? null,
          createdAt: t.createdAt,
          score: s.score,
          day: day.date,
        });
      }
    }
  }
}

// Priority B: per builder, monthly top-N (excluding A)
const allByHandle = new Map();
for (const day of feed.days) {
  for (const t of dayTweets(day)) {
    const arr = allByHandle.get(t.handle) ?? [];
    arr.push(t);
    allByHandle.set(t.handle, arr);
  }
}

for (const [handle, list] of allByHandle.entries()) {
  const scored = filterTweets(list);
  const top = scored.slice(0, 8); // up to 8 monthly highlights per builder
  for (const s of top) {
    const t = s.tweet;
    if (priorityAMap.has(t.id) || priorityBMap.has(t.id)) continue;
    priorityBMap.set(t.id, {
      id: t.id,
      text: t.text,
      handle: t.handle,
      isQuote: !!t.isQuote,
      quotedTweetId: t.quotedTweetId ?? null,
      createdAt: t.createdAt,
      score: s.score,
    });
  }
}

const priorityA = [...priorityAMap.values()].sort((a, b) => b.score - a.score);
const priorityB = [...priorityBMap.values()].sort((a, b) => b.score - a.score);

// Cap priority B to keep total reasonable.
const MAX_B = 220;
const priorityBCapped = priorityB.slice(0, MAX_B);

const all = [...priorityA, ...priorityBCapped];

const summary = {
  generatedAt: new Date().toISOString(),
  counts: {
    priorityA: priorityA.length,
    priorityB: priorityB.length,
    priorityBKept: priorityBCapped.length,
    total: all.length,
    quoteTweetsInTotal: all.filter((x) => x.isQuote).length,
  },
  priorityA,
  priorityB: priorityBCapped,
  all,
};

fs.writeFileSync(OUT_PATH, JSON.stringify(summary, null, 2));
console.log("Wrote", OUT_PATH);
console.log("Counts:", summary.counts);
