# AGENTS.md - Urlaubsplaner Project

## Dev Server

- After making changes, always run `npm run build` before starting dev server
- Start dev server with: `npm run dev`
- Dev server runs on: http://localhost:3000/
- The error "Unsafe attempt to load URL" with chrome-error://chromewebdata is caused by the user opening a broken link. The solution is to tell them to open http://localhost:3000/ directly in their browser - it is NOT a code issue.

## Common Fixes

- Lat/Lng validation error: Ensure coordinates are valid numbers (not null, undefined, NaN)
- Connection lines: Only show for flight, train, and transport types