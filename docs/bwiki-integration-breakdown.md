# BWiki 主数据接入拆解计划

本文把“以 BWiki 完全覆盖旧洛克王国预置数据”的大任务拆成可验收的小阶段，避免一次性抓取、转换、替换、迁移和 UI 改版混在同一个提交里。

## 分批执行约定

- 每一批只推进一个阶段或一个阶段内的一个子目标。
- 每批结束时必须更新本文的“当前状态”或“下一步”，并在最终回复里明确下一步是什么。
- 如果本批生成了新的审计报告，也要把报告命令登记到 `docs/README.md` 的生成报告表。
- 在明确进入预置覆盖阶段前，不覆盖 `public/presets/rockKingdomRows.json` / `public/presets/rockKingdomSkillRows.json`。
- 不改 Dexie schema，不清空用户数据，不改导入语义。

## 当前状态

| 阶段 | 状态 | 产物 | 是否可覆盖 public presets |
|---|---|---|---|
| BWiki 页面登记 | 已完成 | `docs/data-sources.md` | 否 |
| BWiki 页面审计 | 已完成 | `docs/bwiki-source-audit.md` | 否 |
| 筛选页 staging | 已完成 | `scripts/data/bwiki/*.staging.json`、`docs/bwiki-staging-report.md` | 否 |
| 详情页解析 | 已完成首批受控解析 | `scripts/data/bwiki/creature-details.sample.staging.json`、`docs/bwiki-detail-staging-report.md` | 否 |
| 字段映射冻结 | 已完成首版 | `docs/bwiki-field-mapping.md` | 否 |
| 预置形状 preview | 已完成首版 | `scripts/data/bwiki/*preview.json`、`docs/bwiki-preview-report.md` | 否 |
| 详情页 UI 分块 | 未开始 | 待新增 | 否 |

## 后续阶段

### P1：详情页解析

目标只包括：从 BWiki 精灵详情页解析特性详情、技能关系、血脉 / 互斥技能、进化链、蛋组和详情图片。

验收：只生成 staging / 报告，不覆盖 public presets。

### P2：字段映射冻结

目标只包括：确认 BWiki 字段如何映射到现有资料库字段。

验收：字段定义、预置行字段、迁移兼容策略都明确；不引入 Dexie schema version 变更。

### P3：预置转换 preview

目标只包括：把 BWiki staging 转成预置 JSON 形状的 preview。

建议产物：

- `scripts/data/bwiki/rockKingdomRows.preview.json`：精灵基础资料 preview，形状对齐 `public/presets/rockKingdomRows.json`。
- `scripts/data/bwiki/rockKingdomSkillRows.preview.json`：技能资料 preview，形状对齐 `public/presets/rockKingdomSkillRows.json`。
- `docs/bwiki-preview-report.md`：preview 审计报告，记录行数、id 复用、新增 id、字段冲突、技能关系覆盖率、图片来源和仍需人工确认的问题。

验收：生成 preview 和报告；不覆盖 public presets；报告明确写出本次命令未触碰 `public/presets/*`、Dexie、用户数据和 UI。

### P4：显式覆盖命令

目标只包括：新增明确命令覆盖 `public/presets/rockKingdomRows.json` 与 `public/presets/rockKingdomSkillRows.json`。

验收：覆盖前后行数、id 复用、新增 id、技能关系覆盖率可审计。

### P5：详情页分块 UI

目标只包括：数据稳定后再做洛克王国精灵详情专用分块布局。

验收：只对洛克王国精灵基础资料启用专用布局，通用资料库详情页保持可用；样式仍放在 `src/styles.css`。

## 下一步

先人工审阅 `docs/bwiki-preview-report.md` 中的 id 复用、新增行、字段冲突和技能关系覆盖率。若 preview 口径确认可接受，再进入 P4：新增显式覆盖命令；覆盖命令必须继续保留覆盖前后行数、id 复用、新增 id 和技能关系覆盖率报告，并且只有用户明确要求时才能替换 `public/presets/*`。
