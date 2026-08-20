# ArkOJ

为算法竞赛人而建的在线评测系统。工业冷峻风前端（Vue3 + TS + Vite + Tailwind + Font Awesome）+ Express 后端 + 真评测机（g++ C++17 / Python 3）。

## 一键启动

```bash
./dev.sh          # 后端 :8787 + 前端 :5173（/api 自动代理）
```

或手动：

```bash
cd ark-backend  && npm i && npm run start   # :8787
cd ark-frontend && npm i && npm run dev     # :5173
```

打开 http://localhost:5173 · 演示账号 **admin / admin123**

## 功能

- 首页（登录态问候 / 平台·个人数据带 / 模块卡片）
- 题库：数值评级 Lv1–8（官方难度 ± 通过率微调，通过率 = AC人数 / Σt，t = 首次AC及以前的尝试数）
- 题目详情：题面 / 样例 / 代码编辑器 / 提交 → 自动跳转 → 全屏判定动画 → Subtask 详情（真实编译、运行、计时、比对）
- 提交记录流（轮询实时回流）
- 用户系统：注册 / 登录（无状态 HMAC 签名 token，30 天）/ 用户主页 / 设置
- 权限管理（`/admin/users`，users-gear 入口）：
  - 默认可移除：进入 OJ、发表讨论
  - 可授予：管理题目、管理比赛、管理用户权限、管理用户管理员权限（初始仅 admin）
- 深色 / 浅色主题；1000 / 880 / 768 断点

## 结构

```
ark-backend/   Express + tsx；data/db.json 持久化；data/auth.log 鉴权日志
  src/problems.ts  题目+测试点（tests 永不下发）
  src/judge.ts     编译/运行/比对（生产应换 rootfs+cgroup 隔离）
  src/store.ts     用户/权限/统计/会话签名
ark-frontend/  Vue3 SPA（hash 路由）
```

## 注意

- Arena 预览环境不适合跑全栈应用（进程轮次间会被杀/前端被独立部署），**请本地运行验收**。
- 评测机当前与 OJ 同环境串行执行，仅用于 MVP 演示。
