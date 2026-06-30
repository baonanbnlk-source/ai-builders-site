// Build-time mirror of src/lib/contentFilter.ts.
//
// Reads the SAME rule file (src/lib/contentFilterRules.json) so we never
// maintain two copies of the keyword list.  Exposes:
//   - isBlocked(text)
//   - tweetIsBlocked(tweet, translations)
//
// Translations object has the shape Record<id, { zh?: string, quoteSummaryZh?: string }>.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RULES_PATH = path.resolve(
  __dirname,
  "..",
  "src",
  "lib",
  "contentFilterRules.json"
);

const rules = JSON.parse(fs.readFileSync(RULES_PATH, "utf8"));

const ALL_TERMS = (() => {
  const seen = new Set();
  for (const list of Object.values(rules.categories ?? {})) {
    if (!Array.isArray(list)) continue;
    for (const term of list) {
      const t = String(term).trim().toLowerCase();
      if (t) seen.add(t);
    }
  }
  return [...seen];
})();

export function isBlocked(text) {
  if (!text) return false;
  const hay = String(text).toLowerCase();
  for (const term of ALL_TERMS) {
    if (hay.includes(term)) return true;
  }
  return false;
}

export function tweetIsBlocked(t, translations = {}) {
  if (!t) return false;
  if (isBlocked(t.text)) return true;
  const entry = translations[t.id];
  if (entry?.zh && isBlocked(entry.zh)) return true;
  if (entry?.quoteSummaryZh && isBlocked(entry.quoteSummaryZh)) return true;
  return false;
}

export function getAllTerms() {
  return ALL_TERMS.slice();
}
