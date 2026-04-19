# T-503 Context

## Why now

The current dashboard is light-only with no dark mode. Most developer tools support dark mode - its absence makes the dashboard feel unfinished. Responsive polish is needed because the current 900px breakpoint is too aggressive for modern phones. This task is the visual quality gate for Phase 4.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- Current palette: warm beige (#f7f2e8) background, forest green (#18221d) text, burnt orange (#ef6c33) accent
- Dark palette suggestion: dark charcoal background, light sage text, same accent colors
- `dashboard-next` still imports `../../dashboard/styles.css`, so dark mode needs to override shared variables in import order instead of changing the legacy dashboard bundle
- CSS variables already in use - dark mode is a variable swap once the modern shell owns the final token values
- `prefers-color-scheme` media query is supported in all modern browsers
- Lighthouse scoring: performance (bundle size, FCP, LCP), accessibility (contrast, ARIA), best practices (HTTPS, no console errors), SEO (meta tags, headings)
- The final Lighthouse mobile rerun against the built local dashboard on `http://127.0.0.1:4273/` scored 98 performance, 100 accessibility, 100 best practices, and 100 SEO

## Open questions

- None at handoff. The implementation used a custom dark palette instead of a raw inversion.

## Progress notes

- 2026-04-18T02:18:00+08:00: Read the T-503 task bundle plus the project memory, confirmed `dashboard-next` is the active scope, and traced the modern shell back to the shared `dashboard/styles.css` import so the legacy dashboard could stay untouched.
- 2026-04-18T02:34:00+08:00: Implemented the theme bootstrap path (`index.html`, `main.jsx`, `useTheme.js`, `ThemeToggle.jsx`, `Header.jsx`) and added responsive/dark-mode overrides in `variables.css`, `dark.css`, and `app.css`, including accessible task-card buttons in `TaskList.jsx`.
- 2026-04-18T02:54:21+08:00: First Lighthouse mobile run proved the shell was accessible and SEO-clean but reported `performance: 84` and `best practices: 96`; the audit trace pointed to a large CLS jump from `section.stats` entering after load plus a `favicon.ico` 404 console error.
- 2026-04-18T03:00:19+08:00: Added Overview loading skeletons, started the overview reducer in `loading`, inlined a favicon, then reran `npm run dashboard:build`, `npm test`, `npm run smoke`, and Lighthouse. The final Lighthouse mobile rerun cleared the target with 98/100/100/100.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Depends on T-501 (components must exist to style)
- WCAG AA contrast ratio required (4.5:1)
- Must pass `npm run dashboard:build`
