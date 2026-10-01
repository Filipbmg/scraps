---
name: snowdrop-ui
description: Build or extend Snowdrop's React dashboard, frontend features, themes, and responsive UI. Use when working in frontend/src or on Snowdrop dashboard interactions.
---

# Snowdrop UI

- Stack: React, TypeScript, Vite, Lucide icons; plain CSS with semantic theme tokens. No UI framework or chart library.
- `src/app/` owns the application shell and global theme tokens. `src/components/` holds shared layout, branding, and the native-dialog wrapper.
- `src/features/dashboard/` owns dashboard orchestration, cards, API types, CSV export, and feature styles. Extend the feature that owns the behavior rather than creating a global utility by default.
- `src/features/collection/` owns collector configuration, run status, actual collected records, detail views, and its API types/styles. `src/app/types.ts` owns the cross-feature navigation view union.
- Dashboard data comes from `GET /api/dashboard`; Vite proxies `/api` to `127.0.0.1:8000`. Keep sample data in the backend, never duplicate it in the frontend.
- Theme initialization runs in `index.html` before React to prevent a light flash. `useTheme` updates `data-theme` and `snowdrop-theme` in localStorage. Both themes use the same CSS tokens.
- Bookmark IDs are stored under `snowdrop-saved-mentions`, validated against the current snapshot, and remain usable for the session when storage is unavailable.
- Use native select controls and the shared native `<dialog>` wrapper for keyboard support, focus trapping, and Escape dismissal. Give icon-only buttons accessible names.
- The mobile sidebar restores focus to its opener, traps Tab within navigation, and closes on Escape. The main workspace is inert while the drawer is open. Closed navigation is CSS-hidden from focus.
- Animate the drawer's transform, not visibility: a visibility transition leaves the close button hidden during the opening effect and prevents its initial focus. The mobile browser check proves autofocus, Escape restoration, and Tab wrapping.
- Searches include headline, excerpt, publisher, and keywords. Sentiment, date, and saved filters also apply to CSV export. Export quotes cells, preserves Unicode, and neutralizes formula-like content.
- Charts are SVG, have accessible summaries, and must match their selected source/period. Do not display overall growth as source-specific growth.
- Keep fictional mentions and snapshot metrics explicitly labeled. Demo publisher links open homepages; collected records link to their actual original URLs. New monitor/source actions open the real Collectors workspace.
- Collection views refresh every 10 seconds. Worker status comes from the API's heartbeat age, not a fabricated online badge. Queuing a run does not imply collection happened; offline workers are shown explicitly.
- Collected-feed responses contain short summaries. Fetch full source text, captions, and comments only after opening a detail dialog. Display unavailable/blocked caption status instead of synthesizing a transcript.
- Verify with `npm run build`, `npm run lint`, and `npm run test:e2e`. Browser checks cover themes, bookmarks, filters, CSV, API recovery, per-source frequencies, pause/queue actions, record details, and 390px mobile layouts. Screenshots are in ignored `test-results/`.
