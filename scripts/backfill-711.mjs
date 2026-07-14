#!/usr/bin/env node
// Backfill 2026-07-11 using the corrected 24h window feed from the 7-12 01:19 UTC commit
// (upstream committed empty feed at 7-11 07:00 due to X API error; maintainer fixed and
// re-ran at 7-12 01:19 producing a healthy 24h window that covers most of 7-11).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const REPO = path.resolve("../follow-builders");
const SHA = "abb1081b4d28200f35cd8af3df31180465491d53";
const OUT = path.resolve("public/data/feed-history.json");
const TARGET_DATE = "2026-07-11";

const payload = JSON.parse(execFileSync("git", ["-C", REPO, "show", `${SHA}:feed-x.json`], { maxBuffer: 32 * 1024 * 1024 }).toString());
const users = (payload.x ?? []).map((u) => ({
  source: u.source ?? "x",
  name: u.name,
  handle: u.handle,
  bio: u.bio ?? "",
  tweets: u.tweets ?? [],
}));
const tweetCount = users.reduce((s, u) => s + u.tweets.length, 0);
console.log(`[backfill-711] using sha=${SHA.slice(0, 7)} users=${users.length} tweets=${tweetCount}`);

const hist = JSON.parse(fs.readFileSync(OUT, "utf8"));
const idx = hist.days.findIndex((d) => d.date === TARGET_DATE);
const entry = {
  date: TARGET_DATE,
  lookback: "24h",
  generatedAt: payload.generatedAt ?? null,
  x: { users },
  backfilledFrom: `upstream sha=${SHA.slice(0, 7)} (rescued after empty-feed API error on 2026-07-11)`,
};
if (idx >= 0) hist.days[idx] = entry;
else {
  hist.days.push(entry);
  hist.days.sort((a, b) => (a.date < b.date ? 1 : -1));
}
hist.stats.totalTweets = hist.days.reduce((s, d) => s + d.x.users.reduce((ss, u) => ss + u.tweets.length, 0), 0);
hist.stats.coveredDays = hist.days.filter((d) => d.x.users.some((u) => (u.tweets ?? []).length > 0)).length;
hist.generatedAt = new Date().toISOString();
fs.writeFileSync(OUT, JSON.stringify(hist));
console.log(`[backfill-711] wrote ${OUT}. 7-11 now has ${tweetCount} tweets. totalTweets=${hist.stats.totalTweets}`);
