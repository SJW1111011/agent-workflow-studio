# T-803 - Dashboard 操作能力：让工作台真正可用

## Goal

让 Dashboard 从"监控面板"变成真正的"工作台"。用户应该能在 Dashboard 完成所有核心操作，而不需要回到 CLI。这是 dogfooding 发现的最痛的问题：每次操作都要回 CLI，工作流程断裂，体验很差。

## Problem

**当前状态：**
- Dashboard 只能"看"（查看任务、证据、状态）
- 不能"做"（创建、编辑、记录完成）
- 每次操作都要回 CLI
- 工作流程断裂，体验很差

**Dogfooding 痛点：**
1. 想创建任务 → 回 CLI
2. 想记录完成 → 回 CLI，输入长命令
3. 想编辑任务 → 手动编辑 task.md
4. 想 approve/reject → 这个可以，但其他都不行

**这不是工作台，这是监控面板。**

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: dashboard-next/src/components/ (添加操作组件)
  - repo path: src/server.js (添加 API endpoints)
  - repo path: src/lib/task-service.js (可能需要扩展)
- Out of scope:
  - repo path: dashboard/ (legacy dashboard，不改)
  - 复杂的任务编辑器（先做基础功能）
  - AI 生成 task.md（留给后续任务）

## Deliverables

**Phase 1: 快速创建任务（最小可用）**
- Dashboard 顶部添加"Create Task"按钮
- 简单表单：标题、优先级
- 调用 API 创建任务
- 创建后自动跳转到任务详情

**Phase 2: 记录完成（解决最痛点）**
- 任务详情页添加"Mark Done"按钮
- 简单表单：summary, 自动检测 git diff
- 调用 workflow_done API
- 不需要回 CLI

**Phase 3: 基础编辑（可选）**
- 编辑任务标题、优先级、状态
- 不需要手动编辑 task.md

**验证标准：**
- 能在 dashboard 创建任务
- 能在 dashboard 记录完成
- 不需要回 CLI 就能完成基本工作流
- 用户体验流畅

## Risks

- contract mismatches
- fake implementations
- unverified assumptions
