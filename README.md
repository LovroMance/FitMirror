# FitMirror

AI 动作教练 · 训练日历 · PWA 健身应用

## 目录结构

详见 [docs/项目代码目录结构.md](docs/项目代码目录结构.md)

## 快速开始（Windows / 通用）

1. 安装依赖（仓库根目录）
- `npm install`
- `npm --prefix frontend install`
- `npm --prefix backend install`

2. 配置环境变量
- 后端：创建 `backend/.env`
- 前端：创建 `frontend/.env`

3. 启动开发服务
- 后端：`npm --prefix backend run dev`
- 前端：`npm --prefix frontend run dev -- --host 127.0.0.1 --port 4173`

## 环境变量最小集

后端 `backend/.env`：

```env
DATABASE_URL=mysql://root:1234@127.0.0.1:3306/fitmirror
JWT_SECRET=fitmirror-local-dev-secret-2026
JWT_EXPIRES_IN=7d
PORT=3000

# Day8 DeepSeek 计划生成（可选；未配置时自动回退模板）
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_TIMEOUT_MS=10000
```

前端 `frontend/.env`：

```env
VITE_API_BASE_URL=http://127.0.0.1:3000/api
```

## Day8+ 说明（计划生成）

- `POST /api/plans/generate` 采用“DeepSeek 优先 + 模板兜底”。
- 当 `DEEPSEEK_API_KEY` 缺失、无效或响应结构异常时，后端会自动返回模板计划，前端无需改动。
- 默认模型为 `deepseek-chat`，后续切换模型只需改 `DEEPSEEK_MODEL`。
- 已支持流式接口：`GET /api/plans/generate/stream?goalText=...`。
- 当前默认输出“详细版训练计划”：更长 summary、5-7 个动作、包含热身/主训练/放松结构（失败时模板回退也为详细版）。

## Day7 演示脚本（1-2-3）

1. 账号链路
- 打开 `/register` 注册新用户并登录。
- 成功判定：进入首页，刷新后仍保持登录。

2. 计划与记录链路
- 进入 `/plans/generate` 输入目标并生成计划。
- 在计划页点击动作名跳转动作库预筛选。
- 进入 `/records` 使用“模拟完成 10/20/30 分钟”写入记录。
- 成功判定：热图有颜色变化，点击日期可见次数与总时长。

3. 动作库链路
- 进入 `/exercises`，执行关键词+部位+难度+器械筛选。
- 打开动作详情弹层查看动作要点和注意事项。
- 成功判定：筛选可叠加和清空，详情可稳定展示。

## 常见问题（最小排障）

1. 前端无法请求后端
- 检查 `frontend/.env` 的 `VITE_API_BASE_URL` 是否为 `http://127.0.0.1:3000/api`。
- 检查后端是否已运行在 `3000` 端口。

2. 后端启动失败 / 数据库连接失败
- 检查 `backend/.env` 的 `DATABASE_URL` 与本地 MySQL 账号密码。
- 确认 MySQL 服务已启动。

3. 端口占用
- 前端：改 `--port`（例如 `4174`）。
- 后端：改 `PORT`（例如 `3001`），并同步更新前端 `VITE_API_BASE_URL`。

4. 页面空白或数据异常
- 先看终端报错，再看浏览器控制台报错。
- 重新登录后重试关键路径：计划生成 -> 写入记录 -> 热图查看。

5. Windows 下前端偶发 `vite spawn EPERM`
- 现象：前端 dev 启动失败，页面可能显示 502。
- 处理：重启前端服务；必要时使用提权方式启动（项目已按该方式完成回归）。

## P0 收口资料

- 当前进度与后续：`docs/当前进度与后续工作.md`
- 协作进度记录：`docs/协作进度记录.md`

## 主要技术栈

- 前端：Vue3 + Vite + TypeScript + Pinia + Element Plus + Dexie
- 后端：Node.js + TypeScript + Express + Prisma + MySQL

## 代码规范

- ESLint、Prettier、Stylelint、Husky、lint-staged
- 详见 [docs/开发指南.md](docs/开发指南.md)

## 贡献

欢迎 PR 与 Issue。
