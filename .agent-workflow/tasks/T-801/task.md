# T-801 - Dashboard 性能优化：解决加载慢和初始体验问题

## Goal

解决 dashboard 初次加载慢的问题，提升用户第一印象。当前 dashboard 加载时间过长，没有加载状态反馈，用户体验差。这是决定用户是否使用产品的关键因素。目标：将初次加载时间从当前的数秒降低到 1 秒内，并提供清晰的加载状态。

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: dashboard-next/src/ (React 组件)
  - repo path: dashboard-next/vite.config.js (构建配置)
  - repo path: dashboard-next/src/App.jsx (主应用)
  - repo path: dashboard-next/src/components/ (所有组件)
- Out of scope:
  - repo path: dashboard/ (legacy dashboard，不改)
  - repo path: src/server.js (API 端，暂不改)

## Current Problems

1. **加载慢**：初次加载需要数秒，没有反馈
2. **无加载状态**：白屏时间长，用户不知道发生了什么
3. **一次性加载所有数据**：即使只看一个任务，也加载全部
4. **无代码分割**：所有组件打包在一起

## Deliverables

**Phase 1: 快速改进（本次任务）**
- 添加骨架屏（Skeleton UI）
- 添加加载状态指示器
- 优化初始数据加载（只加载必要数据）
- 代码分割（路由级别）

**验证标准：**
- 初次加载时间 < 1 秒（本地）
- 有清晰的加载状态
- 用户不会看到白屏
- Lighthouse Performance > 80

**不包含：**
- 视觉设计改进（留给后续任务）
- 信息架构重组（留给后续任务）
- 实时更新（留给后续任务）

## Risks

- contract mismatches
- fake implementations
- unverified assumptions
