#!/usr/bin/env bash
# AI Builders 简报网站 · 每日更新一键脚本
# 在仓库根目录执行。机密信息从环境变量读取，绝不写入仓库：
#   GITHUB_TOKEN  用于 fetch-history 调用 api.github.com，避免 403 限流
#   LLM_API_KEY / LLM_BASE_URL / LLM_MODEL / LLM_TIMEOUT_MS  用于中文翻译
# 步骤：1) 更新 feed + 内容过滤 + 翻译  2) 安装依赖  3) 构建静态产物 dist/
set -euo pipefail

echo "[run-daily] node: $(node -v)  pnpm: $(pnpm -v)"

echo "[run-daily] step 1/3 · 数据更新 + 内容过滤 + 翻译"
node scripts/daily-update.mjs

echo "[run-daily] step 2/3 · 安装依赖（允许 esbuild/core-js 构建脚本）"
pnpm install --frozen-lockfile --config.dangerouslyAllowAllBuilds=true

echo "[run-daily] step 3/3 · 构建静态产物"
pnpm build

echo "[run-daily] 完成，产物位于 $(pwd)/dist"
