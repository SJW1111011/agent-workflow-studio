# Dashboard 全面审计报告

## 审计日期
2026-04-30

## 审计目的
深入理解 Dashboard 架构，为重构做准备。目标：打造真正的人与 AI 协作工作台。

---

## 1. 架构概览

### 文件结构
```
dashboard-next/
├── src/
│   ├── App.jsx                 # 主应用，定义标签页和布局
│   ├── main.jsx                # 入口文件
│   ├── components/             # UI 组件
│   │   ├── Overview.jsx        # 概览页（核心）
│   │   ├── TaskList.jsx        # 任务列表
│   │   ├── TaskDetail.jsx      # 任务详情
│   │   ├── Forms.jsx           # 操作表单（执行、记录）
│   │   ├── ApprovalPanel.jsx   # Review 面板
│   │   ├── CreateTaskForm.jsx  # 创建任务表单
│   │   ├── TrustScore.jsx      # 信任分数
│   │   └── ...
│   ├── context/
│   │   └── DashboardContext.jsx # 全局状态
│   ├── hooks/
│   │   ├── useDashboardState.js # 核心状态管理（694行）
│   │   ├── useApi.js            # API 调用
│   │   └── ...
│   ├── utils/                   # 工具函数
│   │   ├── trustScore.js        # Trust Score 计算
│   │   ├── execution.js         # 执行相关
│   │   ├── taskBoard.js         # 任务看板
│   │   └── ...
│   └── styles/
│       └── app.css              # 全局样式（1585行）
```

### 核心标签页
1. **Overview** - 概览（最重要）
2. **Tasks** - 任务列表和详情
3. **Actions** - 操作表单（执行、记录 runs）
4. **Verification** - 验证状态
5. **Runs** - 运行记录

---

## 2. 核心功能审计

### 2.1 Overview（概览页）

**作用：**
- 一眼看到整体状态
- 关键指标展示
- Trust Score
- 需要注意的事项

**显示的指标：**
- Tasks 数量
- Runs 数量
- Coverage 百分比
- Executor 状态
- Verification 状态
- Human Review 状态
- Claims 状态
- Trust Score

**优点：**
- ✅ 信息密集但清晰
- ✅ 一眼看到重点
- ✅ Trust Score 建立信任
- ✅ 符合"工作台"的定位

**问题：**
- ⚠️ 可能信息过载（对新用户）
- ⚠️ 没有明确的"下一步行动"

### 2.2 创建任务流程

**当前流程：**
1. 点击 "+Create Task" 按钮
2. 打开 Modal
3. 填写标题和优先级
4. 提交
5. 调用 `/api/quick` 创建任务
6. 调用 `/api/tasks/:id/execute` 启动执行
7. 关闭 Modal，切换到任务详情

**优点：**
- ✅ 简单直接
- ✅ 自动启动执行

**问题：**
- ❌ Modal 在某些情况下卡死（技术问题）
- ⚠️ 没有 AI 生成任务定义的步骤
- ⚠️ 只有标题和优先级，太简单

### 2.3 执行任务

**方式 1：通过 Dashboard（Actions 标签）**
- Forms.jsx 中有执行表单
- 可以选择 agent 和 timeout
- 调用 `/api/tasks/:id/execute`

**方式 2：通过 CLI**
- `npx agent-workflow run:execute T-XXX`

**优点：**
- ✅ Dashboard 可以直接触发执行
- ✅ 有 SSE 实时更新

**问题：**
- ⚠️ 执行表单在 Actions 标签，不够直观
- ⚠️ 创建后自动执行，但用户看不到进度

### 2.4 Review 流程

**ApprovalPanel 组件：**
- 显示在 TaskDetail 中
- 有 Approve 和 Reject 按钮
- Reject 时需要填写反馈
- Reject 后会创建 correction task

**优点：**
- ✅ 有完整的 approve/reject 流程
- ✅ Reject 后自动创建 correction task
- ✅ 显示 review 状态和时间

**问题：**
- ⚠️ 看不到 agent 做了什么（改动的文件、diff）
- ⚠️ 看不到清晰的证据
- ⚠️ 难以做出明智的决策

### 2.5 Trust Score

**TrustScore 组件：**
- 显示整体信任分数
- 基于 verification、human review 等
- 有热力图展示

**优点：**
- ✅ 建立信任的核心机制
- ✅ 可视化展示
- ✅ 有详细的计算逻辑

---

## 3. 状态管理审计

### useDashboardState.js（694行）

**职责：**
- 管理所有 Dashboard 状态
- 处理 API 调用
- 处理 SSE 更新
- 管理 execution state
- 管理 log state

**问题：**
- ❌ 太大（694行）
- ❌ 职责太多
- ❌ 难以维护
- ❌ 可能是性能瓶颈

**应该拆分为：**
- useOverview
- useTasks
- useExecution
- useLogs
- useActions

---

## 4. API 接口审计

**已发现的 API：**
- `GET /api/overview` - 获取概览数据
- `GET /api/tasks` - 获取任务列表
- `GET /api/tasks/:id` - 获取任务详情
- `POST /api/quick` - 快速创建任务
- `POST /api/tasks/:id/execute` - 执行任务
- `POST /api/tasks/:id/approve` - Approve 任务
- `POST /api/tasks/:id/reject` - Reject 任务
- `POST /api/tasks/:id/runs` - 记录 run
- `GET /api/tasks/:id/execution/events` - SSE 执行事件

**优点：**
- ✅ API 完整
- ✅ 有 SSE 实时更新
- ✅ 支持完整的协作循环

---

## 5. 关键发现

### 好的部分（保留）

1. **Overview 优先的设计**
   - 一眼看到重点
   - 符合工作台定位

2. **Trust Score 机制**
   - 建立信任
   - 有证据支撑

3. **完整的功能**
   - 覆盖完整的协作循环
   - 创建、执行、Review、验证

4. **实时更新**
   - SSE 支持
   - 执行状态实时显示

5. **API 设计**
   - 完整、清晰
   - 支持所有操作

### 问题的部分（改进）

1. **状态管理太复杂**
   - useDashboardState 694行
   - 需要拆分

2. **创建任务流程太简单**
   - 只有标题和优先级
   - 缺少 AI 生成任务定义

3. **Review 体验不够好**
   - 看不到改动
   - 看不到证据
   - 难以决策

4. **Modal 技术问题**
   - 在某些情况下卡死
   - 需要深入调查

5. **CSS 太大**
   - app.css 1585行
   - 难以维护

---

## 6. 重构方向

### 核心原则：去伪存真

**保留（真）：**
1. Overview 优先的架构
2. Trust Score 机制
3. 完整的功能覆盖
4. 实时更新机制

**去掉（伪）：**
1. 过度复杂的状态管理
2. 不必要的组件
3. 重复的代码

**改进：**
1. 拆分 useDashboardState
2. 改进创建任务流程（加入 AI 生成）
3. 改进 Review 体验（显示改动和证据）
4. 修复 Modal 问题
5. 简化 CSS

### 优先级

**P0（立即做）：**
1. 修复 Modal 问题（技术债）
2. 理解 Modal 卡死的根本原因

**P1（核心功能）：**
3. 改进创建任务流程
4. 改进 Review 体验
5. 拆分状态管理

**P2（优化）：**
6. 性能优化
7. CSS 重构
8. 代码清理

---

## 7. Modal 问题深入分析

### 现象
- 在视口宽度 > 540px 时卡死
- 在视口宽度 <= 540px 时正常

### 可能的原因

1. **CSS 媒体查询问题**
   - 在 > 540px 时，某些 CSS 导致问题

2. **Flexbox 布局问题**
   - Modal overlay 的 flexbox 在某些情况下失效

3. **Z-index 堆叠上下文问题**
   - 某个元素创建了新的堆叠上下文
   - 导致 Modal 被覆盖

4. **事件冒泡问题**
   - 点击事件被某个元素拦截

5. **Portal 渲染问题**
   - createPortal 在某些情况下有问题

### 需要深入调查
- 检查 CSS 在不同视口宽度下的差异
- 检查是否有其他元素干扰
- 使用浏览器开发工具逐步调试

---

## 8. 下一步行动

### 立即行动
1. 深入调查 Modal 问题
2. 找到根本原因
3. 彻底修复

### 短期行动
4. 改进创建任务流程
5. 改进 Review 体验

### 长期行动
6. 重构状态管理
7. 优化性能
8. 代码清理

---

## 9. 对目标的理解

### 核心目标
**打造人与 AI 协作的工作台**

### 角色分工
- **人**：创意、决策、Review
- **AI/Agent**：执行、记录、改进

### 理想的工作流
1. 人提出想法
2. AI 生成任务定义
3. 人 Review 并确认
4. Agent 执行
5. Agent 记录证据
6. 人 Review 结果
7. Approve 或 Reject + 反馈
8. 循环继续

### 工作台的价值
- 让协作流畅
- 让人的时间最小化
- 让 Agent 的工作可见
- 建立信任

### 这是伟大的开始
- 改变软件开发的方式
- 解放人的创造力
- 让 AI 成为真正的协作者

---

## 10. 总结

### 现有 Dashboard 的评价
- **架构正确**：Overview 优先，功能完整
- **机制完善**：Trust Score，实时更新
- **需要改进**：状态管理、创建流程、Review 体验
- **技术债务**：Modal 问题、CSS 过大

### 重构策略
- **去伪存真**：保留好的，去掉复杂的
- **优先级明确**：先修复技术债，再改进功能
- **目标导向**：一切为了更好的协作体验

### 信心
这是一个有意义的项目，值得投入精力去做好。

---

审计完成。接下来：深入调查 Modal 问题，找到根本原因。
