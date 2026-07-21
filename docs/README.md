# TangerineTools 文档索引

`docs/` 按维护责任分为“系统说明、专题人工文档、版本化生成报告”三层，避免规则、台账和脚本输出混在同一目录。

## 目录结构

```text
docs/
├── README.md                    # 本索引
├── system-capabilities.md       # 当前能力和明确非目标
├── data-sync.md                 # IndexedDB、导入导出和预置迁移语义
├── session-start-prompt.md      # 当前分支的轻量交接信息
├── data-sources/                # 数据来源、BWiki 管线和字段血缘
├── nature/                      # 性格规则、模板和人工确认台账
└── generated/                   # 脚本生成、随版本审阅的报告
```

## 长期维护文档

| 文件 | 用途 | 维护方式 |
|---|---|---|
| `system-capabilities.md` | 当前能力与明确非目标 | 功能范围变化时人工更新 |
| `data-sync.md` | Dexie 数据模型、导入导出、播种与迁移约束 | 数据语义变化时人工更新 |
| `session-start-prompt.md` | 新 session 的代码地图和阶段重点 | 每个开发批次结束时轻量更新 |
| `data-sources/README.md` | 正式数据来源和外部旁证边界入口 | 数据来源体系变化时更新 |
| `data-sources/bwiki-pipeline.md` | BWiki 页面、快照目录、刷新和发布流程 | 管线变化时更新 |
| `data-sources/bwiki-field-mapping.md` | staging 到正式字段的映射和验收门槛 | 字段来源或转换口径变化时更新 |
| `nature/README.md` | 性格专题文档入口和维护边界 | 性格工作流变化时更新 |

长期开发安全边界、必读范围和验证命令以根目录 `AGENTS.md` 为准，不在这里重复维护。

## 版本化生成报告

| 文件 | 生成命令 | 说明 |
|---|---|---|
| `generated/nature-calibration-report.md` | `npm run check:nature` | 当前正式预置与性格规则的可解释回归报告 |
| `generated/rocom-position-audit-plan.md` | `npm run audit:rocom` | 全量定位核对清单；人工结论维护在 `scripts/data/rocomAuditFindings.json` |

以上报告正文不手工编辑。BWiki 同步、preview、dry-run 产生的临时报告进入 Git 忽略的 `artifacts/`，不属于版本化文档。

## 更新触发条件

| 改动类型 | 应同步检查 / 更新 |
|---|---|
| 新增或移除工具、路由、部署能力 | 根 `README.md`、`system-capabilities.md`、`session-start-prompt.md` |
| 修改 Dexie schema、导入导出、播种或迁移 | `data-sync.md` 和 `AGENTS.md` 数据边界 |
| 修改 BWiki 来源、解析或发布流程 | `data-sources/`，并运行 `npm run check:bwiki:preset` |
| 修改性格规则或解释口径 | `nature/rules.md`，运行 `npm run check:nature` 并回归确认台账 |
| 单只精灵核对 | 使用 `nature/single-creature-template.md`；问题记入迭代台账，用户确认后写入确认台账 |
| 更新外部定位结论 | 修改 `scripts/data/rocomAuditFindings.json`，再运行 `npm run audit:rocom` |
| 只刷新生成报告 | 不手改正文，记录生成命令并检查差异 |
