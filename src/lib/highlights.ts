// Keyword-driven highlight scoring used to filter & rank tweets for the
// "AI 行业要闻精选" digest.  This file only decides which tweets are *worth*
// surfacing.

import type { Tweet } from "@/data/types";

type KeywordRule = { pattern: RegExp; weight: number };

const KEYWORD_RULES: KeywordRule[] = [
  // strong AI / model / agent signals
  { pattern: /\bAI\b|\bAGI\b|artificial intelligence/gi, weight: 3 },
  { pattern: /\b(model|models|LLM|LLMs|agent|agents|RAG|fine[- ]?tune|embedding|inference|reasoning|alignment|safety|eval|evals)\b/gi, weight: 3 },
  { pattern: /\b(Claude|GPT|Anthropic|OpenAI|Gemini|Mistral|DeepSeek|Llama|Sonnet|Haiku|Opus|o1|o3)\b/gi, weight: 3 },
  // developer / agent tooling
  { pattern: /\b(Cursor|Replit|Vercel|v0|Codex|Copilot|LangChain|MCP|nanoGPT|notebooklm|loveable|bolt)\b/gi, weight: 2 },
  { pattern: /\b(code|coding|coder|dev|developer|build|building|builder|ship|shipped|shipping|deploy|deployed)\b/gi, weight: 1 },
  // product / startup
  { pattern: /\b(product|launch|launched|launching|release|released|releasing|update|feature)\b/gi, weight: 1 },
  { pattern: /\b(startup|startups|founder|founders|founded|ceo|cto|YC|a16z|seed|round|funding|raised)\b/gi, weight: 1 },
  // research adjacent
  { pattern: /\b(prompt|prompting|context|tokens?|benchmark|paper|research|dataset|pretrain|post[- ]?train|RLHF|RLAIF)\b/gi, weight: 2 },
];

// Penalties for obvious noise.
const NEG_RULES: KeywordRule[] = [
  { pattern: /\b(politics?|election|vote|biden|trump|harris|gop|democrat|republican)\b/gi, weight: -3 },
  { pattern: /\b(birthday|wedding|holiday|vacation|breakfast|dinner|coffee shop)\b/gi, weight: -2 },
  { pattern: /\b(stocks?|crypto|btc|eth|bitcoin|nft)\b/gi, weight: -1 },
];

export interface ScoredTweet {
  tweet: Tweet;
  score: number;
  hits: string[];
}

export interface FilterOptions {
  minScore?: number; // default 2
  minLength?: number; // default 30
}

export function scoreTweet(t: Tweet): ScoredTweet {
  const text = (t.text ?? "").trim();
  let score = 0;
  const hits: string[] = [];
  for (const r of KEYWORD_RULES) {
    const m = text.match(r.pattern);
    if (m) {
      score += m.length * r.weight;
      hits.push(...m.map((x) => x.toLowerCase()));
    }
  }
  for (const r of NEG_RULES) {
    const m = text.match(r.pattern);
    if (m) score += m.length * r.weight; // weight is negative
  }
  // mild length bonus capped at 1
  score += Math.min(text.length / 200, 1);
  return { tweet: t, score, hits };
}

function isObviousNoise(t: Tweet, text: string): boolean {
  if (!text) return true;
  if (text.length < 8) return true;
  // pure RT
  if (/^RT @/i.test(text)) return true;
  // explicit retweet field in data
  if ((t as any).retweetedFrom) return true;
  if (t.isQuote) {
    // For quote tweets, keep them when the builder's own commentary (or the
    // visible English text) is AI / tech related, even if it's short.  Only
    // filter as noise when there's basically no commentary AND no AI signal.
    const noLink = text.replace(/https?:\/\/\S+/g, "").trim();
    const aiRelated = /\b(AI|AGI|LLM|model|agent|claude|gpt|openai|anthropic|gemini|cursor|replit|vercel|codex|copilot|prompt|ship|launch|build|founder|startup|RAG|MCP)\b/i.test(
      text
    );
    if (noLink.length < 10 && !aiRelated) return true;
  }
  // pure mention reply like "@xxx thanks" / "@xxx ❤️"
  const noMentions = text.replace(/@\w+/g, "").trim();
  if (noMentions.length < 12) return true;
  return false;
}

export function filterTweets(
  tweets: Tweet[],
  options: FilterOptions = {}
): ScoredTweet[] {
  const minScore = options.minScore ?? 2;
  const minLength = options.minLength ?? 30;
  const out: ScoredTweet[] = [];
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

// ===== Highlight phrasing =====

interface HighlightPhraseInput {
  text: string;
  hits: string[];
  handle: string;
}

const TOPIC_TEMPLATES: Array<{ test: RegExp; phrase: (handle: string) => string }> = [
  { test: /claude|anthropic|sonnet|haiku|opus/i, phrase: (h) => `@${h} 谈 Claude / Anthropic 最新动向` },
  { test: /gpt|openai|codex|o[13]/i, phrase: (h) => `@${h} 解读 OpenAI / GPT 进展` },
  { test: /cursor|replit|vercel|v0/i, phrase: (h) => `@${h} 分享 AI Coding 工具实践` },
  { test: /agent|mcp/i, phrase: (h) => `@${h} 拆解 Agent / MCP 设计` },
  { test: /launch|ship|release|introducing/i, phrase: (h) => `@${h} 官宣新功能 / 新版本` },
  { test: /founder|startup|raised|funding|YC|a16z/i, phrase: (h) => `@${h} 谈创业与融资思考` },
  { test: /prompt|context|RAG|fine.?tune|embedding/i, phrase: (h) => `@${h} 总结提示工程与上下文经验` },
  { test: /talk|conference|stage|keynote|podcast/i, phrase: (h) => `@${h} 分享演讲 / 播客内容` },
];

export function makeHighlightLine(input: HighlightPhraseInput): string {
  const { text, handle } = input;
  for (const t of TOPIC_TEMPLATES) {
    if (t.test.test(text)) return `📌 ${t.phrase(handle)}`;
  }
  // Fall back: pluck the first capital-cased phrase
  const m = text.match(/[A-Z][A-Za-z0-9\-]+(?:\s+[A-Z][A-Za-z0-9\-]+)*/);
  const subject = m ? m[0] : "AI 行业要点";
  return `📌 @${handle} 提到 ${subject}`;
}

export interface BuilderBrief {
  handle: string;
  takeawayLine: string;
  highlights: ScoredTweet[]; // 1-3
}

export function buildBuilderBriefs(scored: ScoredTweet[]): BuilderBrief[] {
  const byHandle = new Map<string, ScoredTweet[]>();
  for (const s of scored) {
    const arr = byHandle.get(s.tweet.handle) ?? [];
    arr.push(s);
    byHandle.set(s.tweet.handle, arr);
  }
  const briefs: BuilderBrief[] = [];
  for (const [handle, items] of byHandle.entries()) {
    items.sort((a, b) => b.score - a.score);
    const top = items.slice(0, 3);
    const lead = top[0];
    const takeaway = `今日要点：${makeHighlightLine({
      text: lead.tweet.text,
      hits: lead.hits,
      handle,
    }).replace(/^📌\s*/, "")}`;
    briefs.push({
      handle,
      takeawayLine: takeaway,
      highlights: top,
    });
  }
  // Order builders by their best highlight score, desc
  briefs.sort((a, b) => b.highlights[0].score - a.highlights[0].score);
  return briefs;
}

export function pickTopFocus(scored: ScoredTweet[], n = 3): ScoredTweet[] {
  return [...scored].sort((a, b) => b.score - a.score).slice(0, n);
}
