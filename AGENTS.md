# Snowdrop

React/TypeScript frontend in `frontend/`; Python/FastAPI API in `backend/`.

- Organize by feature. Keep API routes, schemas, and services inside the owning backend feature; dashboard UI and its API types inside the owning frontend feature.
- Put components in `frontend/src/components/` only when they are genuinely shared. Use local React state until a real cross-feature need appears.
- Reuse CSS theme tokens, Lucide icons, and native browser controls. Keep both themes, keyboard access, and mobile layouts working.
- The backend owns both the demo snapshot and the separate collected-data workspace. Keep sample analytics labeled, show actual collection outcomes, and never infer sentiment/reach from collected data without an implemented analysis feature.
- Collection code belongs in `backend/app/features/collection/` and `frontend/src/features/collection/`. The API and collector worker are separate processes; SQLite owns schedules, leases, deduplicated records, and run history. Keep credentials, cookies, sessions, and `backend/data/` out of Git.
- Run one collector worker per workspace. Read `docs/collectors.md` and `.opencode/skills/snowdrop-collectors/SKILL.md` before changing connector behavior or scheduling.
- Run `npm run build`, `npm run lint`, and relevant browser checks in `frontend/`; run `uv run --extra dev python -m unittest discover -s tests -v` in `backend/`.
- For all connector checks, install/run with `uv sync --all-extras` and `uv run --all-extras python -m unittest discover -s tests -v`. Optional account/video tests skip when their extras are unavailable; automated tests must not use real account sessions or write into the operator's database.
- Record reusable project knowledge as OpenCode skills in `.opencode/skills/<name>/SKILL.md`, with `name` and `description` frontmatter. Update a relevant existing skill first; document verified behavior and workflows, not speculative architecture.
- Keep generated files, environments, secrets, and unrelated boilerplate out of Git. Only commit when requested.
