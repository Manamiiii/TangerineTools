# TangerineTools · Codex Agent Instructions

## Project overview

TangerineTools is a local-first personal data management web app built with Vite, React 19, and Dexie.js. It is a static frontend app with no backend service. User data lives in browser IndexedDB and is moved through manual JSON export/import.

The default built-in scenario is 洛克王国世界. The currently implemented workspace tools are:

- 资料库 `catalog`
- 收集记录 `owned`
- 统计视图 `stock`
- 性格推荐 `nature`

## Required reading

Before making code changes, read the docs that match the task scope:

- Always read `docs/session-start-prompt.md` for the current handoff context.
- Read `docs/system-capabilities.md` for implemented scope and explicit non-goals.
- Read `docs/data-sync.md` before touching Dexie data, import/export behavior, preset seeding, or migration logic.
- Read `docs/nature-recommendation-redesign.md` before changing nature recommendation rules or UI.
- Read `docs/rocom-position-audit-plan.md` before doing external 洛克王国世界 positioning audits.
- Read `docs/nature-calibration-report.md` before calibrating or discussing current nature recommendation samples.

Also check the latest commit, PR description, and review comments when continuing an existing branch.

## Hard boundaries

- Do not introduce Dexie schema version changes unless the user explicitly asks for them.
- Do not delete or clear user `owned` / `stock` data.
- Import semantics are merge-by-id: same id overwrites, local records missing from the file remain. Do not change import into clear-and-replace.
- Keep stable id compatibility for owned / stock records and old random ids.
- Rock Kingdom World preset data must come from the official public `d.json` or the trusted local `scripts/data/rockKingdom.d.json`. Do not generate mock, placeholder, or fabricated preset rows.
- Preset migrations may safely fill or correct explicit official fields, but must not overwrite user custom non-empty values.
- Nature recommendation reads 洛克王国「精灵基础资料」 and follows `skillRefs` to 「技能资料」. Do not reintroduce duplicated skill long-text fields on creature rows.
- Do not use old web-game 洛克王国 sources as positioning evidence for 洛克王国世界 audits unless the user explicitly asks for historical comparison.
- External sources are used to understand positioning, mechanics, and player evaluation. Do not directly copy external recommended natures as this tool's final recommendation logic.
- Prefer rule-level improvements over one-off per-creature special cases. Pause and confirm with the user when a finding would change broad thresholds or role rules.

## Environment and commands

- Node must satisfy `package.json` engines (`>=20.19.0`). Run `node -v` before coding.
- Common checks:
  - `npm run lint`
  - `npm run build`
  - `git diff --check`
- Preset data work:
  - `npm run sync:rock scripts/data/rockKingdom.d.json`
- Nature recommendation work:
  - `npm run check:nature`
- RoCom positioning audit work:
  - `npm run audit:rocom`

Run the checks relevant to the files changed. If a command cannot run because of an environment limitation, report that clearly.

## Code style and architecture

- Keep the app local-first and static. Do not add backend, auth, cloud sync, MariaDB, LLM, MCTS, battle simulation, PVP automation, or type-advantage systems unless explicitly requested.
- Keep styles in `src/styles.css`; do not add CSS frameworks or CSS modules without approval.
- Row values use field `key`, not field record `id`.
- `catalogTables.kind` is a non-indexed property. Ordinary catalog tables are `!table.kind`; collection tables are `kind === 'owned'`.
- `references` fields store arrays of row ids. `reference` fields store one row id.
- `stats` fields are derived views and are not directly editable.
- Hidden fields should still be visible in detail views.

## Nature recommendation workflow

- Preserve the output model of 推荐 / 可保留 / 不推荐.
- When changing recommendation logic, regenerate `docs/nature-calibration-report.md` with `npm run check:nature`.
- Reports should make rule causes inspectable: stat distribution, trait/effect labels, role breakdown, candidate reasons, and risks.
- Keep 洛克王国世界 preset data based on official sync results; external materials may inspire audits but must not replace official preset rows.
- For external positioning audits, proceed in batches. Resolve rule questions from one batch before broadly applying conclusions to all creatures.
- If external materials conflict with local roles or with each other, mark the case for user confirmation before changing broad rules.

## Documentation workflow

- `AGENTS.md` stores long-lived Codex instructions and safety boundaries.
- `docs/session-start-prompt.md` stores project handoff context, code map, and suggested prompts for future sessions.
- Task prompts should focus on the current goal, target branch/PR, scope, and acceptance criteria rather than repeating all stable project rules.
