## FitMirror 快速验证版 MVP（7 天执行计划）

### Summary
目标是在 7 天内交付一个可演示、可自测的 P0 MVP：`账号基础 + AI 计划生成 + 训练记录热图 + 动作库`。  
默认不做动作识别闭环（归入 P1），优先保证流程通、数据通、页面可用。

### 7-Day Plan
1. **Day 1：工程基线与运行链路**
- 确认 `frontend`、`backend` 可独立启动，补齐 `.env`。
- 后端提供 `GET /api/health`，前端首页完成健康检查展示。
- 验收：本地一键启动后能看到“前后端联通成功”。

2. **Day 2：账号体系最小闭环**
- 后端完成 `register/login/me`（JWT、密码哈希、统一响应结构）。
- 前端完成登录/注册页、token 持久化、路由守卫。
- 验收：新用户可注册登录，刷新后仍保持登录态。

3. **Day 3：AI 计划生成（核心）**
- 前端完成“输入目标 -> 生成计划 -> 展示计划”页面流。
- 先接 mock 生成服务（或后端占位接口），统一计划数据结构。
- 验收：至少 3 种输入示例能生成可展示计划卡片。

4. **Day 4：本地数据层（Dexie）**
- 建立本地表：`plans`、`workout_records`、`settings`。
- 计划保存、读取、删除跑通；训练完成写入记录。
- 验收：刷新页面后计划和记录仍在。

5. **Day 5：训练记录热图页**
- 接入日历热图组件，按训练记录映射强度颜色。
- 支持“点击某天看详情（次数/时长）”。
- 验收：当周有训练时热图有明显变化，详情正确。

6. **Day 6：动作库页**
- 接入 `public/data/exercises.json`，实现列表、筛选、详情弹层。
- 验收：至少支持按部位/难度筛选，详情信息完整可读。

7. **Day 7：联调、稳定性与演示包**
- 全流程回归：登录 -> 生成计划 -> 开始训练(占位) -> 写入记录 -> 热图展示 -> 动作库浏览。
- 修复高优先级 bug，补 README（启动、环境、演示路径）。
- 验收：按“演示脚本”一次走通无阻断。

### Interfaces & Data Contracts
- 后端统一响应：
  - 成功：`{ code: 0, message: "success", data }`
  - 失败：`{ code: 非0, message, error? }`
- 必要 API：
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `GET /api/health`
  - `POST /api/plans/generate`（MVP 可先 mock）
- 本地 Dexie 最小模型：
  - `plans(id, userId, goalText, planJson, createdAt)`
  - `workout_records(id, userId, date, duration, completed, planId)`
  - `settings(userId, theme, unit, updatedAt)`

### Test Plan
1. 注册/登录/鉴权：错误账号、过期 token、未登录访问受限页跳转。
2. 计划生成：空输入、超长输入、正常输入 3 案例。
3. 本地持久化：刷新后计划和记录不丢失。
4. 热图正确性：同一天多次训练聚合显示正确。
5. 动作库筛选：多条件筛选与清空筛选行为正确。
6. 基础可用性：移动端视口下页面无阻断错位，关键按钮可点。

### Assumptions
- 首版目标是“验证需求与流程”，不追求动作识别实时纠正。
- AI 生成服务可先用 mock 或模板规则，后续替换真实模型/API。
- 隐私策略保持：训练与分析数据仅前端本地存储，后端不落隐私数据。
- 默认以移动端 PWA 体验为唯一目标，不做 PC 适配。
