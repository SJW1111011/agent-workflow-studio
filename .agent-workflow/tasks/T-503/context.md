# T-503 Context

## Why now

The current dashboard is light-only with no dark mode. Most developer tools support dark mode — its absence makes the dashboard feel unfinished. Responsive polish is needed because the current 900px breakpoint is too aggressive for modern phones. This task is the visual quality gate for Phase 4.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- Current palette: warm beige (#f7f2e8) background, forest green (#18221d) text, burnt orange (#ef6c33) accent
- Dark palette suggestion: dark charcoal background, light sage text, same accent colors
- CSS variables already in use — dark mode is a variable swap
- `prefers-color-scheme` media query is supported in all modern browsers
- Lighthouse scoring: performance (bundle size, FCP, LCP), accessibility (contrast, ARIA), best practices (HTTPS, no console errors), SEO (meta tags, headings)

## Open questions

- Should the dark palette be a direct inversion or a custom design? Leaning custom — inversions look cheap.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Depends on T-501 (components must exist to style)
- WCAG AA contrast ratio required (4.5:1)
- Must pass `npm run dashboard:build`
