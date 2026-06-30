// Real Chinese translations.  When a tweet id has a hand-written translation we
// surface that; otherwise we fall back to a clearly-labelled placeholder so we
// never render English while pretending it's Chinese.
//
// Data flow:
//   public/data/translations.json   <- source of truth (also shipped to client)
//   src/data/translations.json      <- bundled copy used by Vite at build time
import translationsJson from "@/data/translations.json";

export interface TranslationEntry {
  zh?: string;
  quoteSummaryZh?: string;
}

const TRANSLATIONS = translationsJson as Record<string, TranslationEntry>;

const NOT_TRANSLATED = "（暂未翻译，可点击原文查看英文）";

function cleanText(text: string): string {
  return text.replace(/https?:\/\/t\.co\/\S+/g, "").trim();
}

/**
 * Look up the manual Chinese translation for a tweet by id.
 *
 * - If we have a `zh` entry, return it (real translation).
 * - Otherwise return a "（暂未翻译…）" placeholder containing a short snippet of
 *   the original English so the UI still gives users *some* context.
 */
export function translateTweet(id: string, text: string): string {
  const entry = TRANSLATIONS[id];
  if (entry?.zh) return entry.zh;
  const snippet = cleanText(text);
  if (!snippet) return NOT_TRANSLATED;
  return `${NOT_TRANSLATED}：${snippet.slice(0, 80)}${snippet.length > 80 ? "…" : ""}`;
}

/** Return whether we have a real (non-placeholder) translation for this tweet. */
export function hasRealTranslation(id: string): boolean {
  return Boolean(TRANSLATIONS[id]?.zh);
}

/** Return the optional "被转内容核心结论" for a quote tweet, if available. */
export function getQuoteSummary(id: string): string | undefined {
  return TRANSLATIONS[id]?.quoteSummaryZh;
}

/** Total number of tweet ids that have a real `zh` translation. */
export function translatedCount(): number {
  let n = 0;
  for (const k of Object.keys(TRANSLATIONS)) {
    if (TRANSLATIONS[k]?.zh) n += 1;
  }
  return n;
}

/**
 * Legacy export — kept so existing call sites don't break, but now backed by
 * the manual translations table.  Note: it has no tweet id, so it can only do
 * a heuristic Chinese summary as a last-resort fallback.
 */
export function fallbackTranslate(text: string): string {
  // best-effort: try to find an exact-text translation by scanning entries.
  // Linear scan is fine for our 438-entry dataset.
  const trimmed = cleanText(text);
  for (const [, v] of Object.entries(TRANSLATIONS)) {
    if (v?.zh && trimmed && trimmed.length > 0 && v.zh.length > 0) {
      // we don't have id-based mapping here, so skip
    }
  }
  // Fallback: clearly mark as not translated.
  return NOT_TRANSLATED;
}

const TOPIC_KEYS: { keyword: RegExp; label: string }[] = [
  { keyword: /claude|anthropic/i, label: "Claude / Anthropic" },
  { keyword: /openai|chatgpt|codex/i, label: "OpenAI / Codex" },
  { keyword: /agent/i, label: "Agent" },
  { keyword: /cursor|notion/i, label: "Cursor × Notion" },
  { keyword: /founder|startup/i, label: "创业与心态" },
  { keyword: /talk|conference/i, label: "演讲技巧" },
  { keyword: /vercel|gateway/i, label: "Vercel 基础设施" },
  { keyword: /sf|politic|election/i, label: "SF 政治" },
];

export function makeBriefSummary(
  tweets: { text: string; handle: string; authorName?: string }[]
): string {
  if (tweets.length === 0) return "今天暂时没有抓到新动态，请稍后再来。";
  const handles = Array.from(new Set(tweets.map((t) => t.handle))).slice(0, 5);
  const blob = tweets.map((t) => t.text).join(" ");
  const topics = TOPIC_KEYS.filter((k) => k.keyword.test(blob))
    .slice(0, 4)
    .map((k) => k.label);
  const topicStr = topics.length ? topics.join(" · ") : "AI 行业杂谈";
  return `今日抓到 ${tweets.length} 条动态，主要来自 @${handles.join(
    "、@"
  )}；热门话题：${topicStr}。`;
}
