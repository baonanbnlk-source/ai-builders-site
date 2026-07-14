#!/usr/bin/env node
/**
 * Translate any tweet ids that appear in scripts/_to_translate.json but do not
 * yet have a `zh` translation in src/data/translations.json (the bundled source
 * of truth).  Calls an OpenAI-compatible chat-completions endpoint.
 *
 * Designed to run inside Codebase CI / GitHub Actions.  Env vars:
 *   LLM_API_KEY    (required)  bearer token for the LLM gateway
 *   LLM_BASE_URL   (optional)  default https://ark.cn-beijing.volces.com/api/v3
 *   LLM_MODEL      (optional)  default doubao-pro-32k-241215
 *   LLM_BATCH_SIZE (optional)  default 6  tweets per request
 *   LLM_MAX_NEW    (optional)  default 80 tweets per pipeline run (cost cap)
 *   LLM_TIMEOUT_MS (optional)  default 60000
 *
 * Graceful fallback: if LLM_API_KEY is missing, the script logs a warning and
 * exits 0 without modifying any file.  The site stays buildable; new tweets
 * simply render the "(暂未翻译，可点原文)" placeholder until a key is added.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const TO_TRANSLATE_PATH = path.join(__dirname, "_to_translate.json");
const SRC_TRANS_PATH = path.join(ROOT, "src/data/translations.json");
const PUB_TRANS_PATH = path.join(ROOT, "public/data/translations.json");

const API_KEY = process.env.LLM_API_KEY ?? "";
const BASE_URL =
  process.env.LLM_BASE_URL ?? "https://ark.cn-beijing.volces.com/api/v3";
const MODEL = process.env.LLM_MODEL ?? "doubao-1-5-pro-32k-250115";
const BATCH_SIZE = Number(process.env.LLM_BATCH_SIZE ?? 6);
const MAX_NEW = Number(process.env.LLM_MAX_NEW ?? 500);
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 120000);

function loadJson(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJsonAtomic(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, p);
}

/** Build the system + user messages for a batch of tweets. */
function buildPrompt(batch) {
  const sys = [
    "你是 AI Builders 简报的专业译者。任务：把每条英文推文翻译成自然、信达雅的中文，",
    "面向中文 AI 行业从业者阅读，保留专有名词（人名/产品名/公司名）原文。",
    "对引用/转推（isQuote=true）的推文，额外用一两句中文总结被转内容的核心观点。",
    "严格只输出 JSON，结构：",
    '{"items":[{"id":"<id>","zh":"<中文翻译>","quoteSummaryZh":"<被转内容核心结论，可省略>"}]}',
    "禁止输出 markdown 代码围栏，禁止输出任何解释性文字。",
  ].join("\n");
  const userPayload = {
    instruction: "翻译以下推文，逐条返回。",
    tweets: batch.map((t) => ({
      id: t.id,
      text: t.text,
      handle: t.handle,
      isQuote: !!t.isQuote,
      quotedTweetId: t.quotedTweetId ?? null,
    })),
  };
  return [
    { role: "system", content: sys },
    { role: "user", content: JSON.stringify(userPayload, null, 2) },
  ];
}

async function callLLM(messages) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 240)}`);
    }
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "";
    return content;
  } finally {
    clearTimeout(t);
  }
}

function parseLLMOutput(text) {
  // Strip code fences just in case.
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    const obj = JSON.parse(cleaned);
    return Array.isArray(obj.items) ? obj.items : [];
  } catch {
    // Best effort: pick the first {...} blob.
    const m = cleaned.match(/\{[\s\S]*\}$/);
    if (m) {
      try {
        const obj = JSON.parse(m[0]);
        return Array.isArray(obj.items) ? obj.items : [];
      } catch {}
    }
    return [];
  }
}

async function main() {
  if (!API_KEY) {
    console.warn(
      "[translate-new] LLM_API_KEY not set — skipping translation (site will use placeholder for new tweets)."
    );
    return;
  }
  if (!fs.existsSync(TO_TRANSLATE_PATH)) {
    console.warn(
      `[translate-new] ${TO_TRANSLATE_PATH} missing — run collect-to-translate.mjs first.`
    );
    return;
  }

  const todo = loadJson(TO_TRANSLATE_PATH, { all: [] });
  const existing = loadJson(SRC_TRANS_PATH, {});

  // Build queue: priorityA first, then priorityB, then anything else.
  const queue = [];
  const seen = new Set();
  for (const list of [todo.priorityA ?? [], todo.priorityB ?? [], todo.all ?? []]) {
    for (const t of list) {
      if (!t || !t.id || seen.has(t.id)) continue;
      seen.add(t.id);
      const hit = existing[t.id];
      if (hit?.zh && (!t.isQuote || hit.quoteSummaryZh)) continue;
      queue.push(t);
    }
  }

  console.log(
    `[translate-new] existing entries: ${Object.keys(existing).length}, queue: ${queue.length}, MAX_NEW: ${MAX_NEW}`
  );
  const work = queue.slice(0, MAX_NEW);
  if (work.length === 0) {
    console.log("[translate-new] nothing to translate, exiting.");
    return;
  }

  let added = 0;
  for (let i = 0; i < work.length; i += BATCH_SIZE) {
    const batch = work.slice(i, i + BATCH_SIZE);
    const messages = buildPrompt(batch);
    let attempt = 0;
    let items = [];
    while (attempt < 3) {
      attempt += 1;
      try {
        const raw = await callLLM(messages);
        items = parseLLMOutput(raw);
        if (items.length > 0) break;
      } catch (err) {
        console.warn(
          `[translate-new] batch ${i / BATCH_SIZE} attempt ${attempt} failed: ${err.message}`
        );
      }
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
    if (items.length === 0) {
      console.warn(
        `[translate-new] batch ${i / BATCH_SIZE} gave up after 3 attempts.`
      );
      continue;
    }
    for (const it of items) {
      if (!it || !it.id || !it.zh) continue;
      const prev = existing[it.id] ?? {};
      existing[it.id] = {
        ...prev,
        zh: String(it.zh).trim(),
        ...(it.quoteSummaryZh
          ? { quoteSummaryZh: String(it.quoteSummaryZh).trim() }
          : {}),
      };
      added += 1;
    }
    // 每个 batch 增量落盘，避免长耗时被中断时丢失全部进度。
    writeJsonAtomic(SRC_TRANS_PATH, existing);
    writeJsonAtomic(PUB_TRANS_PATH, existing);
    console.log(
      `[translate-new] batch ${Math.floor(i / BATCH_SIZE) + 1}: added=${items.length} (flushed, total +${added})`
    );
  }

  writeJsonAtomic(SRC_TRANS_PATH, existing);
  writeJsonAtomic(PUB_TRANS_PATH, existing);
  console.log(
    `[translate-new] done. wrote ${SRC_TRANS_PATH} and ${PUB_TRANS_PATH}, +${added} new entries.`
  );
}

main().catch((err) => {
  // Never hard-fail the pipeline; translation is best-effort.
  console.error("[translate-new] fatal:", err);
  process.exit(0);
});
