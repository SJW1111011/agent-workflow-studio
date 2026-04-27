# Dashboard 代码审查 - 发现的问题

## 执行摘要

通过系统性审视 Dashboard 代码，发现了严重的架构和设计问题。这些问题不是简单的 bug，而是根本性的设计缺陷，导致代码难以维护、扩展和理解。

**关键发现：**
1. 状态管理过于复杂（694 行的单一 hook）
2. 组件职责不清晰
3. 样式组织混乱
4. 缺少清晰的数据流
5. 过度工程化

---

## 1. 状态管理问题

### 问题：useDashboardState.js 有 694 行

**这是一个巨大的红旗。**

```
dashboard-next/src/hooks/useDashboardState.js: 694 lines
```

**问题：**
- 单一 hook 承担了太多职责
- 状态逻辑、副作用、API 调用全部混在一起
- 难以理解、测试、维护
- 任何修改都可能影响整个系统

**应该是：**
- 拆分成多个小 hook
- 每个 hook 负责一个领域（tasks, overview, execution...）
- 清晰的职责分离
- 易于测试和维护

### 问题：Reducer 模式但没有真正的好处

当前使用 useReducer，但：
- Action 类型分散
- Reducer 逻辑复杂
- 没有 action creators
- 没有类型安全

**这不是真正的状态管理，只是把复杂度藏起来了。**

---

## 2. 组件架构问题

### 问题：组件职责不清晰

**示例：TaskList.jsx**
- 包含 3 种视图（list, kanban, timeline）
- 包含过滤逻辑
- 包含选择逻辑
- 包含 localStorage 逻辑
- 太多职责

**应该是：**
- TaskList（容器）
- TaskListView, TaskKanbanView, TaskTimelineView（展示）
- TaskFilters（过滤）
- 每个组件只做一件事

### 问题：组件层次混乱

```
App.jsx
  ├─ DashboardShell
  │   ├─ Layout
  │   │   ├─ Header
  │   │   ├─ TabBar
  │   │   └─ main
  │   │       ├─ Overview
  │   │       ├─ TaskList
  │   │       ├─ TaskDetail
  │   │       ├─ Forms
  │   │       ├─ VerificationPanel
  │   │       └─ RunsPanel
  │   └─ Modal
  │       └─ CreateTaskForm
```

**问题：**
- 所有面板都在同一层级
- 用 `hidden` prop 控制显示
- 没有真正的路由
- 状态管理复杂

**应该是：**
- 使用真正的路由（或至少更清晰的视图管理）
- 按需加载组件
- 清晰的父子关系

---

## 3. 样式问题

### 问题：单一巨大的 CSS 文件

```
dashboard-next/src/styles/app.css: 1400+ lines
```

**问题：**
- 所有样式在一个文件
- 难以找到相关样式
- 容易冲突
- 难以维护

**应该是：**
- CSS Modules 或 styled-components
- 每个组件有自己的样式
- 或者至少按功能分文件

### 问题：样式命名不一致

```css
.task-card
.panel-eyebrow
.hero-copy
.badge-status
.form-field
```

**没有统一的命名规范。**

---

## 4. 数据流问题

### 问题：数据流不清晰

**当前：**
```
API → useDashboardState → Context → 所有组件
```

**问题：**
- 所有组件都能访问所有状态
- 不清楚谁在修改什么
- 难以追踪数据变化
- 容易出现意外的副作用

**应该是：**
- 清晰的数据流向
- 组件只接收需要的数据
- 明确的数据修改路径

### 问题：过度使用 Context

**Context 应该用于：**
- 主题
- 认证
- 语言

**不应该用于：**
- 所有应用状态
- 频繁变化的数据
- 复杂的业务逻辑

**当前 Dashboard 把所有东西都放在 Context 里。**

---

## 5. 性能问题

### 问题：没有优化

- 没有 React.memo
- 没有 useMemo
- 没有 useCallback
- 所有组件在任何状态变化时都重新渲染

**这就是为什么 Dashboard 慢。**

### 问题：一次性加载所有数据

```javascript
// useDashboardState.js
const overview = await api.loadOverview();
// 加载所有任务、所有 runs、所有证据...
```

**应该：**
- 按需加载
- 分页
- 虚拟滚动（如果任务很多）

---

## 6. 代码质量问题

### 问题：重复代码

很多组件有相似的逻辑：
- 加载状态处理
- 错误处理
- 空状态处理

**应该抽取成共享的 hooks 或组件。**

### 问题：缺少类型安全

- 没有 TypeScript
- 没有 PropTypes
- 容易传错 props
- 难以重构

### 问题：缺少测试

- 没有单元测试
- 没有集成测试
- 不敢重构
- 容易引入 bug

---

## 7. 用户体验问题

### 问题：信息过载

**Overview 页面显示：**
- 统计卡片
- 任务列表
- 验证信息
- 运行信息
- 太多信息，不知道重点

**应该：**
- 清晰的信息层次
- 突出重点
- 隐藏次要信息

### 问题：交互不直观

- 不清楚可以点击什么
- 不清楚当前在哪里
- 不清楚下一步该做什么

**缺少：**
- 清晰的视觉反馈
- 明确的操作引导
- 一致的交互模式

---

## 8. 当前 Bug：Modal 显示问题

### 问题描述

点击 "+ Create Task" 后，按钮出现在页面最下方，而不是 Modal 弹窗。

### 可能原因

1. **Modal 没有正确渲染**
   - Modal 组件可能有问题
   - 或者没有正确挂载到 DOM

2. **CSS 没有正确应用**
   - z-index 不够高
   - position: fixed 没有生效
   - 或者被其他样式覆盖

3. **组件层次问题**
   - Modal 可能被渲染在错误的位置
   - 被父元素的样式影响

### 需要检查

1. Modal 是否正确渲染
2. CSS 是否正确加载
3. z-index 是否足够高
4. 是否有���他样式冲突

---

## 优先级

### P0 - 立即修复

1. **修复 Modal bug** - 让创建任务功能可用
2. **拆分 useDashboardState** - 694 行太大了

### P1 - 短期改进

3. **组件职责分离** - 每个组件只做一件事
4. **添加性能优化** - memo, useMemo, useCallback
5. **改进数据流** - 清晰的数据流向

### P2 - 中期重构

6. **样式重组** - CSS Modules 或分文件
7. **添加类型安全** - TypeScript 或 PropTypes
8. **添加测试** - 单元测试和集成测试

### P3 - 长期改进

9. **用户体验优化** - 信息层次、交互引导
10. **真正的路由** - 替代当前的 hidden prop 模式

---

## 建议

### 短期（本周）

1. **修复 Modal bug**
2. **完成 T-803 Phase 1**（创建任务功能）
3. **记录所有发现的问题**

### 中期（下周）

4. **重构状态管理**
   - 拆分 useDashboardState
   - 清晰的数据流
   - 性能优化

5. **组件重构**
   - 职责分离
   - 减少重复代码
   - 提高可维护性

### 长期（下个月）

6. **考虑重写 Dashboard**
   - 当前的技术债太多
   - 可能重写比重构更快
   - 基于 dogfooding 的经验重新设计

---

## 结论

**Dashboard 的问题不是几个 bug，而是根本性的架构问题。**

**关键问题：**
1. 过度复杂的状态管理
2. 不清晰的组件职责
3. 混乱的样式组织
4. 缺少性能优化
5. 用户体验差

**这解释了为什么：**
- Dashboard 慢
- 难以添加新功能
- 容易出 bug
- 用户体验差

**建议：**
- 短期：修复关键 bug，完成基本功能
- 中期：重构核心部分
- 长期：考虑基于经验重写

**最重要的：**
- 不要继续在当前架构上堆功能
- 先解决根本问题
- 然后再添加功能
