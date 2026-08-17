# Ark-Online-Judge

ArkOJ — 一个终端风格的在线判题系统（前端 + 后端）。

## 结构

```
src/       Vue 3 前端（vite + vue-tsc）
server/    后端 API（Express 5 + Node 内置 SQLite，零原生依赖）
```

## 后端（server/）

要求 Node.js >= 22.5（使用内置 `node:sqlite`）。

```bash
cd server
pnpm install
pnpm start        # 或 pnpm dev（文件变更自动重启）
```

默认监听 `http://localhost:3000`（可用环境变量 `PORT` 覆盖）。
首次启动会自动创建 `server/data/arkoj.db`，并播种管理员账号：

> **admin / admin123**（首次登录后请尽快修改）

### 接口一览

| 方法 | 路径                 | 说明                                        |
| ---- | -------------------- | ------------------------------------------- |
| GET  | `/api/health`        | 健康检查                                    |
| POST | `/api/auth/register` | 注册（username / password），自动登录       |
| POST | `/api/auth/login`    | 登录，返回 `{ token, user }`                |
| GET  | `/api/auth/me`       | 获取当前登录用户（需登录）                  |
| PUT  | `/api/auth/profile`  | 编辑资料：nickname / avatar / bio（需登录） |
| POST | `/api/auth/logout`   | 退出登录，销毁会话                          |

- 会话：随机 32 字节 token，数据库中仅存 SHA-256 摘要；同时写入
  httpOnly Cookie（`arkoj_session`）与 JSON 响应体，供浏览器/客户端使用。
- 密码：`crypto.scrypt` + 随机盐，恒定时间比较。
- 跨域：默认允许 `http://localhost:5173`（`ARKOJ_ORIGIN` 可覆盖），`credentials: true`。

### 环境变量

| 变量                   | 默认值                  | 说明                               |
| ---------------------- | ----------------------- | ---------------------------------- |
| `PORT`                 | `3000`                  | 监听端口                           |
| `ARKOJ_ORIGIN`         | `http://localhost:5173` | CORS 允许的前端来源                |
| `ARKOJ_DATA_DIR`       | `server/data`           | SQLite 数据目录                    |
| `ARKOJ_ADMIN_PASSWORD` | `admin123`              | 首次播种的管理员密码               |
| `NODE_ENV`             | —                       | `production` 时 Cookie 加 `Secure` |

## 前端（开发）

```bash
pnpm install
pnpm dev          # http://localhost:5173，/api 已代理到后端 :3000
```

`pnpm build` 产物输出到 `dist/`；后端检测到 `dist/` 时会同时托管前端，
此时直接访问 `http://localhost:3000` 即可（生产模式请设置 `NODE_ENV=production`）。
