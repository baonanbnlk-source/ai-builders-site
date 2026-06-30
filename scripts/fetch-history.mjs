// Fetches the last 30 days of feed-x.json snapshots from the follow-builders
// repository.  Prefers a locally cloned copy at ../../follow-builders (much
// faster and avoids GitHub API rate limits / corporate proxy issues).  Falls
// back to GitHub raw URLs via curl when the local clone is not available.
//
// Output: public/data/feed-history.json with shape:
//   { generatedAt, days: [ { date, lookback, x: { users: [...] } }, ... ] }
//
// Run:  node scripts/fetch-history.mjs

import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);

const REPO_LOCAL = path.resolve("../follow-builders");
const REPO_REMOTE = "zarazhangrui/follow-builders";
const OUT_PATH = path.resolve("public/data/feed-history.json");
const DAYS = 30;
const FILE_IN_REPO = "feed-x.json";

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function gitAvailable() {
  try {
    if (!fs.existsSync(path.join(REPO_LOCAL, ".git"))) return false;
    execFileSync("git", ["-C", REPO_LOCAL, "rev-parse", "HEAD"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function listCommitsFromGit() {
  const since = new Date(Date.now() - DAYS * 24 * 3600 * 1000).toISOString();
  const { stdout } = await execFileAsync(
    "git",
    [
      "-C",
      REPO_LOCAL,
      "log",
      `--since=${since}`,
      "--pretty=format:%H|%cI",
      "--",
      FILE_IN_REPO,
    ],
    { maxBuffer: 32 * 1024 * 1024 }
  );
  return stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [sha, iso] = line.split("|");
      return { sha, iso };
    });
}

async function getFileFromGit(sha) {
  const { stdout } = await execFileAsync(
    "git",
    ["-C", REPO_LOCAL, "show", `${sha}:${FILE_IN_REPO}`],
    { maxBuffer: 32 * 1024 * 1024 }
  );
  return JSON.parse(stdout);
}

async function listCommitsFromApi() {
  const since = new Date(Date.now() - DAYS * 24 * 3600 * 1000).toISOString();
  const url = `https://api.github.com/repos/${REPO_REMOTE}/commits?path=${FILE_IN_REPO}&per_page=100&since=${since}`;
  const { stdout } = await execFileAsync(
    "curl",
    ["-fsSL", "-H", "Accept: application/vnd.github+json", url],
    { maxBuffer: 32 * 1024 * 1024 }
  );
  const arr = JSON.parse(stdout);
  return arr.map((c) => ({ sha: c.sha, iso: c.commit.author.date }));
}

async function getFileFromRaw(sha) {
  const url = `https://raw.githubusercontent.com/${REPO_REMOTE}/${sha}/${FILE_IN_REPO}`;
  const { stdout } = await execFileAsync("curl", ["-fsSL", url], {
    maxBuffer: 32 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

/** Pick the *latest* commit per UTC date. */
function lastPerDate(commits) {
  const map = new Map();
  // commits come newest-first; the first time we see a date wins.
  for (const c of commits) {
    const d = c.iso.slice(0, 10);
    if (!map.has(d)) map.set(d, c);
  }
  return map;
}

async function main() {
  console.log("[fetch-history] Looking for local clone at", REPO_LOCAL);
  const useGit = gitAvailable();
  console.log("[fetch-history] using", useGit ? "LOCAL git" : "REMOTE GitHub API/curl");

  let commits;
  try {
    commits = useGit ? await listCommitsFromGit() : await listCommitsFromApi();
  } catch (err) {
    console.error("[fetch-history] failed to list commits:", err.message);
    process.exit(1);
  }
  const picked = lastPerDate(commits);
  // ensure we cover today even if no commit exists yet today
  const today = isoDate(new Date());
  const dateList = [];
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(Date.now() - i * 24 * 3600 * 1000);
    dateList.push(isoDate(d));
  }
  console.log(
    `[fetch-history] commit candidates: ${commits.length}, unique days: ${picked.size}, target days: ${dateList.length}`
  );

  const days = [];
  let success = 0;
  for (const date of dateList) {
    const entry = picked.get(date);
    if (!entry) {
      console.log(`  - ${date}: missing commit (skip)`);
      continue;
    }
    try {
      const payload = useGit
        ? await getFileFromGit(entry.sha)
        : await getFileFromRaw(entry.sha);
      const users = (payload.x ?? []).map((u) => ({
        source: u.source ?? "x",
        name: u.name,
        handle: u.handle,
        bio: u.bio ?? "",
        tweets: u.tweets ?? [],
      }));
      const totalTweets = users.reduce((s, u) => s + u.tweets.length, 0);
      days.push({
        date,
        lookback: `${payload.lookbackHours ?? 24}h`,
        generatedAt: payload.generatedAt ?? null,
        x: { users },
      });
      success++;
      console.log(
        `  + ${date} sha=${entry.sha.slice(0, 7)} users=${users.length} tweets=${totalTweets}`
      );
    } catch (err) {
      console.warn(`  ! ${date}: failed (${err.message?.slice(0, 80)})`);
    }
  }

  // newest first
  days.sort((a, b) => (a.date < b.date ? 1 : -1));

  const out = {
    generatedAt: new Date().toISOString(),
    source: useGit ? "local-git" : "github-raw",
    days,
    stats: {
      coveredDays: success,
      requestedDays: DAYS,
      totalTweets: days.reduce(
        (s, d) => s + d.x.users.reduce((ss, u) => ss + u.tweets.length, 0),
        0
      ),
    },
  };
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out));
  console.log(
    `[fetch-history] wrote ${OUT_PATH} (covered ${success}/${DAYS} days, ${out.stats.totalTweets} tweets total)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
