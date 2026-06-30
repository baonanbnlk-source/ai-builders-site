#!/usr/bin/env node
/**
 * Daily update orchestrator for AI Builders Daily.
 *
 * Runs in this order:
 *   1. fetch-history.mjs   — refreshes public/data/feed-history.json (30d)
 *   2. fetch latest feed-x.json → public/feed-x.json
 *   3. collect-to-translate.mjs — figures out which tweets need translation
 *   4. translate-new.mjs   — LLM translates new tweets (graceful if no key)
 *
 * Designed to be invoked once per day from a scheduler (Codebase CI cron,
 * GitHub Actions cron, system crontab, …).  Exits 0 on best-effort success.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

// Auto-load LLM config from .aime-secrets.env if present (export KEY=value lines).
const SECRETS = path.join(ROOT, ".aime-secrets.env");
if (fs.existsSync(SECRETS)) {
  for (const line of fs.readFileSync(SECRETS, "utf8").split("\n")) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)=(?:"([^"]*)"|'([^']*)'|(.*))\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  console.log("[daily-update] loaded .aime-secrets.env");
}

const UPSTREAM_FEED_X =
  "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-x.json";
const PUB_FEED_X = path.join(ROOT, "public/feed-x.json");

async function run(label, file, args = []) {
  console.log(`\n=== ${label} ===`);
  console.log(`$ node ${file} ${args.join(" ")}`);
  try {
    const { stdout, stderr } = await execFileAsync(
      "node",
      [path.join(__dirname, file), ...args],
      { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }
    );
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
  } catch (err) {
    console.warn(`[daily-update] ${label} failed: ${err.message}`);
    // Soft-fail every step — we prefer a partial update over a hard pipeline failure.
  }
}

async function refreshLatestFeedX() {
  console.log("\n=== fetch upstream feed-x.json ===");
  try {
    const { stdout } = await execFileAsync(
      "curl",
      ["-fsSL", "--max-time", "60", UPSTREAM_FEED_X],
      { maxBuffer: 32 * 1024 * 1024 }
    );
    // Validate it parses as JSON before overwriting on disk.
    const parsed = JSON.parse(stdout);
    fs.mkdirSync(path.dirname(PUB_FEED_X), { recursive: true });
    fs.writeFileSync(PUB_FEED_X, JSON.stringify(parsed));
    console.log(
      `[daily-update] wrote ${PUB_FEED_X} (generatedAt=${parsed.generatedAt ?? "?"})`
    );
  } catch (err) {
    console.warn(`[daily-update] could not refresh feed-x.json: ${err.message}`);
  }
}

(async () => {
  console.log(`[daily-update] starting at ${new Date().toISOString()}`);
  await run("Step 1/5 · fetch-history (30 day rebuild)", "fetch-history.mjs");
  await refreshLatestFeedX();
  await run("Step 2/5 · content-safety filter", "apply-content-filter.mjs");
  await run("Step 3/5 · collect-to-translate", "collect-to-translate.mjs");
  await run("Step 4/5 · translate-new", "translate-new.mjs");
  // Re-apply filter after translations land so translated-only matches (e.g. a
  // Chinese term that surfaces only via the zh translation) are also removed.
  await run("Step 5/5 · content-safety filter (post-translate)", "apply-content-filter.mjs");
  console.log(`[daily-update] finished at ${new Date().toISOString()}`);
})();
