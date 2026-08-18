# Ark-Online-Judge

ArkOJ — 一个终端风格的在线判题系统（前端 + 后端）。

## 结构

```
src/       Vue 3 前端（vite-plus / vp）
server/    后端 API（Express 5 + Node 内置 SQLite，零原生依赖）
```

## 包管理（只用 vp / pnpm）

本项目 **只使用 `vp` + pnpm**，不要用 npm。

| 操作 | 命令（在仓库**根目录**） |
| ---- | ---- |
| 安装前端依赖 | `vp install` 或 `pnpm install` |
| 安装后端依赖 | `pnpm server:install` 或 `cd server && pnpm install` |
| 前端开发 | `vp dev` 或 `pnpm dev` → http://localhost:5173 |
| 后端启动 | `pnpm start` 或 `pnpm server` → http://localhost:3000 |
| 后端热重载 | `pnpm server:dev` |
| 前端构建 | `vp build` 或 `pnpm build` |
| 检查 | `vp check` 或 `pnpm check` |

> `pnpm start` 已映射到 `server/` 的后端。  
> 不要只在根目录装包就指望后端依赖齐——后端要单独：`cd server && pnpm install`。

pnpm 设置写在 **`.npmrc`**（`minimum-release-age=0`、`only-built-dependencies[]=esbuild`），不要写在 `package.json` 的 `"pnpm"` 字段（新版 pnpm 会忽略并 WARN）。

若仍遇到 `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`：

```bash
rm -rf node_modules pnpm-lock.yaml
vp install
# 或
pnpm install
```

## 功能模块

| 模块     | 说明                                                                 |
| -------- | -------------------------------------------------------------------- |
| 首页     | 系统概览、推荐题目、下一场比赛倒计时、本周训练进度                   |
| 题库     | 分页 / 难度 / 标签筛选，题面详情，在线提交与评测                     |
| 题单     | 公开/私人题单，进度跟踪                                              |
| 竞赛     | ACM / OI 赛制，报名，赛中题目，实时榜单                              |
| 排名     | 全站 AC 榜                                                           |
| 讨论     | 发帖 / 回复，可关联题目                                              |
| 用户主页 | 资料、难度分布、最近 AC / 提交、题单与比赛记录                       |
| 评测     | JavaScript 使用 `node:vm` 真实跑测例；其他语言模拟评测（演示流程） |

## 后端（server/）

要求 Node.js >= 22.5（使用内置 `node:sqlite`）。

```bash
# 方式 A：在仓库根目录
pnpm server:install
pnpm start            # = cd server && pnpm start
# pnpm server:dev     # 文件变更自动重启

# 方式 B：进入 server/
cd server
pnpm install
pnpm start            # 或 pnpm dev
```

默认监听 `http://localhost:3000`（可用环境变量 `PORT` 覆盖）。
首次启动会自动创建 `server/data/arkoj.db`，并播种管理员账号、示例题目 / 题单 / 比赛 / 讨论：

> **admin / admin123**（首次登录后请尽快修改）

### 接口一览

| 方法   | 路径                           | 说明                                        |
| ------ | ------------------------------ | ------------------------------------------- |
| GET    | `/api/health`                  | 健康检查                                    |
| POST   | `/api/auth/register`           | 注册（username / password），自动登录       |
| POST   | `/api/auth/login`              | 登录，返回 `{ token, user }`                |
| GET    | `/api/auth/me`                 | 获取当前登录用户（需登录）                  |
| PUT    | `/api/auth/profile`            | 编辑资料：nickname / avatar / bio           |
| POST   | `/api/auth/logout`             | 退出登录，销毁会话                          |
| GET    | `/api/stats/overview`          | 首页概览数据                                |
| GET    | `/api/problems`                | 题库列表（q / difficulty / tag / page）     |
| GET    | `/api/problems/tags`           | 标签统计                                    |
| GET    | `/api/problems/:idOrCode`      | 题目详情                                    |
| POST   | `/api/problems`                | 创建题目（admin）                            |
| PUT    | `/api/problems/:id`            | 更新题目（admin）                           |
| GET    | `/api/submissions`             | 提交列表                                    |
| GET    | `/api/submissions/:id`         | 提交详情（本人/admin 可见代码）             |
| POST   | `/api/submissions`             | 提交评测（需登录）                          |
| GET    | `/api/lists`                   | 题单列表                                    |
| GET    | `/api/lists/:id`               | 题单详情 + 进度                             |
| POST   | `/api/lists`                   | 创建题单（需登录）                            |
| PUT    | `/api/lists/:id`               | 更新题单                                    |
| DELETE | `/api/lists/:id`               | 删除题单                                    |
| GET    | `/api/contests`                | 比赛列表（status=upcoming\|running\|ended） |
| GET    | `/api/contests/:id`            | 比赛详情 + 题目                             |
| POST   | `/api/contests/:id/register`   | 报名                                        |
| DELETE | `/api/contests/:id/register`   | 取消报名                                    |
| GET    | `/api/contests/:id/rank`       | 榜单                                        |
| POST   | `/api/contests`                | 创建比赛（admin）                            |
| GET    | `/api/users/rank`              | 全站排名                                    |
| GET    | `/api/users/:username`         | 用户主页数据                                |
| GET    | `/api/discussions`             | 讨论列表                                    |
| GET    | `/api/discussions/:id`         | 帖子详情 + 回复                             |
| POST   | `/api/discussions`             | 发帖                                        |
| POST   | `/api/discussions/:id/replies` | 回复                                        |

- 会话：随机 32 字节 token，数据库中仅存 SHA-256 摘要；同时写入
  httpOnly Cookie（`arkoj_session`）与 JSON 响应体；前端会把 token 放进
  `Authorization: Bearer`（内存 + localStorage），避免预览环境 Cookie 丢失。
- 密码：`crypto.scrypt` + 随机盐，恒定时间比较。
- 跨域：默认允许 `localhost` / `127.0.0.1` / `*.e2b.app`（`ARKOJ_ORIGIN` 可钉死单一来源），`credentials: true`。

### 环境变量

| 变量                   | 默认值        | 说明                               |
| ---------------------- | ------------- | ---------------------------------- |
| `PORT`                 | `3000`        | 监听端口                           |
| `ARKOJ_ORIGIN`         | —             | 若设置则 CORS 仅允许该来源         |
| `ARKOJ_DATA_DIR`       | `server/data` | SQLite 数据目录                    |
| `ARKOJ_ADMIN_PASSWORD` | `admin123`    | 首次播种的管理员密码               |
| `NODE_ENV`             | —             | `production` 时 Cookie 加 `Secure` |

### JavaScript 提交约定

评测沙箱提供：

- 全局字符串 `input`：整份标准输入
- `console.log(...)`：写入标准输出
- 可选 `main(input)` / `solve(input)`：返回值也会作为输出
- `readline()`：按行读取

## 前端（开发）

```bash
# 仓库根目录
vp install        # 或 pnpm install
vp dev            # 或 pnpm dev → http://localhost:5173，/api 代理到 :3000
```

```bash
vp build          # 或 pnpm build → dist/
```

后端若检测到 `dist/`，会一并托管前端，此时只需：

```bash
cd server && pnpm start
# 浏览器打开 http://localhost:3000
```

生产环境建议设置 `NODE_ENV=production`。
