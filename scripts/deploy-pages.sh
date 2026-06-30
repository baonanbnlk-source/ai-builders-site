#!/usr/bin/env bash
# 将 dist/ 发布到 GitHub Pages (gh-pages 分支)
# 前提: dist/ 已构建好; 环境变量 GITHUB_TOKEN 已设置
set -euo pipefail

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "❌ 环境变量 GITHUB_TOKEN 未设置，中止。" >&2
  exit 1
fi

DIST_DIR="$(cd "$(dirname "$0")/.." && pwd)/dist"
if [ ! -f "$DIST_DIR/index.html" ]; then
  echo "❌ $DIST_DIR/index.html 不存在，请先执行 pnpm build。" >&2
  exit 1
fi

echo "[deploy-pages] 推送 dist/ 到 gh-pages 分支..."

cd "$DIST_DIR"
touch .nojekyll
rm -rf .git
git init -q
git checkout -q -b gh-pages
git -c user.email=ci@local -c user.name=ci add -A
git -c user.email=ci@local -c user.name=ci commit -qm "deploy $(date -u +%FT%TZ)"
git push -q --force \
  "https://x-access-token:${GITHUB_TOKEN}@github.com/baonanbnlk-source/ai-builders-site.git" \
  gh-pages 2>&1 | sed 's/github_pat_[A-Za-z0-9_]*/***/g'

echo "[deploy-pages] ✅ 推送成功"
echo "https://baonanbnlk-source.github.io/ai-builders-site/"
