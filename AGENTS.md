# TangerineTools · Codex Agent Instructions

## Project overview

TangerineTools is a local-first personal data management web app built with Vite, React 19, and Dexie.js. It is a static frontend app with no backend service. User data lives in browser IndexedDB and is moved through manual JSON export/import.

The default built-in scenario is 洛克王国世界. The currently implemented workspace tools are:

- 资料库 `catalog`
- 收集记录 `owned`
- 统计视图 `stock`
- 性格推荐 `nature`
- 孵蛋推荐 `breeding`
- 阅读伴侣 `reader`

## Development posture

- This repository is for the user's personal use, not a public, multi-tenant, or enterprise product. Optimize design and implementation for the user's own workflow instead of hypothetical organizational compatibility.
- After completing a development batch and its relevant verification, commit the scoped changes and push the working branch to GitHub. Report the branch name, commit id, and pull request status to the user.
- When the requirement and data source are clear, prefer decisive experimentation and coherent refactors over excessive conservatism. It is acceptable to change developer-only workflows, scripts, local audit artifacts, and internal implementation details when the result is simpler and verifiably better.
- Personal-use context does not waive the hard boundaries below, credential/privacy safeguards, external-service rules, or destructive-action precautions. Continue protecting the user's IndexedDB data, stable ids, import compatibility, and versioned source integrity; obtain explicit authorization where these instructions require it.

## Required reading

Before making code changes, read the docs that match the task scope:

- Always inspect the current branch, working tree, latest commit, and task-relevant docs before making changes.
- Read `docs/system-capabilities.md` for implemented scope and explicit non-goals.
- Read `docs/data-sync.md` before touching Dexie data, import/export behavior, preset seeding, or migration logic.
- Read `docs/data-sources/bwiki-pipeline.md` before changing BWiki collection, staging, preview, or publishing workflows.
- Read `docs/data-sources/bwiki-field-mapping.md` before changing BWiki field transforms, stable ids, validation thresholds, or formal preset contents.
- Read `docs/data-sources/research-sources.md` before using B站、小红书 or other player-created materials for positioning, mechanics, builds, or recommendation audits.
- Read `docs/nature/rules.md` before changing nature recommendation rules or UI.
- Read `docs/nature/single-creature-template.md` before writing single-creature nature audit results.
- Read `docs/nature/open-issues.md` before deciding whether a single-creature finding should become a rule change.
- Read `docs/nature/confirmed-results.md` before changing nature rules, so confirmed single-creature conclusions can be regression checked.
- Read `docs/reading-companion/product-and-architecture.md` before changing the reading companion, book packages, reading progress, maps, OCR, or spoiler controls.
- Run `npm run check:nature` and inspect `artifacts/nature/calibration-report.md` before calibrating or discussing current nature recommendation samples.

Also check the latest commit, PR description, and review comments when continuing an existing branch.

## Hard boundaries

- Do not introduce Dexie schema version changes unless the user explicitly asks for them.
- Do not delete or clear user `owned` / `stock` data.
- Import semantics are merge-by-id: same id overwrites, local records missing from the file remain. Do not change import into clear-and-replace.
- Keep stable id compatibility for owned / stock records and old random ids.
- Rock Kingdom World formal preset data must come from the versioned BWiki staging / preview / apply workflow. Do not reintroduce retired `d.json` sources or generate mock, placeholder, or fabricated preset rows.
- Preset migrations may safely fill or correct explicit official fields, but must not overwrite user custom non-empty values.
- Nature recommendation reads 洛克王国「精灵基础资料」 and follows `skillRefs` to 「技能资料」. Do not reintroduce duplicated skill long-text fields on creature rows.
- Do not use old web-game 洛克王国 sources as positioning evidence for 洛克王国世界 audits unless the user explicitly asks for historical comparison.
- External sources are used to understand positioning, mechanics, and player evaluation. Do not directly copy external recommended natures as this tool's final recommendation logic.
- Treat B站、小红书 and other player platforms as external research sources, not formal preset inputs. Record links, authors, dates, relevant video timestamps or image pages, and separate observable facts from creator opinions. Do not bypass authentication, CAPTCHA, access controls, or anti-automation measures.
- Prefer rule-level improvements over one-off per-creature special cases. Pause and confirm with the user when a finding would change broad thresholds or role rules.
- Reading companion formal packages must use the versioned staging / preview / explicit apply workflow. Do not guess chapter reveal boundaries, publish unaudited plot facts, or assign precise coordinates to fictional or ambiguous places.

## Environment and commands

- Node must satisfy `package.json` engines (`>=20.19.0`). Run `node -v` before coding.
- Common checks:
  - `npm run lint`
  - `npm test`
  - `npm run build`
  - `git diff --check`
- Preset data work:
  - `npm run check:bwiki:preset` / `npm run apply:bwiki:preset`
- Nature recommendation work:
  - `npm run check:nature`

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
- When changing recommendation logic, run `npm run check:nature` and inspect the local `artifacts/nature/calibration-report.md`.
- Reports should make rule causes inspectable: stat distribution, trait/effect labels, role breakdown, candidate reasons, and risks.
- Keep 洛克王国世界 preset data based on official sync results; external materials may inspire audits but must not replace official preset rows.
- For external positioning audits, handle one creature per turn following the user's capture progress.
- When several single-creature audits reveal the same rule issue, pause for user confirmation, then apply a rule-level change and rerun the relevant full reports.
- If external materials conflict with local roles or with each other, mark the case for user confirmation before changing broad rules.
- Use `docs/nature/single-creature-template.md` for one-creature output. After the user confirms a final result, record it in `docs/nature/confirmed-results.md`; if a rule issue is found but not yet settled, record it in `docs/nature/open-issues.md`.
- After changing nature rules, regression-check any entries in `docs/nature/confirmed-results.md` and note expected or unexpected drift.

## Documentation workflow

- `AGENTS.md` stores long-lived Codex instructions and safety boundaries.
- `README.md` is the human-facing project entry and the authoritative map of current commands, top-level structure, and maintained documents. Update it when any of those change.
- Topic documents store durable specifications, maintenance rules, source provenance, unresolved issues, or confirmed regression baselines that would be cumbersome or inappropriate in the root README.
- Avoid directory-level index README files that only repeat the root project map. Add one only when the directory has a distinct workflow or safety contract that cannot be stated clearly in an existing topic document.
- Do not maintain a general session handoff document. New sessions should derive current context from the live repository, Git state, `README.md`, and task-relevant docs.
- Task prompts should focus on the current goal, target branch/PR, scope, and acceptance criteria rather than repeating all stable project rules.
- Script-generated reports belong in Git-ignored `artifacts/` unless a task explicitly defines them as versioned source material. Regenerate them instead of hand-editing them.
- Every maintained script or structured script input must have a package command, an importing consumer, or a documented operational role. Remove orphaned scripts, inputs, commands, reports, and references together.
- Treat maintained documentation as a description of the current system, not as a development diary. State what exists, how it behaves, where it lives, and how to verify or maintain it.
- Do not retain transition narration such as “changed from A to B”, “now uses”, “no longer uses”, “was removed”, “was completed”, “this round”, dated implementation summaries, or explanations of discarded approaches in current-state docs. Git history is the source for implementation history.
- When replacing an implementation or source, update the authoritative current description and remove obsolete narrative instead of appending a cleanup note.
- Historical facts may remain only when they have current operational value: compatibility and migration semantics, user-confirmed regression baselines, external-source provenance, and genuinely unresolved decisions. Express compatibility requirements as present-tense constraints rather than project-history commentary.
- Purpose-built ledgers must contain only active issues or durable decision provenance. Remove resolved implementation notes once their final rule is captured in the authoritative spec or confirmed-results baseline.
- Apply the same final-state standard to report templates and README files. Before finishing a documentation batch, search for stale transition language and either rewrite it as a present-tense constraint or remove it.
- When finishing a development or documentation batch, include a short “Next steps” note in the final response so the user knows what to do or ask for next.

## Answer-only and documentation audit tasks

- If the user asks for analysis, review, or documentation audit only, do not edit files unless they explicitly ask for cleanup or say to proceed with recommendations.
- When answering repository questions, cite the files and commands inspected, and separate current state, recommendations, and optional next edits.
- For documentation cleanup, remove redundant indexes and process history while preserving current operational constraints, source provenance, compatibility rules, unresolved decisions, and confirmed regression baselines.
