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
| 筛选页 staging | 已完成；已纠正 `data-param8` 为归属赛季 | `scripts/data/bwiki/*.staging.json`、`docs/bwiki-staging-report.md` | 否 |
| 详情页解析 | 已完成 592 / 592 条解析（0 error）；1 条旧模板使用官方 API 源码回退 | `scripts/data/bwiki/creature-details.sample.staging.json`、`docs/bwiki-detail-staging-report.md` | 否 |
| 字段映射冻结 | 已完成首版 | `docs/bwiki-field-mapping.md` | 否 |
| 预置形状 preview | P3 审阅完成；自动准入阻塞项已清零，可进入 P4 命令设计 | `scripts/data/bwiki/*preview.json`、`docs/bwiki-preview-report.md` | 否 |
| 显式覆盖命令 | P4 dry-run 与三方安全迁移已完成；等待正式覆盖授权 | `scripts/apply-bwiki-rock-kingdom-preset.mjs`、`scripts/data/bwiki/rockKingdomPresetMigration.preview.json`、`docs/bwiki-apply-report.md` | 待明确授权 |
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

P4 显式覆盖和已有浏览器安全迁移已完成 dry-run。覆盖脚本会同时发布精灵、技能和版本化迁移清单；运行时只更新空值、无效值或 SHA-256 仍匹配旧官方值的字段，用户自定义非空值、29 个旧 id、用户新增行及 owned / stock 引用均保留。当前目标为 592 条精灵 / 553 条技能，迁移清单涉及 467 条精灵的 2510 个字段和 487 条技能的 1615 个字段；真实三文件写入已在临时目录验证。下一步由用户明确授权后运行正式覆盖命令，再执行完整 build / 数据关系 / 产物 diff 验收；本阶段仍未修改 `public/presets/*`。
