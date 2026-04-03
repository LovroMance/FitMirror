

# FitMirror

移动端优先的 AI 健身 MVP。

当前阶段重点不是继续扩散功能，而是把主链路做稳：注册/登录 → 生成计划 → 开始训练 → 完成训练 → 写入记录 → 热图回看。

## 当前能力

- **账号体系**：注册、登录、登录态恢复、路由守卫、当前用户信息获取
- **计划生成**：流式生成、稳定通道生成、DeepSeek 失败时模板回退、最近计划恢复、历史列表回看与删除、计划云同步
- **训练闭环**：从计划页或历史计划进入训练会话，完成后自动写入本地训练记录
- **训练记录**：近 6 周/近 30 天热图、趋势摘要、当天详情、手动补录
- **动作库**：静态动作数据、关键词/部位/难度/器械筛选、动作详情、收藏与最近查看

## 技术栈

- **前端**：Vue 3 + TypeScript + Vite + Pinia + Element Plus + Dexie.js
- **后端**：Node.js + TypeScript + Express + Prisma + MySQL
- **AI**：DeepSeek API 集成

## 快速开始

### 1. 安装依赖

```bash
# 根目录
npm install

# 前端
npm --prefix frontend install

# 后端
npm --prefix backend install
```

### 2. 配置环境变量

参考根目录 `.env.example`：

- **前端**：`VITE_API_BASE_URL=http://127.0.0.1:3000/api`
- **后端**：`DATABASE_URL`、`JWT_SECRET`、`JWT_EXPIRES_IN`、`PORT`

### 3. 启动服务

```bash
# 后端
npm --prefix backend run dev

# 前端
npm --prefix frontend run dev -- --host 127.0.0.1 --port 4173
```

> ⚠️ 如遇 `ts-node-dev spawn EPERM` 错误，可改用：
> ```bash
> npm --prefix backend run build
> node backend/dist/app.js
> ```

### 4. 质量检查

```bash
npm run lint
npm run test:frontend
npm run test:backend
```

## 主链路回归

1. 打开 `/register` 注册并自动登录
2. 进入 `/plans/generate` 输入目标并生成计划
3. 点击"开始训练"进入 `/workouts/session`
4. 完成训练后跳转 `/records`
5. 在热图中点击当天方格查看详情
6. 打开 `/plans/history` 回看、复用或删除历史计划

## 项目结构

```
├── frontend/           # 前端应用
│   ├── src/
│   │   ├── api/       # API 接口
│   │   ├── assets/    # 静态资源
│   │   ├── components/# 公共组件
│   │   ├── composables/# 组合式函数
│   │   ├── db/        # 本地数据库
│   │   ├── repositories/# 数据仓库
│   │   ├── router/    # 路由配置
│   │   ├── store/     # 状态管理
│   │   ├── types/     # 类型定义
│   │   ├── utils/     # 工具函数
│   │   └── views/     # 页面视图
│   └── public/        # 公共资源
├── backend/           # 后端应用
│   ├── src/
│   │   ├── config/    # 配置
│   │   ├── lib/       # 公共库
│   │   ├── middlewares/# 中间件
│   │   ├── modules/   # 业务模块
│   │   │   ├── auth/        # 认证模块
│   │   │   ├── plans/      # 计划模块
│   │   │   └── workout-records/# 训练记录模块
│   │   ├── types/    # 类型定义
│   │   └── utils/     # 工具函数
│   └── prisma/       # 数据库迁移
└── docs/             # 项目文档
```

## 文档索引

- [docs/文档索引.md](./docs/文档索引.md)
- [docs/项目状态.md](./docs/项目状态.md)
- [docs/需求分析.md](./docs/需求分析.md)
- [docs/功能说明.md](./docs/功能说明.md)
- [docs/开发指南.md](./docs/开发指南.md)
- [docs/视觉风格与页面原型设计规范.md](./docs/视觉风格与页面原型设计规范.md)
- [docs/数据库架构.md](./docs/数据库架构.md)
- [docs/项目代码目录结构.md](./docs/项目代码目录结构.md)

## 已知边界

- 训练计划与训练记录都保留前端 Dexie 缓存，并同步到后端 MySQL
- 后端当前承接 `auth`、`plans` 与训练记录同步接口
- `manifest.json` 已存在，但完整 PWA 离线/推送能力尚未落地
- 如果前端 `.env` 将 `VITE_API_BASE_URL` 指向不可达地址，注册与登录会失败；本地开发建议使用 `http://127.0.0.1:3000/api`

## 许可证

MIT License