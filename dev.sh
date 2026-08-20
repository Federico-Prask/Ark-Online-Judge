#!/usr/bin/env bash
# ArkOJ 一键启动：后端 :8787 + 前端 :5173（/api 已代理）
set -e
cd "$(dirname "$0")"

echo "[1/4] 后端依赖…"
(cd ark-backend && npm install --no-fund --no-audit --silent)
echo "[2/4] 前端依赖…"
(cd ark-frontend && npm install --no-fund --no-audit --silent)

echo "[3/4] 启动后端 :8787…"
(cd ark-backend && nohup npm run start >../.backend.log 2>&1 &)
sleep 2

echo "[4/4] 启动前端 :5173…"
(cd ark-frontend && nohup npm run dev >../.frontend.log 2>&1 &)
sleep 3

echo ""
echo "✅ ArkOJ 已启动 → http://localhost:5173"
echo "   演示账号 admin / admin123（或注册新号）"
echo "   日志：.backend.log / .frontend.log"
