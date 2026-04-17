# T-503 - Dark mode + responsive polish — system theme detection, mobile layout, Lighthouse >= 90

## Goal

Add dark mode with system theme detection and polish the responsive layout for mobile viewports. After this task, the dashboard automatically matches the user's OS theme preference, has a manual toggle, and scores >= 90 on Lighthouse for performance, accessibility, best practices, and SEO.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: dashboard-next/src/styles/variables.css (add dark theme CSS variables)
  - repo path: dashboard-next/src/styles/dark.css (dark mode overrides)
  - repo path: dashboard-next/src/components/ThemeToggle.jsx (new — light/dark/system toggle)
  - repo path: dashboard-next/src/hooks/useTheme.js (new — prefers-color-scheme detection + localStorage persistence)
  - repo path: dashboard-next/src/components/ (responsive adjustments across all components)
  - repo path: dashboard-next/index.html (meta viewport, theme-color, lang attribute)
  - repo path: README.md
- Out of scope:
  - repo path: dashboard/ (old dashboard — no dark mode)
  - repo path: src/ (no server changes)

## Deliverables

- Dark theme CSS variables (--bg-dark, --panel-dark, --ink-dark, etc.)
- `prefers-color-scheme: dark` media query for automatic detection
- ThemeToggle component with 3 states: light, dark, system
- Theme preference persisted in localStorage
- Mobile responsive: all components usable at 375px viewport width
- Lighthouse >= 90 on all 4 categories (performance, accessibility, best practices, SEO)
- Proper meta tags: viewport, theme-color, lang

## Risks

- Dark mode color contrast may not meet WCAG AA — test with contrast checker
- Lighthouse score depends on bundle size — Preact is small but Vite config matters
- Some CSS variables may need different values for dark mode that aren't obvious from the light palette

## Acceptance Criteria

- Dashboard auto-detects system dark mode preference
- Manual toggle switches between light/dark/system
- Theme preference persists across page reloads
- All text meets WCAG AA contrast ratio (4.5:1 for normal text)
- Dashboard is usable at 375px viewport width (no horizontal scroll)
- Lighthouse >= 90 on all 4 categories
- `npm run dashboard:build` succeeds
